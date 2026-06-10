import { rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import {
  defaultRepoRoot,
  resolveConfig,
} from "../../src/config/resolve-config.js";
import type { ConfigError } from "../../src/config/types.js";
import { makeFixtureRepoRoot } from "../helpers.js";

const fixtureRoot = makeFixtureRepoRoot();

afterAll(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});

function envWith(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { STUDIO_REPO_ROOT: fixtureRoot, ...overrides };
}

function expectError(
  errors: ConfigError[] | undefined,
  field: string,
): ConfigError {
  const error = errors?.find((candidate) => candidate.field === field);
  expect(error, `expected a ConfigError for field "${field}"`).toBeDefined();
  expect(error?.message).toBeTruthy();
  expect(error?.fix).toBeTruthy();
  return error as ConfigError;
}

describe("resolveConfig defaults", () => {
  it("returns defaults with no STUDIO_* overrides", () => {
    const result = resolveConfig(envWith());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.port).toBe(4400);
    expect(result.config.logLevel).toBe("info");
    expect(result.config.workspacesDir).toBe(
      path.join(fixtureRoot, "studio", "workspaces"),
    );
    expect(result.config.clientDistDir).toBe(
      path.join(fixtureRoot, "studio", "client", "dist"),
    );
    expect(result.config.repoRoot).toBe(fixtureRoot);
  });

  it("derives the default repo root from the module location (the real checkout)", () => {
    expect(defaultRepoRoot()).toBe(
      path.resolve(import.meta.dirname, "..", "..", "..", ".."),
    );
  });

  it("reads command and args from .mcp.json and pins cwd to the repo root", () => {
    const result = resolveConfig(envWith());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.mcpLaunch).toEqual({
      command: "/usr/bin/env",
      args: ["design-systems/mcp-server/server.py"],
      cwd: fixtureRoot,
    });
  });

  it("always fixes host to 127.0.0.1 — no override path exists", () => {
    const result = resolveConfig(envWith({ STUDIO_HOST: "0.0.0.0" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.host).toBe("127.0.0.1");
  });
});

describe("resolveConfig env overrides", () => {
  it("applies STUDIO_PORT independently", () => {
    const result = resolveConfig(envWith({ STUDIO_PORT: "4500" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.port).toBe(4500);
    expect(result.config.logLevel).toBe("info");
  });

  it("applies STUDIO_LOG_LEVEL independently", () => {
    const result = resolveConfig(envWith({ STUDIO_LOG_LEVEL: "debug" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.logLevel).toBe("debug");
    expect(result.config.port).toBe(4400);
  });

  it("applies STUDIO_WORKSPACES_DIR independently", () => {
    const result = resolveConfig(
      envWith({ STUDIO_WORKSPACES_DIR: "/tmp/studio-ws" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.workspacesDir).toBe("/tmp/studio-ws");
    expect(result.config.clientDistDir).toBe(
      path.join(fixtureRoot, "studio", "client", "dist"),
    );
  });

  it("applies STUDIO_CLIENT_DIST independently", () => {
    const result = resolveConfig(
      envWith({ STUDIO_CLIENT_DIST: "/tmp/studio-dist" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.clientDistDir).toBe("/tmp/studio-dist");
  });

  it("applies STUDIO_REPO_ROOT (the fixture itself is the override)", () => {
    const result = resolveConfig({ STUDIO_REPO_ROOT: fixtureRoot });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.repoRoot).toBe(fixtureRoot);
  });
});

describe("resolveConfig validation failures", () => {
  it("rejects a non-numeric STUDIO_PORT with field, message, and fix", () => {
    const result = resolveConfig(envWith({ STUDIO_PORT: "banana" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const error = expectError(result.errors, "port");
    expect(error.message).toContain("banana");
    expect(error.fix).toContain("1024");
  });

  it("rejects an out-of-range STUDIO_PORT (below 1024)", () => {
    const result = resolveConfig(envWith({ STUDIO_PORT: "80" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expectError(result.errors, "port");
  });

  it("rejects an out-of-range STUDIO_PORT (above 65535)", () => {
    const result = resolveConfig(envWith({ STUDIO_PORT: "70000" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expectError(result.errors, "port");
  });

  it("rejects an unknown STUDIO_LOG_LEVEL", () => {
    const result = resolveConfig(envWith({ STUDIO_LOG_LEVEL: "loud" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const error = expectError(result.errors, "logLevel");
    expect(error.fix).toContain("info");
  });

  it("rejects a missing repo root", () => {
    const result = resolveConfig({ STUDIO_REPO_ROOT: "/nope/not-a-checkout" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expectError(result.errors, "repoRoot");
  });

  it("rejects a repo root without .mcp.json, naming the file path", () => {
    const bare = makeFixtureRepoRoot();
    rmSync(path.join(bare, ".mcp.json"));
    const result = resolveConfig({ STUDIO_REPO_ROOT: bare });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const error = expectError(result.errors, "mcpLaunch");
    expect(error.message).toContain(path.join(bare, ".mcp.json"));
    rmSync(bare, { recursive: true, force: true });
  });

  it("rejects unparseable .mcp.json", () => {
    const broken = makeFixtureRepoRoot();
    writeFileSync(path.join(broken, ".mcp.json"), "{ not json");
    const result = resolveConfig({ STUDIO_REPO_ROOT: broken });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expectError(result.errors, "mcpLaunch");
    rmSync(broken, { recursive: true, force: true });
  });

  it("rejects .mcp.json missing the tkr-design-systems entry, naming the key", () => {
    const wrongKey = makeFixtureRepoRoot();
    writeFileSync(
      path.join(wrongKey, ".mcp.json"),
      JSON.stringify({ mcpServers: { other: { command: "x", args: [] } } }),
    );
    const result = resolveConfig({ STUDIO_REPO_ROOT: wrongKey });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const error = expectError(result.errors, "mcpLaunch");
    expect(error.message).toContain("tkr-design-systems");
    expect(error.message).toContain(path.join(wrongKey, ".mcp.json"));
    rmSync(wrongKey, { recursive: true, force: true });
  });

  it("rejects an MCP entry script that does not exist (caught at startup, not first spawn)", () => {
    const moved = makeFixtureRepoRoot();
    rmSync(path.join(moved, "design-systems", "mcp-server", "server.py"));
    const result = resolveConfig({ STUDIO_REPO_ROOT: moved });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const error = expectError(result.errors, "mcpLaunch");
    expect(error.message).toContain("server.py");
    rmSync(moved, { recursive: true, force: true });
  });

  it("collects multiple errors in one pass", () => {
    const result = resolveConfig(
      envWith({ STUDIO_PORT: "banana", STUDIO_LOG_LEVEL: "loud" }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(2);
  });
});
