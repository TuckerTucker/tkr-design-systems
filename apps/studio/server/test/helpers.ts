/**
 * Shared test composition helpers — real servers on ephemeral ports, a
 * capturing logger so log assertions run against actual pino output, and
 * temp-directory fixtures.
 */
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createLogger, type Logger } from "../src/logging/create-logger.js";
import type { LogLevel, StudioConfig } from "../src/config/types.js";
import type { StudioServer } from "../src/server/create-server.js";

export interface LogLine {
  [key: string]: unknown;
}

export interface CapturedLogger {
  logger: Logger;
  /** Parsed JSON log lines captured so far. */
  lines(): LogLine[];
  /** Raw captured output (for value-absence assertions like redaction). */
  raw(): string;
}

export function captureLogger(level: LogLevel = "info"): CapturedLogger {
  const chunks: string[] = [];
  const logger = createLogger(
    { logLevel: level },
    {
      write(chunk: string): void {
        chunks.push(chunk);
      },
    },
  );
  return {
    logger,
    lines: () =>
      chunks
        .join("")
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => JSON.parse(line) as LogLine),
    raw: () => chunks.join(""),
  };
}

/** Temp dir for a test; vitest workers each get their own prefix. */
export function makeTempDir(prefix: string): string {
  return mkdtempSync(path.join(tmpdir(), `${prefix}-`));
}

/**
 * Create a fixture repo root containing a valid .mcp.json and the MCP entry
 * script it points at.
 */
export function makeFixtureRepoRoot(): string {
  const root = makeTempDir("studio-repo");
  mkdirSync(path.join(root, "tools", "mcp-server"), {
    recursive: true,
  });
  writeFileSync(
    path.join(root, "tools", "mcp-server", "server.py"),
    "# fixture MCP server entry\n",
  );
  writeFileSync(
    path.join(root, ".mcp.json"),
    JSON.stringify(
      {
        mcpServers: {
          "tkr-design-systems": {
            command: "/usr/bin/env",
            args: ["tools/mcp-server/server.py"],
          },
        },
      },
      null,
      2,
    ),
  );
  return root;
}

/**
 * A complete StudioConfig for tests. Port 0 requests an ephemeral port —
 * resolveConfig would reject it from the environment, but tests compose
 * configs directly so parallel runs never collide.
 */
export function testConfig(overrides: Partial<StudioConfig> = {}): StudioConfig {
  const repoRoot = overrides.repoRoot ?? makeFixtureRepoRoot();
  return {
    repoRoot,
    mcpLaunch: {
      command: "/usr/bin/env",
      args: ["tools/mcp-server/server.py"],
      cwd: repoRoot,
    },
    workspacesDir: path.join(repoRoot, "apps", "studio", "workspaces"),
    clientDistDir: path.join(repoRoot, "apps", "studio", "client", "dist"),
    port: 0,
    host: "127.0.0.1",
    logLevel: "info",
    ...overrides,
  };
}

/** Bound base URL of a started server, e.g. "http://127.0.0.1:53121". */
export function baseUrl(server: StudioServer): string {
  const address = server.app.server.address();
  if (address === null || typeof address === "string") {
    throw new Error("server is not listening on a TCP port");
  }
  return `http://127.0.0.1:${address.port}`;
}

/** Bound port of a started server. */
export function boundPort(server: StudioServer): number {
  const address = server.app.server.address();
  if (address === null || typeof address === "string") {
    throw new Error("server is not listening on a TCP port");
  }
  return address.port;
}
