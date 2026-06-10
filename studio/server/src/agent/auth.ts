/**
 * ANTHROPIC_API_KEY resolution and auth status — the only auth path.
 *
 * Resolution order (architecture.md, binding): process environment first,
 * then `<repoRoot>/studio/.env` (gitignored). The dotenv file is parsed
 * directly — never loaded into the global process environment — so the key
 * stays inside this module and the SDK subprocess env injection.
 *
 * claude.ai subscription login is OUT OF SCOPE: Anthropic policy prohibits
 * embedded SDK apps from offering it. The API key is the only auth path
 * (decided in product.yaml architecture_decisions).
 *
 * The key value is never logged: agent code never places it on log objects,
 * and the process logger (src/logging/create-logger.ts) redacts the paths in
 * AUTH_REDACTION_PATHS as defense in depth. AuthState exposes status and
 * source only — never key material.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { StatusReport } from "@studio/contract";

import type { Logger } from "../logging/create-logger.js";

export const ANTHROPIC_API_KEY_VAR = "ANTHROPIC_API_KEY";

/**
 * pino redaction paths every logger handling agent objects must cover.
 * createLogger already includes these; tests assert the coverage holds.
 */
export const AUTH_REDACTION_PATHS: readonly string[] = [
  "ANTHROPIC_API_KEY",
  "*.ANTHROPIC_API_KEY",
  "env.ANTHROPIC_API_KEY",
];

export type AuthStatus = "configured" | "missing" | "invalid";

/** Where the key was found; never the key itself. */
export interface AuthState {
  status: AuthStatus;
  source: "env" | "dotenv" | null;
}

/** The actionable keyless-degradation guidance, shown in place. */
export const KEYLESS_FIX =
  "Set ANTHROPIC_API_KEY in the process environment or in studio/.env " +
  "(gitignored), then send the message again. Library browsing, canvas " +
  "review, and compliance display keep working without a key.";

export const INVALID_KEY_FIX =
  "The configured ANTHROPIC_API_KEY was rejected by the Anthropic API. " +
  "Replace it in the process environment or in studio/.env, then retry.";

export interface AuthManagerOptions {
  /** Absolute path to the tkr-design-systems checkout (StudioConfig.repoRoot). */
  repoRoot: string;
  /** Environment to resolve from; defaults to process.env. */
  env?: NodeJS.ProcessEnv;
  logger: Logger;
}

/**
 * Auth seam injected into sessions and registered on the health surface.
 * resolve() re-reads the environment and studio/.env on every call, so a
 * key added while the server runs is picked up on the next message.
 */
export interface AuthManager {
  /** Re-resolve from env then studio/.env; updates and returns the state. */
  resolve(): Promise<AuthState>;
  /** Last resolved state (resolve() must have run at least once). */
  state(): AuthState;
  /**
   * The resolved key for SDK subprocess env injection — internal use only;
   * never logged, never serialized into events, transcripts, or files.
   */
  apiKey(): string | null;
  /** Mark the currently resolved key invalid (SDK authentication failure). */
  markInvalid(): void;
  /** Status provider for the StatusRegistry "auth" component. */
  status(): Promise<StatusReport>;
}

/**
 * Parse a dotenv document without mutating any environment. Supports
 * `KEY=value`, optional `export ` prefix, single/double quotes, full-line
 * and trailing comments on unquoted values, and blank lines.
 */
export function parseDotEnv(text: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }
    const withoutExport = line.startsWith("export ")
      ? line.slice("export ".length).trimStart()
      : line;
    const eq = withoutExport.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = withoutExport.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }
    let value = withoutExport.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    } else {
      const hash = value.indexOf(" #");
      if (hash !== -1) {
        value = value.slice(0, hash).trim();
      }
    }
    values.set(key, value);
  }
  return values;
}

/** Absolute path of the dotenv file: `<repoRoot>/studio/.env`. */
export function dotEnvPath(repoRoot: string): string {
  return path.join(repoRoot, "studio", ".env");
}

export function createAuthManager(options: AuthManagerOptions): AuthManager {
  const { repoRoot } = options;
  const env = options.env ?? process.env;
  const log = options.logger.child({ component: "agent-auth" });

  let current: AuthState = { status: "missing", source: null };
  let currentKey: string | null = null;
  /** Key value the SDK rejected; cleared when a different key resolves. */
  let invalidKey: string | null = null;

  async function readDotEnvKey(): Promise<string | null> {
    const filePath = dotEnvPath(repoRoot);
    let text: string;
    try {
      text = await readFile(filePath, "utf8");
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        // Present but unreadable/corrupt — degrade to missing, never crash.
        log.warn(
          { path: filePath, code },
          "studio/.env exists but could not be read; treating the key as missing",
        );
      }
      return null;
    }
    const key = parseDotEnv(text).get(ANTHROPIC_API_KEY_VAR);
    return key !== undefined && key !== "" ? key : null;
  }

  async function resolve(): Promise<AuthState> {
    const fromEnv = env[ANTHROPIC_API_KEY_VAR];
    let key: string | null = null;
    let source: AuthState["source"] = null;
    if (fromEnv !== undefined && fromEnv !== "") {
      key = fromEnv;
      source = "env";
    } else {
      key = await readDotEnvKey();
      source = key !== null ? "dotenv" : null;
    }

    if (key === null) {
      currentKey = null;
      current = { status: "missing", source: null };
    } else if (invalidKey !== null && key === invalidKey) {
      currentKey = key;
      current = { status: "invalid", source };
    } else {
      invalidKey = null;
      currentKey = key;
      current = { status: "configured", source };
    }
    log.debug(
      { status: current.status, source: current.source },
      "auth state resolved",
    );
    return current;
  }

  return {
    resolve,
    state: () => current,
    apiKey: () => currentKey,
    markInvalid(): void {
      if (currentKey !== null) {
        invalidKey = currentKey;
        current = { ...current, status: "invalid" };
        log.warn(
          { source: current.source },
          "ANTHROPIC_API_KEY rejected by the SDK; auth status is invalid",
        );
      }
    },
    async status(): Promise<StatusReport> {
      const state = await resolve();
      switch (state.status) {
        case "configured":
          return {
            status: "configured",
            detail:
              state.source === "env"
                ? "ANTHROPIC_API_KEY from the process environment"
                : "ANTHROPIC_API_KEY from studio/.env",
          };
        case "invalid":
          return { status: "invalid", detail: INVALID_KEY_FIX };
        case "missing":
          return { status: "missing", detail: KEYLESS_FIX };
      }
    },
  };
}
