/**
 * Slice 2 — SessionManager: one session per workspace (lazy create, reuse),
 * release disposes, disposeAll bounds shutdown to active workspaces.
 */
import { describe, expect, it } from "vitest";

import { createAgentSessionManager } from "../../src/agent/session-manager.js";
import { createAuthManager } from "../../src/agent/auth.js";
import { captureLogger, makeTempDir } from "../helpers.js";
import {
  collect,
  converseScript,
  createFakeIngest,
  createMemoryTranscripts,
  createScriptedRuntime,
  TEST_API_KEY,
} from "./agent-helpers.js";

function makeManager(): ReturnType<typeof createAgentSessionManager> {
  const { logger } = captureLogger();
  return createAgentSessionManager({
    transcripts: createMemoryTranscripts(),
    ingest: (request) => createFakeIngest().ingest(request),
    runtime: createScriptedRuntime([converseScript(), converseScript()]),
    auth: createAuthManager({
      repoRoot: makeTempDir("mgr-repo"),
      env: { ANTHROPIC_API_KEY: TEST_API_KEY },
      logger,
    }),
    config: {
      mcpLaunch: { command: "/usr/bin/env", args: [], cwd: makeTempDir("mgr") },
      stagingDir: makeTempDir("mgr-staging"),
    },
    logger,
  });
}

describe("SessionManager", () => {
  it("lazily creates one session per workspace and reuses it", async () => {
    const manager = makeManager();
    const a1 = await manager.acquire("workspace-a");
    const a2 = await manager.acquire("workspace-a");
    const b = await manager.acquire("workspace-b");
    expect(a1).toBe(a2);
    expect(b).not.toBe(a1);
    expect(a1.workspaceId).toBe("workspace-a");
  });

  it("release disposes the session; the next acquire creates a fresh one", async () => {
    const manager = makeManager();
    const first = await manager.acquire("workspace-a");
    await manager.release("workspace-a");
    const events = await collect(
      first.send({ requestId: "req-x", text: "hi" }),
    );
    expect(events[0]?.type).toBe("error");
    const second = await manager.acquire("workspace-a");
    expect(second).not.toBe(first);
  });

  it("disposeAll disposes every active session", async () => {
    const manager = makeManager();
    const a = await manager.acquire("workspace-a");
    const b = await manager.acquire("workspace-b");
    await manager.disposeAll();
    for (const session of [a, b]) {
      const events = await collect(
        session.send({ requestId: "req-x", text: "hi" }),
      );
      expect(events[0]?.type).toBe("error");
    }
  });
});
