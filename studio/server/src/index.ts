/**
 * Composition root — the only file with import-time side effects.
 *
 * Sequence: load studio/.env → resolveConfig → createLogger →
 * createStatusRegistry → compose capabilities (store → bridge → pipeline →
 * auth → agent runtime/sessions → studio-api) → buildServer → register the
 * API plugin and status providers → install process handlers → start the
 * bridge → listen.
 *
 * Environment overrides (all optional):
 * - STUDIO_REPO_ROOT      repo checkout path (default: derived from install location)
 * - STUDIO_WORKSPACES_DIR workspace data dir (default: <repoRoot>/studio/workspaces)
 * - STUDIO_CLIENT_DIST    built client dir   (default: <repoRoot>/studio/client/dist)
 * - STUDIO_PORT           listen port        (default: 4400; 1024–65535)
 * - STUDIO_LOG_LEVEL      pino level         (default: info)
 * The host is always 127.0.0.1 — the localhost binding is the security
 * boundary and has no override.
 *
 * Run commands (from studio/): `npm run dev` (tsx), or `npm run build`
 * then `npm start` (compiled).
 */
import { existsSync } from "node:fs";
import path from "node:path";

import {
  agentConfigFromStudioConfig,
  createAgentSessionManager,
  createAuthManager,
  createSdkAgentRuntime,
} from "./agent/index.js";
import { createStudioApi } from "./api/plugin.js";
import {
  createArtifactPipeline,
  createStoreVersionFileResolver,
} from "./artifact-pipeline/index.js";
import { defaultRepoRoot, resolveConfig } from "./config/resolve-config.js";
import { createStatusRegistry } from "./health/status-registry.js";
import { createLogger } from "./logging/create-logger.js";
import {
  bridgeConfigFromStudioConfig,
  createBridgeStatusProvider,
  createMcpBridge,
} from "./mcp/index.js";
import { buildServer } from "./server/create-server.js";
import { installProcessHandlers } from "./server/lifecycle.js";
import { createWorkspaceStore } from "./store/index.js";

/**
 * Load <repoRoot>/studio/.env (gitignored; carries ANTHROPIC_API_KEY and
 * optional STUDIO_* overrides) before config resolution. Resolved against
 * the repo root, never the process working directory. Shell environment
 * wins: loadEnvFile does not overwrite existing variables.
 */
function loadDotEnv(): void {
  const repoRoot =
    process.env.STUDIO_REPO_ROOT !== undefined &&
    process.env.STUDIO_REPO_ROOT !== ""
      ? path.resolve(process.env.STUDIO_REPO_ROOT)
      : defaultRepoRoot();
  const envPath = path.join(repoRoot, "studio", ".env");
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
}

async function main(): Promise<void> {
  loadDotEnv();

  const result = resolveConfig(process.env);
  if (!result.ok) {
    // Config (and its log level) is unavailable — report with a default
    // logger and exit non-zero before binding. No partial start.
    const fallbackLogger = createLogger({ logLevel: "info" });
    for (const error of result.errors) {
      fallbackLogger.error(
        { field: error.field, fix: error.fix },
        error.message,
      );
    }
    fallbackLogger.fatal(
      { errorCount: result.errors.length },
      "invalid configuration; server not started",
    );
    process.exitCode = 1;
    return;
  }

  const { config } = result;
  const logger = createLogger(config);
  const statusRegistry = createStatusRegistry({
    logger: logger.child({ component: "status-registry" }),
  });

  // ── Capability composition (IoC: everything constructed here, injected
  // down; no capability imports another's instance) ──

  const store = createWorkspaceStore({ rootDir: config.workspacesDir }, logger);
  const bridge = createMcpBridge(bridgeConfigFromStudioConfig(config), logger);
  const auth = createAuthManager({ repoRoot: config.repoRoot, logger });

  const pipeline = createArtifactPipeline(
    {
      artifacts: store.artifacts,
      bridge,
      versionFiles: createStoreVersionFileResolver(config.workspacesDir),
    },
    logger,
  );

  const agentConfig = agentConfigFromStudioConfig(config);
  const sessions = createAgentSessionManager({
    transcripts: store.transcripts,
    ingest: (request) => pipeline.ingest(request),
    runtime: createSdkAgentRuntime(agentConfig, logger),
    auth,
    config: agentConfig,
    logger,
    workspaces: store.workspaces,
    versionFiles: createStoreVersionFileResolver(config.workspacesDir),
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
    registryPath: path.join(config.repoRoot, "systems", "registry.yaml"),
    logger,
  });

  statusRegistry.register("store", () => store.status());
  statusRegistry.register("bridge", createBridgeStatusProvider(bridge));
  statusRegistry.register("auth", () => auth.status());

  const server = buildServer({
    config,
    logger,
    statusRegistry,
    connectionHandler: api.connectionHandler,
  });
  await server.app.register(api.plugin);

  // Reverse registration order at shutdown: API teardown → agent sessions
  // → bridge subprocess.
  server.registerShutdownHook("mcp-bridge", () => bridge.stop());
  server.registerShutdownHook("agent-sessions", () => sessions.disposeAll());
  server.registerShutdownHook("studio-api", () => api.close());

  installProcessHandlers({
    control: {
      shutdown: (reason) => server.shutdown(reason),
      exitCode: () => server.shutdownExitCode(),
    },
    logger,
  });

  // Bring the bridge up before accepting traffic; a failed start degrades
  // (health and bridge.status report it) but never blocks the server.
  await bridge.start();

  try {
    await server.start();
  } catch {
    // start() already logged the structured failure (EADDRINUSE names the
    // STUDIO_PORT fix); exit non-zero without binding.
    process.exitCode = 1;
    return;
  }

  logger.info(
    {
      host: config.host,
      port: config.port,
      repoRoot: config.repoRoot,
      workspacesDir: config.workspacesDir,
      clientDistDir: config.clientDistDir,
      logLevel: config.logLevel,
    },
    "studio server listening",
  );
}

void main();
