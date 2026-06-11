/**
 * studio-api test composition — a FULL real server per the testing policy:
 * real Fastify instance on an ephemeral port, real workspace-store temp
 * directory, real artifact-pipeline, real mcp-bridge against the actual
 * design-systems MCP server (wrapped in a call counter — still the real
 * bridge underneath, never a mock), and the agent SessionManager driven by
 * either the scripted AgentRuntime fake (keyless) or the real SDK runtime
 * (keyed suites).
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import WebSocket from "ws";

import type {
  ClientMessage,
  ServerMessage,
  StoreResult,
} from "@studio/contract";

import {
  agentConfigFromStudioConfig,
  createAgentSessionManager,
  createAuthManager,
  type AgentRuntime,
  type AuthManager,
  type SessionManager,
} from "../../src/agent/index.js";
import { createStudioApi, type StudioApi } from "../../src/api/plugin.js";
import {
  createArtifactPipeline,
  createStoreVersionFileResolver,
  type ArtifactPipeline,
} from "../../src/artifact-pipeline/index.js";
import { createMcpBridge, type McpBridge } from "../../src/mcp/index.js";
import { createStatusRegistry } from "../../src/health/status-registry.js";
import { createWorkspaceStore, type WorkspaceStoreHandle } from "../../src/store/index.js";
import { buildServer, type StudioServer } from "../../src/server/create-server.js";
import {
  createScriptedRuntime,
  TEST_API_KEY,
  type Script,
  type ScriptedRuntime,
  type ScriptStep,
} from "../agent/agent-helpers.js";
import {
  baseUrl,
  boundPort,
  captureLogger,
  makeTempDir,
  testConfig,
  type CapturedLogger,
} from "../helpers.js";
import { realBridgeConfig } from "../mcp/mcp-helpers.js";
import {
  SWISS_DASHBOARD_SPEC,
  SWISS_DASHBOARD_SVG,
} from "../artifact-pipeline/pipeline-helpers.js";

export { TEST_API_KEY } from "../agent/agent-helpers.js";

// ── Bridge call counting (the real bridge, observed) ──

export interface CountingBridge extends McpBridge {
  /** Tool wrapper invocations by method name. */
  calls: Record<string, number>;
}

export function countingBridge(inner: McpBridge): CountingBridge {
  const calls: Record<string, number> = {};
  function count(name: string): void {
    calls[name] = (calls[name] ?? 0) + 1;
  }
  return {
    calls,
    start: () => inner.start(),
    stop: () => inner.stop(),
    status: () => inner.status(),
    onStatusChange: (listener) => inner.onStatusChange(listener),
    listSystems(opts) {
      count("listSystems");
      return inner.listSystems(opts);
    },
    loadSystem(params, opts) {
      count("loadSystem");
      return inner.loadSystem(params, opts);
    },
    getRulebook(params, opts) {
      count("getRulebook");
      return inner.getRulebook(params, opts);
    },
    checkCompliance(params, opts) {
      count("checkCompliance");
      return inner.checkCompliance(params, opts);
    },
    getTokens(params, opts) {
      count("getTokens");
      return inner.getTokens(params, opts);
    },
    readComponent(params, opts) {
      count("readComponent");
      return inner.readComponent(params, opts);
    },
    readComponents(params, opts) {
      count("readComponents");
      return inner.readComponents(params, opts);
    },
  };
}

// ── Server fixture ──

export interface ApiServerOptions {
  /** Scripted turns (ignored when `runtime` is supplied). */
  scripts?: Script[];
  /** Inject a runtime (the real SDK runtime in keyed suites). */
  runtime?: AgentRuntime;
  /** Auth environment; default carries the fake test key. */
  env?: NodeJS.ProcessEnv;
  /** Start the real MCP bridge (default false; library/compliance suites opt in). */
  startBridge?: boolean;
  /** Journal retention; resume tests shrink it. */
  journalCapacity?: number;
  /** Reuse a store root across restarts (persistence tests). */
  storeRoot?: string;
  /** Reuse a registry file (cache invalidation tests own its lifecycle). */
  registryPath?: string;
}

