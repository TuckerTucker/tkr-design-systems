/**
 * studio-api composition — one factory building the protocol surface from
 * injected collaborators (IoC): the WsConnectionHandler for the gateway
 * seam, the Fastify plugin mounting every HTTP route from the architecture
 * route table (except /api/health, owned by studio-server), and the
 * teardown handle.
 *
 * The plugin also owns the API error boundary for its scope: malformed
 * JSON, oversized bodies, and unexpected handler failures all leave as
 * contract ErrorResponse bodies — never a stack trace, never an internal
 * path.
 */
import type { WorkspaceStore } from "@studio/contract";
import type {
  FastifyError,
  FastifyInstance,
  FastifyPluginAsync,
} from "fastify";

import type { AuthManager, SessionManager } from "../agent/index.js";
import type { ArtifactPipeline } from "../artifact-pipeline/index.js";
import type { Logger } from "../logging/create-logger.js";
import type { McpBridge } from "../mcp/index.js";
import type { WsConnectionHandler } from "../ws/connection-gateway.js";
import { apiError, errorResponse, httpStatusFor } from "./errors.js";
import { createLibraryCache, type LibraryCache } from "./library-cache.js";
import { registerArtifactRoutes } from "./routes/artifacts.js";
import { registerLibraryRoutes } from "./routes/library.js";
import { registerPreferencesRoutes } from "./routes/preferences.js";
import { registerWorkspaceRoutes } from "./routes/workspaces.js";
import { createChatRelay, type ChatRelay } from "./ws/chat-relay.js";
import { createWsSessionHandler } from "./ws/connection.js";
import { createHubRegistry, type HubRegistry } from "./ws/journal.js";

export interface StudioApiDeps {
  store: WorkspaceStore;
  pipeline: ArtifactPipeline;
  bridge: McpBridge;
  sessions: SessionManager;
  auth: AuthManager;
  /** Absolute path to systems/registry.yaml (cache invalidation). */
  registryPath: string;
  logger: Logger;
  /** Journal retention per workspace; tests shrink this. */
  journalCapacity?: number;
}

export interface StudioApi {
  /** Registered on buildServer's connectionHandler seam. */
  connectionHandler: WsConnectionHandler;
  /** Fastify plugin mounting every /api route studio-api owns. */
  plugin: FastifyPluginAsync;
  /** Internal surfaces exposed for composition and tests. */
  hubs: HubRegistry;
  relay: ChatRelay;
  cache: LibraryCache;
  /** Stop the registry watcher and unsubscribe event relays. */
  close(): Promise<void>;
}

function registerErrorBoundary(app: FastifyInstance, logger: Logger): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    // Fastify content-type / body parsing failures carry a statusCode;
    // anything else is an unexpected handler failure (a bug) — logged with
    // internals, answered without them.
    const statusCode = error.statusCode ?? 500;
    if (statusCode === 413) {
      const mapped = apiError(
        "payload_too_large",
        "The request body exceeds the accepted size.",
        "Send a smaller body.",
      );
      return reply.code(httpStatusFor(mapped.code)).send(errorResponse(mapped));
    }
    if (statusCode >= 400 && statusCode < 500) {
      const mapped = apiError(
        "invalid_message",
        "The request body could not be parsed.",
        "Send a valid JSON body with Content-Type: application/json.",
        "body",
      );
      return reply.code(400).send(errorResponse(mapped));
    }
    logger.error(
      { err: error, url: request.url, method: request.method },
      "unhandled API route failure",
    );
    const mapped = apiError(
      "internal_error",
      "The request failed unexpectedly.",
      "Retry; if the failure persists, check the server logs.",
    );
    return reply.code(500).send(errorResponse(mapped));
  });
}

export function createStudioApi(deps: StudioApiDeps): StudioApi {
  const log = deps.logger.child({ component: "studio-api" });

  const hubs = createHubRegistry({
    logger: log,
    ...(deps.journalCapacity !== undefined
      ? { journalCapacity: deps.journalCapacity }
      : {}),
  });

  const relay = createChatRelay({
    sessions: deps.sessions,
    pipeline: deps.pipeline,
    bridge: deps.bridge,
    auth: deps.auth,
    hubs,
    logger: log,
  });

  const connectionHandler = createWsSessionHandler({
    workspaces: deps.store.workspaces,
    hubs,
    relay,
    bridge: deps.bridge,
    auth: deps.auth,
    resync: {
      transcripts: deps.store.transcripts,
      artifacts: deps.store.artifacts,
      pipeline: deps.pipeline,
      logger: log,
    },
    logger: log,
  });

  const cache = createLibraryCache({
    registryPath: deps.registryPath,
    logger: log,
  });

  const plugin: FastifyPluginAsync = async (app) => {
    registerErrorBoundary(app, log);
    registerWorkspaceRoutes(app, { workspaces: deps.store.workspaces, logger: log });
    registerArtifactRoutes(app, {
      artifacts: deps.store.artifacts,
      pipeline: deps.pipeline,
      logger: log,
    });
    registerPreferencesRoutes(app, {
      preferences: deps.store.preferences,
      logger: log,
    });
    registerLibraryRoutes(app, { bridge: deps.bridge, cache, logger: log });
    await Promise.resolve();
  };

  return {
    connectionHandler,
    plugin,
    hubs,
    relay,
    cache,
    close(): Promise<void> {
      relay.close();
      cache.close();
      return Promise.resolve();
    },
  };
}
