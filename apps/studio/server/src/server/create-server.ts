/**
 * buildServer — the IoC composition point for the studio process.
 *
 * Dependencies (config, logger, status registry, optional WS handler) are
 * injected, never constructed here, so later waves compose their pieces in
 * and tests substitute stubs. Fastify receives the shared pino instance as
 * `loggerInstance`, so HTTP request logs and capability logs share one
 * stream, level, and redaction; every HTTP request log carries a UUID
 * `requestId`.
 */
import { randomUUID } from "node:crypto";
import Fastify, {
  type FastifyBaseLogger,
  type FastifyInstance,
} from "fastify";

import type { StudioConfig } from "../config/types.js";
import { registerHealthRoute } from "../health/health-route.js";
import type { StatusRegistry } from "../health/status-registry.js";
import type { Logger } from "../logging/create-logger.js";
import { registerClientHosting } from "../static/client-hosting.js";
import {
  createConnectionGateway,
  type WsConnectionHandler,
} from "../ws/connection-gateway.js";
import {
  createLifecycle,
  type ExitFn,
} from "./lifecycle.js";

export interface ServerDependencies {
  config: StudioConfig;
  logger: Logger;
  statusRegistry: StatusRegistry;
  /** studio-api registers the handler that owns message semantics (Wave 4). */
  connectionHandler?: WsConnectionHandler;
  /** Tuning knobs — tests shrink these; production uses the defaults. */
  options?: {
    heartbeatIntervalMs?: number;
    shutdownDeadlineMs?: number;
    /** Injected exit for the shutdown-deadline force-exit path. */
    exit?: ExitFn;
  };
}

export interface StudioServer {
  app: FastifyInstance;
  /** Listen on config.host:config.port (127.0.0.1 only). */
  start(): Promise<void>;
  /** Graceful shutdown; idempotent — concurrent callers share one run. */
  shutdown(reason: string): Promise<void>;
  /** Hooks run in reverse registration order during shutdown. */
  registerShutdownHook(name: string, hook: () => Promise<void>): void;
  /** 0 unless a completed shutdown recorded failures; consumed by signal handling. */
  shutdownExitCode(): number;
}

export function buildServer(deps: ServerDependencies): StudioServer {
  const { config, logger, statusRegistry, connectionHandler, options } = deps;

  // Type the injected pino instance as FastifyBaseLogger so the Fastify
  // generic stays at its default — pino's Logger is a superset.
  const app = Fastify({
    loggerInstance: logger as FastifyBaseLogger,
    genReqId: () => randomUUID(),
    requestIdLogLabel: "requestId",
  });

  registerHealthRoute(app, { statusRegistry });

  const gateway = createConnectionGateway({
    logger: logger.child({ component: "ws-gateway" }),
    handler: connectionHandler,
    heartbeatIntervalMs: options?.heartbeatIntervalMs,
  });
  app.register(gateway.plugin);

  registerClientHosting(app, {
    clientDistDir: config.clientDistDir,
    logger,
  });

  const lifecycle = createLifecycle({
    app,
    logger,
    gateway,
    deadlineMs: options?.shutdownDeadlineMs,
    exit: options?.exit,
  });

  return {
    app,

    async start(): Promise<void> {
      try {
        await app.listen({ host: config.host, port: config.port });
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
          logger.fatal(
            {
              port: config.port,
              host: config.host,
              fix: "set STUDIO_PORT to a free port between 1024 and 65535 and restart",
            },
            `port ${config.port} is already in use`,
          );
        }
        throw err;
      }
    },

    shutdown: (reason) => lifecycle.shutdown(reason),
    registerShutdownHook: (name, hook) =>
      lifecycle.registerShutdownHook(name, hook),
    shutdownExitCode: () => lifecycle.exitCode(),
  };
}
