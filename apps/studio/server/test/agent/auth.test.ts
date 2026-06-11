/**
 * Slice 1 — API key resolution and auth status: resolution order (process
 * env wins over studio/.env), dotenv parsing without global env mutation,
 * invalid-file degradation, status provider mapping, and invalid-key
 * tracking.
 */
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  ANTHROPIC_API_KEY_VAR,
  createAuthManager,
  dotEnvPath,
  parseDotEnv,
} from "../../src/agent/auth.js";
import { captureLogger, makeTempDir } from "../helpers.js";

function writeDotEnv(repoRoot: string, content: string): string {
  const filePath = dotEnvPath(repoRoot);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
  return filePath;
}

describe("parseDotEnv", () => {
  it("parses plain, exported, quoted, and commented assignments", () => {
    const parsed = parseDotEnv(
      [
        "# studio secrets",
        "",
        "ANTHROPIC_API_KEY=sk-plain",
        "export STUDIO_PORT=4400",
        'DOUBLE="quoted value"',
        "SINGLE='single value'",
        "TRAILING=value # trailing comment",
        "NOT A LINE",
        "=novalue",
      ].join("\n"),
    );
    expect(parsed.get("ANTHROPIC_API_KEY")).toBe("sk-plain");
    expect(parsed.get("STUDIO_PORT")).toBe("4400");
    expect(parsed.get("DOUBLE")).toBe("quoted value");
    expect(parsed.get("SINGLE")).toBe("single value");
    expect(parsed.get("TRAILING")).toBe("value");
    expect(parsed.size).toBe(5);
  });
});

describe("auth resolution", () => {
  it("prefers the process environment over studio/.env", async () => {
    const repoRoot = makeTempDir("auth-repo");
    writeDotEnv(repoRoot, "ANTHROPIC_API_KEY=sk-from-dotenv\n");
    const { logger } = captureLogger();
    const auth = createAuthManager({
      repoRoot,
      env: { [ANTHROPIC_API_KEY_VAR]: "sk-from-env" },
      logger,
    });
    const state = await auth.resolve();
    expect(state).toEqual({ status: "configured", source: "env" });
    expect(auth.apiKey()).toBe("sk-from-env");
  });

  it("falls back to studio/.env without mutating the environment", async () => {
    const repoRoot = makeTempDir("auth-repo");
    writeDotEnv(repoRoot, "ANTHROPIC_API_KEY=sk-from-dotenv\n");
    const { logger } = captureLogger();
    const env: NodeJS.ProcessEnv = {};
    const auth = createAuthManager({ repoRoot, env, logger });
    const state = await auth.resolve();
    expect(state).toEqual({ status: "configured", source: "dotenv" });
    expect(auth.apiKey()).toBe("sk-from-dotenv");
    // Parsed, never loaded: neither the injected env nor process.env gained it.
    expect(env[ANTHROPIC_API_KEY_VAR]).toBeUndefined();
    expect(process.env[ANTHROPIC_API_KEY_VAR] ?? "").not.toBe("sk-from-dotenv");
  });

  it("reports missing when neither source has the key", async () => {
    const repoRoot = makeTempDir("auth-repo");
    const { logger } = captureLogger();
    const auth = createAuthManager({ repoRoot, env: {}, logger });
    expect(await auth.resolve()).toEqual({ status: "missing", source: null });
    expect(auth.apiKey()).toBeNull();
  });

  it("treats a studio/.env without the key line as missing, not invalid", async () => {
    const repoRoot = makeTempDir("auth-repo");
    writeDotEnv(repoRoot, "STUDIO_PORT=4400\n# no key here\n");
    const { logger } = captureLogger();
    const auth = createAuthManager({ repoRoot, env: {}, logger });
    expect(await auth.resolve()).toEqual({ status: "missing", source: null });
  });

  it("treats an empty key value as missing", async () => {
    const repoRoot = makeTempDir("auth-repo");
    writeDotEnv(repoRoot, "ANTHROPIC_API_KEY=\n");
    const { logger } = captureLogger();
    const auth = createAuthManager({ repoRoot, env: {}, logger });
    expect(await auth.resolve()).toEqual({ status: "missing", source: null });
  });

  it("degrades to missing (with a warning) when studio/.env is unreadable", async () => {
    const repoRoot = makeTempDir("auth-repo");
    const filePath = writeDotEnv(repoRoot, "ANTHROPIC_API_KEY=sk-unreadable\n");
    chmodSync(filePath, 0o000);
    const capture = captureLogger("warn");
    const auth = createAuthManager({ repoRoot, env: {}, logger: capture.logger });
    try {
      expect(await auth.resolve()).toEqual({ status: "missing", source: null });
      expect(capture.raw()).toContain("could not be read");
    } finally {
      chmodSync(filePath, 0o600);
    }
  });

  it("picks up a key added to studio/.env while running (re-resolution)", async () => {
    const repoRoot = makeTempDir("auth-repo");
    const { logger } = captureLogger();
    const auth = createAuthManager({ repoRoot, env: {}, logger });
    expect((await auth.resolve()).status).toBe("missing");
    writeDotEnv(repoRoot, "ANTHROPIC_API_KEY=sk-added-later\n");
    expect(await auth.resolve()).toEqual({ status: "configured", source: "dotenv" });
  });
});

describe("invalid-key tracking", () => {
  it("flips to invalid on markInvalid and recovers when the key changes", async () => {
    const repoRoot = makeTempDir("auth-repo");
    const { logger } = captureLogger();
    const env: NodeJS.ProcessEnv = { [ANTHROPIC_API_KEY_VAR]: "sk-bad" };
    const auth = createAuthManager({ repoRoot, env, logger });
    await auth.resolve();
    auth.markInvalid();
    expect(auth.state().status).toBe("invalid");
    // Same key keeps resolving invalid.
    expect((await auth.resolve()).status).toBe("invalid");
    // A replaced key resolves configured again.
    env[ANTHROPIC_API_KEY_VAR] = "sk-replacement";
    expect((await auth.resolve()).status).toBe("configured");
  });
});

describe("status provider", () => {
  it("maps the three states onto StatusReport with actionable detail", async () => {
    const repoRoot = makeTempDir("auth-repo");
    const { logger } = captureLogger();
    const env: NodeJS.ProcessEnv = {};
    const auth = createAuthManager({ repoRoot, env, logger });

    const missing = await auth.status();
    expect(missing.status).toBe("missing");
    expect(missing.detail).toContain("studio/.env");

    env[ANTHROPIC_API_KEY_VAR] = "sk-now-set";
    const configured = await auth.status();
    expect(configured.status).toBe("configured");
    expect(configured.detail).toContain("process environment");
    // The detail never carries the key value.
    expect(configured.detail).not.toContain("sk-now-set");

    auth.markInvalid();
    const invalid = await auth.status();
    expect(invalid.status).toBe("invalid");
    expect(invalid.detail).toContain("Replace it");
  });
});