export interface ApiServerFixture {
  server: StudioServer;
  api: StudioApi;
  base: string;
  wsUrl: string;
  store: WorkspaceStoreHandle;
  storeRoot: string;
  stagingDir: string;
  pipeline: ArtifactPipeline;
  bridge: CountingBridge;
  sessions: SessionManager;
  auth: AuthManager;
  runtime: ScriptedRuntime;
  registryPath: string;
  log: CapturedLogger;
  close(): Promise<void>;
}

/** A registry copy the cache watcher can observe without touching the repo. */
export function makeTempRegistry(): string {
  const dir = makeTempDir("api-registry");
  const registryPath = path.join(dir, "registry.yaml");
  const realRegistry = path.join(
    realBridgeConfig().cwd,
    "systems",
    "registry.yaml",
  );
  copyFileSync(realRegistry, registryPath);
  return registryPath;
}

export async function startApiServer(
  options: ApiServerOptions = {},
): Promise<ApiServerFixture> {
  const log = captureLogger("debug");
  const storeRoot = options.storeRoot ?? path.join(makeTempDir("api-store"), "workspaces");
  const stagingDir = makeTempDir("api-staging");
  const registryPath = options.registryPath ?? makeTempRegistry();
  const config = testConfig({ workspacesDir: storeRoot });

  const store = createWorkspaceStore({ rootDir: storeRoot }, log.logger);
  const bridge = countingBridge(
    createMcpBridge(realBridgeConfig(), log.logger),
  );
  const env = options.env ?? { ANTHROPIC_API_KEY: TEST_API_KEY };
  const auth = createAuthManager({ repoRoot: config.repoRoot, env, logger: log.logger });
  const pipeline = createArtifactPipeline(
    {
      artifacts: store.artifacts,
      bridge,
      versionFiles: createStoreVersionFileResolver(storeRoot),
    },
    log.logger,
  );
  const scripted = createScriptedRuntime(options.scripts ?? []);
  const runtime = options.runtime ?? scripted;
  const agentConfig = {
    ...agentConfigFromStudioConfig(config, { stagingDir }),
    maxTurns: 24,
  };
  const sessions = createAgentSessionManager({
    transcripts: store.transcripts,
    ingest: (request) => pipeline.ingest(request),
    runtime,
    auth,
    config: agentConfig,
    logger: log.logger,
    workspaces: store.workspaces,
    versionFiles: createStoreVersionFileResolver(storeRoot),
    systems: {
      async list(): Promise<string[]> {
        const systems = await bridge.listSystems();
        return systems.ok ? systems.value.map((system) => system.id) : [];
      },
    },
  });

  const api = createStudioApi({
    store,
    pipeline,
    bridge,
    sessions,
    auth,
    registryPath,
    logger: log.logger,
    ...(options.journalCapacity !== undefined
      ? { journalCapacity: options.journalCapacity }
      : {}),
  });

  const statusRegistry = createStatusRegistry({ logger: log.logger });
  statusRegistry.register("store", () => store.status());
  statusRegistry.register("auth", () => auth.status());
  statusRegistry.register("bridge", async () => ({ status: bridge.status().state }));

  const server = buildServer({
    config,
    logger: log.logger,
    statusRegistry,
    connectionHandler: api.connectionHandler,
  });
  await server.app.register(api.plugin);

  if (options.startBridge === true) {
    await bridge.start();
  }
  await server.start();

  return {
    server,
    api,
    base: baseUrl(server),
    wsUrl: `ws://127.0.0.1:${boundPort(server)}/ws`,
    store,
    storeRoot,
    stagingDir,
    pipeline,
    bridge,
    sessions,
    auth,
    runtime: scripted,
    registryPath,
    log,
    async close(): Promise<void> {
      await server.shutdown("test complete");
      await sessions.disposeAll();
      await api.close();
      await bridge.stop();
    },
  };
}

// ── HTTP helpers ──

