/**
 * Configuration resolution: defaults → repo-root .mcp.json → STUDIO_* env
 * overrides → validation as a typed result. Never throws; every failure is
 * a ConfigError with field, message, and fix so the composition root can
 * report all of them and exit before binding.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  LOG_LEVELS,
  type ConfigError,
  type ConfigResult,
  type LogLevel,
  type McpLaunchConfig,
  type StudioConfig,
} from "./types.js";

const MCP_SERVER_KEY = "tkr-design-systems";
const DEFAULT_PORT = 4400;
const MIN_PORT = 1024;
const MAX_PORT = 65535;

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Default repo root, derived from this module's location: the module lives
 * at <repoRoot>/studio/server/{src|dist}/config, so the root is four
 * directories up — identical depth from source (tsx, vitest) and from the
 * compiled output.
 */
export function defaultRepoRoot(): string {
  return path.resolve(moduleDir, "..", "..", "..", "..");
}

interface McpJsonShape {
  mcpServers?: Record<string, { command?: unknown; args?: unknown }>;
}

function isDirectory(candidate: string): boolean {
  try {
    return statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

function resolveMcpLaunch(
  repoRoot: string,
  errors: ConfigError[],
): McpLaunchConfig | undefined {
  const mcpJsonPath = path.join(repoRoot, ".mcp.json");
  if (!existsSync(mcpJsonPath)) {
    errors.push({
      field: "mcpLaunch",
      message: `MCP launch definition not found: ${mcpJsonPath} does not exist`,
      fix: `Create ${mcpJsonPath} with an mcpServers["${MCP_SERVER_KEY}"] entry (command + args), or point STUDIO_REPO_ROOT at the checkout that has one`,
    });
    return undefined;
  }

  let parsed: McpJsonShape;
  try {
    parsed = JSON.parse(readFileSync(mcpJsonPath, "utf8")) as McpJsonShape;
  } catch (err) {
    errors.push({
      field: "mcpLaunch",
      message: `${mcpJsonPath} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      fix: `Repair the JSON syntax in ${mcpJsonPath}`,
    });
    return undefined;
  }

  const entry = parsed.mcpServers?.[MCP_SERVER_KEY];
  if (entry === undefined) {
    errors.push({
      field: "mcpLaunch",
      message: `${mcpJsonPath} has no mcpServers["${MCP_SERVER_KEY}"] entry`,
      fix: `Add mcpServers["${MCP_SERVER_KEY}"] with command and args to ${mcpJsonPath}`,
    });
    return undefined;
  }

  const { command, args } = entry;
  if (typeof command !== "string" || command.length === 0) {
    errors.push({
      field: "mcpLaunch",
      message: `mcpServers["${MCP_SERVER_KEY}"].command in ${mcpJsonPath} must be a non-empty string`,
      fix: `Set command to the MCP server executable (e.g. a python3 path) in ${mcpJsonPath}`,
    });
    return undefined;
  }

  if (
    !Array.isArray(args) ||
    !args.every((arg): arg is string => typeof arg === "string")
  ) {
    errors.push({
      field: "mcpLaunch",
      message: `mcpServers["${MCP_SERVER_KEY}"].args in ${mcpJsonPath} must be an array of strings`,
      fix: `Set args to the MCP server script and its arguments (repo-root-relative paths) in ${mcpJsonPath}`,
    });
    return undefined;
  }

  // Catch a moved/missing entry script at startup, not at first bridge spawn.
  const entryScript = args[0];
  if (entryScript !== undefined) {
    const scriptPath = path.isAbsolute(entryScript)
      ? entryScript
      : path.resolve(repoRoot, entryScript);
    if (!existsSync(scriptPath)) {
      errors.push({
        field: "mcpLaunch",
        message: `MCP entry script ${scriptPath} (from mcpServers["${MCP_SERVER_KEY}"].args[0]) does not exist`,
        fix: `Restore the script or update args in ${mcpJsonPath} to its current repo-root-relative path`,
      });
      return undefined;
    }
  }

  return { command, args, cwd: repoRoot };
}

function resolvePort(raw: string | undefined, errors: ConfigError[]): number {
  if (raw === undefined) {
    return DEFAULT_PORT;
  }
  const port = /^\d+$/.test(raw) ? Number.parseInt(raw, 10) : Number.NaN;
  if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
    errors.push({
      field: "port",
      message: `STUDIO_PORT value "${raw}" is not a valid port`,
      fix: `Set STUDIO_PORT to an integer between ${MIN_PORT} and ${MAX_PORT}, or unset it for the default ${DEFAULT_PORT}`,
    });
    return DEFAULT_PORT;
  }
  return port;
}

function resolveLogLevel(
  raw: string | undefined,
  errors: ConfigError[],
): LogLevel {
  if (raw === undefined) {
    return "info";
  }
  if ((LOG_LEVELS as readonly string[]).includes(raw)) {
    return raw as LogLevel;
  }
  errors.push({
    field: "logLevel",
    message: `STUDIO_LOG_LEVEL value "${raw}" is not a known pino level`,
    fix: `Set STUDIO_LOG_LEVEL to one of: ${LOG_LEVELS.join(", ")}, or unset it for the default "info"`,
  });
  return "info";
}

/**
 * Resolve and validate the studio configuration from the given environment.
 *
 * @param env - Environment to read STUDIO_* overrides from (injected for
 *   testability; the composition root passes process.env).
 * @returns Typed result — either the validated config or every ConfigError
 *   found, so the operator can fix all of them in one pass.
 */
export function resolveConfig(env: NodeJS.ProcessEnv): ConfigResult {
  const errors: ConfigError[] = [];

  const repoRoot =
    env.STUDIO_REPO_ROOT !== undefined && env.STUDIO_REPO_ROOT !== ""
      ? path.resolve(env.STUDIO_REPO_ROOT)
      : defaultRepoRoot();

  let mcpLaunch: McpLaunchConfig | undefined;
  if (!isDirectory(repoRoot)) {
    errors.push({
      field: "repoRoot",
      message: `Repo root ${repoRoot} does not exist or is not a directory`,
      fix: "Set STUDIO_REPO_ROOT to the absolute path of the tkr-design-systems checkout, or unset it to derive the root from the server's install location",
    });
  } else {
    mcpLaunch = resolveMcpLaunch(repoRoot, errors);
  }

  const workspacesDir =
    env.STUDIO_WORKSPACES_DIR !== undefined && env.STUDIO_WORKSPACES_DIR !== ""
      ? path.resolve(env.STUDIO_WORKSPACES_DIR)
      : path.join(repoRoot, "studio", "workspaces");

  const clientDistDir =
    env.STUDIO_CLIENT_DIST !== undefined && env.STUDIO_CLIENT_DIST !== ""
      ? path.resolve(env.STUDIO_CLIENT_DIST)
      : path.join(repoRoot, "studio", "client", "dist");

  const port = resolvePort(env.STUDIO_PORT, errors);
  const logLevel = resolveLogLevel(env.STUDIO_LOG_LEVEL, errors);

  if (errors.length > 0 || mcpLaunch === undefined) {
    return { ok: false, errors };
  }

  const config: StudioConfig = {
    repoRoot,
    mcpLaunch,
    workspacesDir,
    clientDistDir,
    port,
    host: "127.0.0.1",
    logLevel,
  };
  return { ok: true, config };
}
