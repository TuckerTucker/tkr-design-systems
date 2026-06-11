/**
 * Stdio transport wiring — spawns the design-systems MCP server subprocess
 * from the configured launch command (per repo-root .mcp.json semantics:
 * command + repo-root-relative args, cwd pinned to the repo root), completes
 * the MCP initialize handshake, verifies the six direct-call tools are
 * served, and pipes subprocess stderr into pino.
 *
 * The subprocess environment is the SDK's minimal default environment —
 * ANTHROPIC_API_KEY is never passed to the bridge's MCP server (only the
 * Agent SDK needs it, on its own connection).
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

import type { BridgeConfig } from "./bridge.js";
import type { Logger } from "../logging/create-logger.js";

/** The six tools this bridge serves — its entire MCP surface. */
export const DIRECT_CALL_TOOLS = [
  "ds_list_systems",
  "ds_load_system",
  "ds_get_rulebook",
  "ds_check_compliance",
  "wf_get_tokens",
  "wf_read_component",
] as const;

export type DirectCallTool = (typeof DIRECT_CALL_TOOLS)[number];

/**
 * Which required direct-call tools are absent from a server's tool list.
 * Pure — unit-testable without a connection.
 */
export function missingDirectCallTools(served: string[]): string[] {
  const have = new Set(served);
  return DIRECT_CALL_TOOLS.filter((tool) => !have.has(tool));
}

/** A live, handshaken connection to the MCP server subprocess. */
export interface BridgeConnection {
  /** Subprocess pid (null only if the process is already gone). */
  pid: number | null;
  /** Invoke one tool; rejections are translated by the caller. */
  callTool(
    tool: string,
    args: Record<string, unknown>,
    signal: AbortSignal,
    timeoutMs: number,
  ): Promise<unknown>;
  /** Deliberate close — terminates the subprocess, suppresses crash hooks. */
  close(): Promise<void>;
  /** Fired once if the transport closes without close() being called. */
  setOnUnexpectedClose(handler: () => void): void;
}

/** SDK request timeout backstop margin over the bridge's own timer. */
const SDK_TIMEOUT_MARGIN_MS = 5_000;

function pipeStderrToLogger(
  stderr: Pick<NodeJS.EventEmitter, "on">,
  logger: Logger,
): void {
  let buffered = "";
  stderr.on("data", (chunk: Buffer | string) => {
    buffered += chunk.toString();
    let newline = buffered.indexOf("\n");
    while (newline !== -1) {
      const line = buffered.slice(0, newline).trimEnd();
      buffered = buffered.slice(newline + 1);
      if (line !== "") {
        logger.debug({ stream: "stderr", line }, "mcp server stderr");
      }
      newline = buffered.indexOf("\n");
    }
  });
}

/**
 * Spawn the MCP server and complete the handshake. Throws on spawn or
 * handshake failure, and when any required direct-call tool is missing —
 * the supervisor translates throws into bridge state, so nothing above it
 * ever sees an exception.
 */
export async function openBridgeConnection(
  config: BridgeConfig,
  logger: Logger,
): Promise<BridgeConnection> {
  const log = logger.child({ subsystem: "transport" });

  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args,
    cwd: config.cwd,
    env: getDefaultEnvironment(),
    stderr: "pipe",
  });

  // The PassThrough stream exists before start(), so no early stderr is lost.
  const stderr = transport.stderr;
  if (stderr !== null) {
    pipeStderrToLogger(stderr, log);
  }

  const client = new Client(
    { name: "studio-mcp-bridge", version: "0.1.0" },
    { capabilities: {} },
  );

  try {
    await client.connect(transport);
  } catch (err) {
    await transport.close().catch(() => undefined);
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `MCP server handshake failed (${config.command} ${config.args.join(" ")}): ${detail}`,
    );
  }

  let served: string[];
  try {
    const toolList = await client.listTools();
    served = toolList.tools.map((tool) => tool.name);
  } catch (err) {
    await client.close().catch(() => undefined);
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`MCP server tool listing failed: ${detail}`);
  }

  const missing = missingDirectCallTools(served);
  if (missing.length > 0) {
    await client.close().catch(() => undefined);
    throw new Error(
      `MCP server is missing required direct-call tools: ${missing.join(", ")}. ` +
        `Check that ${config.args.join(" ")} is the design-systems MCP server.`,
    );
  }

  log.info(
    { pid: transport.pid, tools: served.length },
    "mcp server connected and verified",
  );

  let expectedClose = false;
  let unexpectedCloseHandler: (() => void) | undefined;
  let closeNotified = false;

  // client.onclose survives the Protocol's own transport hook installation.
  client.onclose = (): void => {
    if (expectedClose || closeNotified) {
      return;
    }
    closeNotified = true;
    log.warn({ pid: transport.pid }, "mcp server transport closed unexpectedly");
    unexpectedCloseHandler?.();
  };
  client.onerror = (err): void => {
    log.warn({ err: err.message }, "mcp transport error");
  };

  return {
    get pid(): number | null {
      return transport.pid;
    },
    async callTool(tool, args, signal, timeoutMs) {
      return client.callTool({ name: tool, arguments: args }, CallToolResultSchema, {
        signal,
        // The bridge's own timer is authoritative; the SDK timeout is only a
        // backstop so it never fires first.
        timeout: timeoutMs + SDK_TIMEOUT_MARGIN_MS,
      });
    },
    async close() {
      expectedClose = true;
      const pid = transport.pid;
      await client.close().catch((err: unknown) => {
        log.warn(
          { err: err instanceof Error ? err.message : String(err) },
          "error while closing mcp transport",
        );
      });
      log.info({ pid }, "mcp server connection closed");
    },
    setOnUnexpectedClose(handler) {
      unexpectedCloseHandler = handler;
    },
  };
}
