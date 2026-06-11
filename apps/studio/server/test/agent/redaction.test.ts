/**
 * Slice 1 — redaction: the ANTHROPIC_API_KEY value never appears in any
 * log line (pino redaction + by-construction key hygiene) nor in any
 * transcript payload, across a full generation turn.
 */
import path from "node:path";

import { describe, expect, it } from "vitest";

import { AUTH_REDACTION_PATHS } from "../../src/agent/auth.js";
import { captureLogger, makeTempDir } from "../helpers.js";
import {
  collect,
  generationScript,
  makeSessionFixture,
  TEST_API_KEY,
} from "./agent-helpers.js";

describe("API key redaction", () => {
  it("never leaks the key into logs or transcript payloads across a full turn", async () => {
    const outputDir = path.join(makeTempDir("redact-out"), "v1");
    const fixture = makeSessionFixture({
      scripts: [generationScript({ outputDir })],
    });

    await collect(
      fixture.session.send({
        requestId: "req-gen",
        text: "a dashboard for a meditation app",
      }),
    );

    // Sessions log at debug; the raw stream must not contain the key value.
    const raw = fixture.capture.raw();
    expect(raw.length).toBeGreaterThan(0);
    expect(raw).not.toContain(TEST_API_KEY);

    // Nor any persisted transcript payload.
    expect(JSON.stringify(fixture.transcripts.records)).not.toContain(
      TEST_API_KEY,
    );
  });

  it("the process logger redacts every documented auth path", () => {
    const capture = captureLogger("info");
    // Defense in depth: even if a log object carried the key under one of
    // the documented paths, the configured redaction censors it.
    capture.logger.info({ ANTHROPIC_API_KEY: TEST_API_KEY }, "direct");
    capture.logger.info({ env: { ANTHROPIC_API_KEY: TEST_API_KEY } }, "nested env");
    capture.logger.info({ options: { ANTHROPIC_API_KEY: TEST_API_KEY } }, "wildcard");
    const raw = capture.raw();
    expect(raw).not.toContain(TEST_API_KEY);
    expect(raw).toContain("[REDACTED]");
    // The documented paths stay in sync with what the suite exercises.
    expect(AUTH_REDACTION_PATHS).toContain("ANTHROPIC_API_KEY");
    expect(AUTH_REDACTION_PATHS).toContain("*.ANTHROPIC_API_KEY");
  });

  it("sanitizes secret-shaped keys out of persisted tool inputs", async () => {
    const { sanitizeToolInput } = await import("../../src/agent/transcript.js");
    const sanitized = sanitizeToolInput({
      brief: "a dashboard",
      api_key: "sk-leak",
      nested: { authorization: "Bearer x", layout_id: "dashboard" },
    });
    expect(sanitized).toEqual({
      brief: "a dashboard",
      nested: { layout_id: "dashboard" },
    });
  });
});
