/**
 * McpBridge — the studio server's direct-call MCP client for the
 * design-systems server, composed from the transport (spawn + handshake),
 * the supervisor (crash detection, backoff restart, state machine), the
 * call queue (FIFO serialization, timeout, cancellation), and the six
 * typed tool wrappers.
 *
 * IoC: consumers (artifact-pipeline, studio-api) receive the constructed
 * bridge via injection — this module exports a factory, never a singleton
 * instance. Configuration and the pino logger are injected; the launch
 * command comes from studio-server config (repo-root .mcp.json semantics),
 * never from user input.
 */
import type { BridgeResult, BridgeStatus, StatusReport } from "@studio/contract";

import { bridgeDownError, fail } from "./errors.js";
import { createCallQueue, type CallOptions } from "./queue.js";
import {
  createBridgeSupervisor,
  type RestartPolicy,
} from "./supervisor.js";
import { createToolWrappers, type McpBridgeTools } from "./tools.js";
import { openBridgeConnection } from "./transport.js";
import type { StudioConfig } from "../config/types.js";
import type { StatusProvider } from "../health/status-registry.js";
import type { Logger } from "../logging/create-logger.js";

/** Everything the bridge needs to spawn and supervise the MCP server. */
export interface BridgeConfig {
  /** Executable, e.g. "/usr/local/bin/python3" (from .mcp.json). */
  command: string;
  /** Arguments, e.g. ["design-systems/mcp-server/server.py"]. */
  args: string[];
  /** Repo root — the server.py path in .mcp.json is repo-root-relative. */
  cwd: string;
  /** Per-call timeout unless overridden via CallOptions.timeoutMs. */
  defaultTimeoutMs: number;
  restart: RestartPolicy;
}

/**
 * Default per-call timeout — generous enough for the heaviest direct call
 * (a full compliance run or a multi-component batch read) on a cold spec
 * cache, while still bounding a hung subprocess visibly.
 */
export const DEFAULT_BRIDGE_TIMEOUT_MS = 15_000;

/** Default restart backoff: 250ms → 500ms → 1s → 2s → 4s, then failed. */
export const DEFAULT_RESTART_POLICY: RestartPolicy = {
  maxAttempts: 5,
  initialDelayMs: 250,
  maxDelayMs: 5_000,
};

/**
 * Derive the bridge configuration from resolved studio-server config —
 * launch command straight from .mcp.json semantics (StudioConfig.mcpLaunch),
 * defaults for timeout and restart policy unless overridden.
 */
export function bridgeConfigFromStudioConfig(
  config: StudioConfig,
  overrides: Partial<Pick<BridgeConfig, "defaultTimeoutMs" | "restart">> = {},
): BridgeConfig {
  return {
    command: config.mcpLaunch.command,
    args: config.mcpLaunch.args,
    cwd: config.mcpLaunch.cwd,
    defaultTimeoutMs: overrides.defaultTimeoutMs ?? DEFAULT_BRIDGE_TIMEOUT_MS,
    restart: overrides.restart ?? DEFAULT_RESTART_POLICY,
  };
}

/**
 * The bridge seam — consumers receive this interface via injection and
 * never construct or import a shared instance.
 */
export interface McpBridge extends McpBridgeTools {
  /** Spawn + handshake + verify; resolves into "up" or "failed", never throws. */
  start(): Promise<void>;
  /** Terminate the subprocess and drain pending calls as bridge_down. */
  stop(): Promise<void>;
  status(): BridgeStatus;
  /** Subscribe to every state transition; returns the unsubscribe. */
  onStatusChange(listener: (status: BridgeStatus) => void): () => void;
}

/**
 * Construct the bridge from configuration alone (IoC seam).
 *
 * @param config - Launch command, timeout, and restart policy.
 * @param logger - pino logger; the bridge logs through a "bridge" child.
 */
export function createMcpBridge(config: BridgeConfig, logger: Logger): McpBridge {
  const log = logger.child({ component: "bridge" });

  const queue = createCallQueue({
    defaultTimeoutMs: config.defaultTimeoutMs,
    logger: log,
  });

  const supervisor = createBridgeSupervisor({
    connect: () => openBridgeConnection(config, log),
    restart: config.restart,
    logger: log,
    onConnectionChange: (connection) => {
      queue.setExecutor(
        connection === undefined
          ? undefined
          : (tool, args, signal, timeoutMs) =>
              connection.callTool(tool, args, signal, timeoutMs),
      );
    },
    onTerminal: (status) => {
      queue.drain(bridgeDownError(downMessage(status)));
    },
  });

  function downMessage(status: BridgeStatus): string {
    const reason =
      status.lastError !== undefined ? `: ${status.lastError}` : "";
    return `MCP bridge is ${status.state}${reason}`;
  }

  const invoke = (
    tool: string,
    args: Record<string, unknown>,
    opts?: CallOptions,
  ): Promise<BridgeResult<unknown>> => {
    const status = supervisor.status();
    if (status.state === "stopped" || status.state === "failed") {
      // Never dispatched, never queued — resolves immediately.
      return Promise.resolve(fail(bridgeDownError(downMessage(status))));
    }
    // starting/restarting: the call holds in the queue and dispatches on
    // "up", or drains as bridge_down if the bridge dies instead.
    return queue.submit(tool, args, opts);
  };

  const tools = createToolWrappers(invoke);

  return {
    ...tools,
    start: () => supervisor.start(),
    async stop() {
      // Drain before closing so pending calls settle bridge_down (the
      // close-triggered SDK rejection arrives later and is discarded).
      queue.drain(bridgeDownError("MCP bridge is stopping"));
      await supervisor.stop();
    },
    status: () => supervisor.status(),
    onStatusChange: (listener) => supervisor.onStatusChange(listener),
  };
}

/**
 * StatusProvider for the studio-server health registry: registered under
 * the "bridge" component, it projects BridgeStatus into the StatusReport
 * served on GET /api/health. Composition-root wiring:
 *
 *   registry.register("bridge", createBridgeStatusProvider(bridge));
 */
export function createBridgeStatusProvider(bridge: McpBridge): StatusProvider {
  return async (): Promise<StatusReport> => {
    const status = bridge.status();
    const parts: string[] = [];
    if (status.lastError !== undefined) {
      parts.push(status.lastError);
    }
    if (status.restartCount > 0) {
      parts.push(`restarts: ${status.restartCount}`);
    }
    return {
      status: status.state,
      ...(parts.length > 0 ? { detail: parts.join(" — ") } : {}),
    };
  };
}
