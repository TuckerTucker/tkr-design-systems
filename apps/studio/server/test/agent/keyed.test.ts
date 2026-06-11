/**
 * Keyed suite — exercises the REAL Claude Agent SDK (and through it the
 * real design-systems MCP server) end to end. Skipped without
 * ANTHROPIC_API_KEY; the keyless suite covers every flow through the
 * scripted runtime instead.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createAuthManager } from "../../src/agent/auth.js";
import type { AgentConfig } from "../../src/agent/runtime.js";
import { createSdkAgentRuntime } from "../../src/agent/sdk-runtime.js";
import { createAgentSession } from "../../src/agent/session.js";
import { captureLogger, makeTempDir } from "../helpers.js";
import {
  collect,
  createFakeIngest,
  createMemoryTranscripts,
  createMemoryWorkspaces,
  eventTypes,
  findEvent,
  WORKSPACE_ID,
} from "./agent-helpers.js";

const HAS_KEY =
  process.env.ANTHROPIC_API_KEY !== undefined &&
  process.env.ANTHROPIC_API_KEY !== "";

const TURN_TIMEOUT_MS = 300_000;

/** The actual tkr-design-systems checkout (five levels up from this file). */
const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "..",
);

interface McpJson {
  mcpServers: Record<string, { command: string; args: string[] }>;
}

function realAgentConfig(): AgentConfig {
  const mcpJson = JSON.parse(
    readFileSync(path.join(REPO_ROOT, ".mcp.json"), "utf8"),
  ) as McpJson;
  const launch = mcpJson.mcpServers["tkr-design-systems"];
  if (launch === undefined) {
    throw new Error(".mcp.json has no tkr-design-systems entry");
  }
  return {
    mcpLaunch: { command: launch.command, args: launch.args, cwd: REPO_ROOT },
    stagingDir: makeTempDir("keyed-staging"),
    maxTurns: 24,
  };
}

describe.skipIf(!HAS_KEY)("keyed: real Agent SDK round-trips", () => {
  function makeRealSession(): {
    session: ReturnType<typeof createAgentSession>;
    ingest: ReturnType<typeof createFakeIngest>;
  } {
    const capture = captureLogger("info");
    const config = realAgentConfig();
    const auth = createAuthManager({
      repoRoot: REPO_ROOT,
      env: process.env,
      logger: capture.logger,
    });
    const ingest = createFakeIngest();
    const session = createAgentSession({
      workspaceId: WORKSPACE_ID,
      transcripts: createMemoryTranscripts(),
      workspaces: createMemoryWorkspaces(),
      ingest: (request) => ingest.ingest(request),
      runtime: createSdkAgentRuntime(config, capture.logger),
      auth,
      config,
      logger: capture.logger,
      systems: { list: () => Promise.resolve(["swiss", "terminal"]) },
    });
    return { session, ingest };
  }

  it(
    "completes a plain-conversation turn with streamed deltas and zero tool calls",
    async () => {
      const { session } = makeRealSession();
      const events = await collect(
        session.send({
          requestId: "keyed-converse",
          text: "In one short sentence, what is a wireframe? This is a plain question — do not call any tools.",
        }),
      );
      expect(eventTypes(events)[0]).toBe("message_started");
      expect(eventTypes(events).at(-1)).toBe("message_completed");
      expect(events.some((event) => event.type === "assistant_delta")).toBe(
        true,
      );
      const completed = findEvent(events, "message_completed");
      expect(completed?.routing.intent).toBe("converse");
    },
    TURN_TIMEOUT_MS,
  );

  it(
    "generates a real artifact through wf_generate to artifact_produced",
    async () => {
      const { session, ingest } = makeRealSession();
      const events = await collect(
        session.send({
          requestId: "keyed-generate",
          text: "wireframe a login screen in the swiss system, desktop platform",
        }),
      );
      const produced = findEvent(events, "artifact_produced");
      expect(produced).toBeDefined();
      expect(produced?.source.kind).toBe("paths");
      if (produced?.source.kind === "paths") {
        expect(existsSync(produced.source.svgPath)).toBe(true);
        expect(existsSync(produced.source.specPath)).toBe(true);
        expect(readFileSync(produced.source.svgPath, "utf8")).toContain("<svg");
      }
      expect(ingest.requests).toHaveLength(1);
      expect(eventTypes(events).at(-1)).toBe("message_completed");
    },
    TURN_TIMEOUT_MS,
  );
});
