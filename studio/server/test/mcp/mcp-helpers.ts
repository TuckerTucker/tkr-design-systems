/**
 * Shared helpers for the mcp-bridge test suites — real configuration
 * resolution (the same seam production uses: repo-root .mcp.json) and
 * polling utilities for subprocess/state assertions. Per the testing
 * policy, the design-systems MCP server is never mocked here.
 */
import { resolveConfig } from "../../src/config/resolve-config.js";
import {
  bridgeConfigFromStudioConfig,
  type BridgeConfig,
} from "../../src/mcp/bridge.js";
import type { StudioConfig } from "../../src/config/types.js";
import type { CapturedLogger } from "../helpers.js";

/** Resolved real studio config — .mcp.json launch command, repo root. */
export function realStudioConfig(): StudioConfig {
  const resolved = resolveConfig({});
  if (!resolved.ok) {
    throw new Error(
      `Real studio config did not resolve: ${JSON.stringify(resolved.errors)}`,
    );
  }
  return resolved.config;
}

/** BridgeConfig pointing at the REAL design-systems MCP server. */
export function realBridgeConfig(
  overrides: Partial<BridgeConfig> = {},
): BridgeConfig {
  const base = bridgeConfigFromStudioConfig(realStudioConfig());
  return { ...base, ...overrides };
}

/** Poll until `condition` is true; throws after `timeoutMs`. */
export async function waitFor(
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

/** True when no process with `pid` exists anymore. */
export function processGone(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return false;
  } catch {
    return true;
  }
}

/**
 * The MCP server subprocess pid, read from the transport's structured
 * "connected and verified" log line (the captured pino stream is the
 * production logging path — no test-only plumbing on the bridge).
 */
export function subprocessPidFromLogs(captured: CapturedLogger): number {
  const lines = captured
    .lines()
    .filter((line) => line["msg"] === "mcp server connected and verified");
  const last = lines[lines.length - 1];
  if (last === undefined || typeof last["pid"] !== "number") {
    throw new Error("No 'mcp server connected and verified' log line with a pid");
  }
  return last["pid"];
}
