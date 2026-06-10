/**
 * Typed configuration contract for the studio server.
 *
 * Resolution order: built-in defaults → repo-root .mcp.json (MCP launch
 * command) → STUDIO_* environment overrides. The host is deliberately a
 * literal type — the localhost binding is the security boundary of this
 * single-user local tool and has no override path.
 */

/** Launch definition for the design-systems MCP server, read from .mcp.json. */
export interface McpLaunchConfig {
  /** Executable, e.g. "/usr/local/bin/python3" (from .mcp.json). */
  command: string;
  /** Arguments, e.g. ["design-systems/mcp-server/server.py"]. */
  args: string[];
  /** Repo root — args are repo-root-relative, so spawns pin cwd here. */
  cwd: string;
}

export const LOG_LEVELS = [
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export interface StudioConfig {
  /** Absolute path to the tkr-design-systems checkout. */
  repoRoot: string;
  mcpLaunch: McpLaunchConfig;
  /** Default <repoRoot>/studio/workspaces; STUDIO_WORKSPACES_DIR override. */
  workspacesDir: string;
  /** Default <repoRoot>/studio/client/dist; STUDIO_CLIENT_DIST override. */
  clientDistDir: string;
  /** Default 4400; STUDIO_PORT override (integer 1024–65535). */
  port: number;
  /** Literal type — the binding is not configurable. */
  host: "127.0.0.1";
  /** Default "info"; STUDIO_LOG_LEVEL override. */
  logLevel: LogLevel;
}

/** One actionable configuration failure — what is wrong and how to fix it. */
export interface ConfigError {
  /** Offending field, e.g. "port" or "mcpLaunch". */
  field: string;
  /** What is wrong. */
  message: string;
  /** How to fix it, in place. */
  fix: string;
}

export type ConfigResult =
  | { ok: true; config: StudioConfig }
  | { ok: false; errors: ConfigError[] };