export async function http(
  base: string,
  method: string,
  route: string,
  body?: unknown,
): Promise<{ status: number; body: unknown; contentType: string | null }> {
  const response = await fetch(`${base}${route}`, {
    method,
    ...(body !== undefined
      ? {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const contentType = response.headers.get("content-type");
  const text = await response.text();
  const parsed =
    contentType !== null && contentType.includes("application/json") && text !== ""
      ? (JSON.parse(text) as unknown)
      : text;
  return { status: response.status, body: parsed, contentType };
}

// ── Typed WS test client ──

export interface TestWsClient {
  socket: WebSocket;
  /** Every parsed envelope, in arrival order. */
  events: ServerMessage[];
  send(message: ClientMessage): void;
  /**
   * Resolve with the next envelope (at or after the internal cursor)
   * matching the predicate; the cursor advances past the match.
   */
  waitFor(
    predicate: (event: ServerMessage) => boolean,
    what: string,
    timeoutMs?: number,
  ): Promise<ServerMessage>;
  waitForType<T extends ServerMessage["type"]>(
    type: T,
    timeoutMs?: number,
  ): Promise<Extract<ServerMessage, { type: T }>>;
  close(): void;
  terminate(): void;
}

export function connectWs(url: string): Promise<TestWsClient> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const events: ServerMessage[] = [];
    let cursor = 0;
    const waiters: Array<{
      predicate: (event: ServerMessage) => boolean;
      resolve: (event: ServerMessage) => void;
      from: number;
    }> = [];

    socket.on("message", (data) => {
      const event = JSON.parse(String(data)) as ServerMessage;
      events.push(event);
      for (let i = waiters.length - 1; i >= 0; i -= 1) {
        const waiter = waiters[i] as (typeof waiters)[number];
        for (let index = Math.max(waiter.from, cursor); index < events.length; index += 1) {
          const candidate = events[index] as ServerMessage;
          if (waiter.predicate(candidate)) {
            cursor = index + 1;
            waiters.splice(i, 1);
            waiter.resolve(candidate);
            break;
          }
        }
      }
    });

    function waitFor(
      predicate: (event: ServerMessage) => boolean,
      what: string,
      timeoutMs = 30_000,
    ): Promise<ServerMessage> {
      // Check already-arrived events first.
      for (let index = cursor; index < events.length; index += 1) {
        const candidate = events[index] as ServerMessage;
        if (predicate(candidate)) {
          cursor = index + 1;
          return Promise.resolve(candidate);
        }
      }
      return new Promise((resolveWait, rejectWait) => {
        const waiter = { predicate, resolve: resolveWait, from: cursor };
        waiters.push(waiter);
        setTimeout(() => {
          const index = waiters.indexOf(waiter);
          if (index !== -1) {
            waiters.splice(index, 1);
            rejectWait(
              new Error(
                `Timed out waiting for ${what}; received: ${events
                  .map((event) => event.type)
                  .join(", ")}`,
              ),
            );
          }
        }, timeoutMs);
      });
    }

    socket.on("open", () =>
      resolve({
        socket,
        events,
        send: (message) => socket.send(JSON.stringify(message)),
        waitFor,
        waitForType: <T extends ServerMessage["type"]>(
          type: T,
          timeoutMs?: number,
        ) =>
          waitFor(
            (event) => event.type === type,
            `a ${type} envelope`,
            timeoutMs,
          ) as Promise<Extract<ServerMessage, { type: T }>>,
        close: () => socket.close(1000, "test done"),
        terminate: () => socket.terminate(),
      }),
    );
    socket.on("error", reject);
  });
}

/** Attach and consume the two status snapshots that acknowledge it. */
export async function attachWorkspace(
  client: TestWsClient,
  workspaceId: string,
  options: { requestId?: string; lastEventSeq?: number } = {},
): Promise<void> {
  client.send({
    type: "workspace.attach",
    ...(options.requestId !== undefined ? { requestId: options.requestId } : {}),
    payload: {
      workspaceId,
      ...(options.lastEventSeq !== undefined
        ? { lastEventSeq: options.lastEventSeq }
        : {}),
    },
  });
  await client.waitForType("bridge.status");
  await client.waitForType("auth.status");
}

// ── Scripted turns over REAL fixture content ──

/**
 * A wf_generate turn whose output is the real swiss-dashboard fixture
 * (generated by the wireframe skill) — it survives the real pipeline's
 * sanitizer, spec parser, and the real compliance run.
 */
export function fixtureGenerationScript(
  stagingDir: string,
  opts: {
    system?: string;
    platform?: "mobile" | "desktop";
    layoutId?: string;
    brief?: string;
  } = {},
): Script {
  const system = opts.system ?? "swiss";
  const platform = opts.platform ?? "desktop";
  const layoutId = opts.layoutId ?? "dashboard";
  return (request) => {
    const outputDir = path.join(stagingDir, request.requestId);
    mkdirSync(outputDir, { recursive: true });
    const svgPath = path.join(outputDir, "wireframe.svg");
    const specPath = path.join(outputDir, "wireframe.spec.yaml");
    copyFileSync(SWISS_DASHBOARD_SVG, svgPath);
    copyFileSync(SWISS_DASHBOARD_SPEC, specPath);
    const input = {
      brief: opts.brief ?? "a dashboard",
      system,
      platform,
      layout_id: layoutId,
    };
    const steps: ScriptStep[] = [
      { type: "assistant_text", text: `Generating with the ${layoutId} layout in ${system}. ` },
      { type: "tool_started", toolUseId: "tu-generate", toolName: "wf_generate", input },
      {
        type: "tool_finished",
        toolUseId: "tu-generate",
        toolName: "wf_generate",
        input,
        ok: true,
        result: { ok: true, svg_path: svgPath, spec_path: specPath },
      },
      { type: "turn_completed" },
    ];
    return steps;
  };
}

/**
 * A two-pass substitution turn (wf_build_substitution_request →
 * wf_apply_substitutions) producing the fixture SVG with `find` replaced
 * by `replace` — the refinement step of the headless loop.
 */
export function fixtureSubstitutionScript(args: {
  find: string;
  replace: string;
}): Script {
  return () => {
    const svgText = readFileSync(SWISS_DASHBOARD_SVG, "utf8").replace(
      args.find,
      args.replace,
    );
    const passOneInput = { system_id: "swiss" };
    const passTwoInput = {
      system_id: "swiss",
      substitutions: [{ find: args.find, replace: args.replace }],
    };
    const steps: ScriptStep[] = [
      { type: "assistant_text", text: "Swapping the copy via substitution. " },
      {
        type: "tool_started",
        toolUseId: "tu-sub-1",
        toolName: "wf_build_substitution_request",
        input: passOneInput,
      },
      {
        type: "tool_finished",
        toolUseId: "tu-sub-1",
        toolName: "wf_build_substitution_request",
        input: passOneInput,
        ok: true,
        result: { ok: true, text_nodes: [{ find: args.find }] },
      },
      {
        type: "tool_started",
        toolUseId: "tu-sub-2",
        toolName: "wf_apply_substitutions",
        input: passTwoInput,
      },
      {
        type: "tool_finished",
        toolUseId: "tu-sub-2",
        toolName: "wf_apply_substitutions",
        input: passTwoInput,
        ok: true,
        result: { ok: true, svg_text: svgText },
      },
      { type: "turn_completed" },
    ];
    return steps;
  };
}

/** A turn that streams one delta then holds until cancelled. */
export function holdUntilCancelledScript(): Script {
  return [
    { type: "assistant_text", text: "Working on it… " },
    { type: "wait_for_abort" },
  ];
}

/** Touch a file so fs.watch observes a change. */
export function touchFile(filePath: string): void {
  const content = readFileSync(filePath, "utf8");
  writeFileSync(filePath, `${content}\n# touched ${Date.now()}\n`);
}

/** Unwrap an ok StoreResult or fail loudly. */
export function expectStoreOk<T>(result: StoreResult<T>, label = "result"): T {
  if (!result.ok) {
    throw new Error(`expected ok ${label}: ${result.error.code} ${result.error.message}`);
  }
  return result.value;
}

/**
 * Compliance runs are fire-and-forget after a landing — poll the pipeline
 * until the run settles (completed or unavailable) before asserting on it.
 */
export async function awaitCompliance(
  fixture: ApiServerFixture,
  workspaceId: string,
  artifactId: string,
  version: number,
  timeoutMs = 60_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const state = await fixture.pipeline.getCompliance(
      workspaceId,
      artifactId,
      version,
    );
    if (state.ok && state.value.status !== "pending") {
      return;
    }
    if (Date.now() > deadline) {
      throw new Error(
        `Timed out waiting for compliance of ${artifactId} v${version}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** Poll until `condition` holds. */
export async function waitUntil(
  condition: () => boolean,
  what: string,
  timeoutMs = 15_000,
  intervalMs = 25,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for ${what}`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
