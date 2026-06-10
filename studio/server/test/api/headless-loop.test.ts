/**
 * Headless conversational loop — the Phase 1 exit criterion: a scripted
 * client (real HTTP + real WS, built on @studio/contract, no UI) drives
 * brief → generate → chip re-run → refine (two-pass substitution) →
 * compliance → restore end to end.
 *
 * Two variants over shared scenario helpers:
 * - KEYLESS (runs everywhere): the agent runtime is the scripted fake from
 *   the agent suite; everything else is real — server, store, pipeline,
 *   bridge + actual design-systems MCP server (compliance runs for real),
 *   journal, relay. This proves the full protocol path without the SDK.
 * - KEYED (skipIf no ANTHROPIC_API_KEY): the real SDK runtime drives the
 *   same loop against the live agent.
 */
import { describe, expect, it } from "vitest";

import type {
  ArtifactDetail,
  ComplianceResponse,
  RestoreResponse,
  ServerMessage,
  WorkspaceSummary,
} from "@studio/contract";

import { createSdkAgentRuntime } from "../../src/agent/sdk-runtime.js";
import { agentConfigFromStudioConfig } from "../../src/agent/index.js";
import { captureLogger, makeTempDir } from "../helpers.js";
import { realStudioConfig } from "../mcp/mcp-helpers.js";
import {
  attachWorkspace,
  connectWs,
  fixtureGenerationScript,
  fixtureSubstitutionScript,
  http,
  startApiServer,
  type ApiServerFixture,
  type TestWsClient,
} from "./api-helpers.js";

const HAS_KEY =
  process.env.ANTHROPIC_API_KEY !== undefined &&
  process.env.ANTHROPIC_API_KEY !== "";

const KEYLESS_TIMEOUT_MS = 120_000;
const KEYED_TIMEOUT_MS = 600_000;

// ── Shared scenario helpers ──

interface TurnOutcome {
  events: ServerMessage[];
  messageId: string;
  artifactRefs: Array<{ artifactId: string; version: number }>;
}

/** Drive one chat.send turn to completion, collecting its event stream. */
async function runTurn(
  client: TestWsClient,
  requestId: string,
  text: string,
  timeoutMs: number,
): Promise<TurnOutcome> {
  const from = client.events.length;
  client.send({ type: "chat.send", requestId, payload: { text } });
  const completed = await client.waitFor(
    (event) =>
      event.type === "chat.message_completed" && event.requestId === requestId,
    `turn ${requestId} to complete`,
    timeoutMs,
  );
  if (completed.type !== "chat.message_completed") {
    throw new Error("unreachable");
  }
  return {
    events: client.events.slice(from),
    messageId: completed.payload.messageId,
    artifactRefs: completed.payload.artifactRefs,
  };
}

/** Assert the canonical generation stream shape and seq monotonicity. */
function expectGenerationStream(outcome: TurnOutcome): void {
  const types: string[] = outcome.events.map((event) => event.type);
  const indexOf = (type: string): number => types.indexOf(type);

  expect(indexOf("chat.message_started")).toBe(0);
  expect(indexOf("chat.tool_started")).toBeGreaterThan(0);
  expect(indexOf("chat.tool_finished")).toBeGreaterThan(indexOf("chat.tool_started"));
  expect(indexOf("artifact.version_created")).toBeGreaterThan(
    indexOf("chat.tool_started"),
  );
  expect(indexOf("chips.updated")).toBeGreaterThan(indexOf("artifact.version_created"));
  expect(types[types.length - 1]).toBe("chat.message_completed");

  // Monotonic seq across the whole stream.
  for (let i = 1; i < outcome.events.length; i += 1) {
    expect((outcome.events[i] as ServerMessage).seq).toBeGreaterThan(
      (outcome.events[i - 1] as ServerMessage).seq,
    );
  }
}

/**
 * Compliance settles asynchronously after a landing — observe its event
 * whether it arrived inside the turn stream or after it.
 */
async function awaitComplianceEvent(
  client: TestWsClient,
  version: number,
  timeoutMs: number,
): Promise<void> {
  const arrived = client.events.find(
    (event) =>
      event.type === "artifact.compliance_completed" &&
      event.payload.version === version,
  );
  if (arrived !== undefined) {
    return;
  }
  await client.waitFor(
    (event) =>
      event.type === "artifact.compliance_completed" &&
      event.payload.version === version,
    `compliance for version ${version}`,
    timeoutMs,
  );
}

async function fetchArtifactState(
  fixture: ApiServerFixture,
  wsId: string,
  artId: string,
  version: number,
): Promise<{
  detail: ArtifactDetail;
  svg: string;
  spec: Record<string, unknown>;
  compliance: ComplianceResponse;
}> {
  const detail = await http(
    fixture.base,
    "GET",
    `/api/workspaces/${wsId}/artifacts/${artId}`,
  );
  expect(detail.status).toBe(200);

  const svg = await http(
    fixture.base,
    "GET",
    `/api/workspaces/${wsId}/artifacts/${artId}/versions/${version}/svg`,
  );
  expect(svg.status).toBe(200);
  expect(svg.contentType).toContain("image/svg+xml");

  const spec = await http(
    fixture.base,
    "GET",
    `/api/workspaces/${wsId}/artifacts/${artId}/versions/${version}/spec`,
  );
  expect(spec.status).toBe(200);

  // Compliance settles asynchronously — poll the endpoint out of pending.
  let compliance = await http(
    fixture.base,
    "GET",
    `/api/workspaces/${wsId}/artifacts/${artId}/versions/${version}/compliance`,
  );
  const deadline = Date.now() + 60_000;
  while (compliance.status === 404 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    compliance = await http(
      fixture.base,
      "GET",
      `/api/workspaces/${wsId}/artifacts/${artId}/versions/${version}/compliance`,
    );
  }
  expect(compliance.status).toBe(200);

  return {
    detail: detail.body as ArtifactDetail,
    svg: svg.body as string,
    spec: spec.body as Record<string, unknown>,
    compliance: compliance.body as ComplianceResponse,
  };
}

// ── Keyless headless loop (this environment's proof) ──

describe("headless loop (keyless: scripted runtime, real protocol stack)", () => {
  it(
    "completes attach → brief → chip re-run → refinement → compliance → restore over real WS and HTTP",
    async () => {
      const staging = makeTempDir("headless-staging");
      const fixture = await startApiServer({
        startBridge: true,
        scripts: [
          fixtureGenerationScript(staging, {
            brief: "a login screen for a banking app, mobile",
          }),
          fixtureGenerationScript(staging, { platform: "mobile" }),
          fixtureSubstitutionScript({ find: "Swiss Chat", replace: "Welcome back" }),
        ],
      });
      let client: TestWsClient | undefined;
      try {
        // 1 — create the workspace over HTTP, open /ws, attach.
        const created = await http(fixture.base, "POST", "/api/workspaces", {});
        expect(created.status).toBe(201);
        const wsId = (created.body as WorkspaceSummary).id;

        client = await connectWs(fixture.wsUrl);
        await attachWorkspace(client, wsId, { requestId: "attach-1" });
        const bridgeStatus = client.events[0];
        expect(bridgeStatus?.type).toBe("bridge.status");
        expect(
          bridgeStatus?.type === "bridge.status" && bridgeStatus.payload.state,
        ).toBe("up");

        // 2 — the brief: full generation stream, version 1.
        const generation = await runTurn(
          client,
          "turn-brief",
          "a login screen for a banking app, mobile",
          KEYLESS_TIMEOUT_MS,
        );
        expectGenerationStream(generation);
        expect(generation.artifactRefs).toHaveLength(1);
        const artifact = generation.artifactRefs[0] as { artifactId: string; version: number };
        expect(artifact.version).toBe(1);
        await awaitComplianceEvent(client, 1, KEYLESS_TIMEOUT_MS);

        const chips = generation.events.find(
          (event) => event.type === "chips.updated",
        );
        expect(chips?.type === "chips.updated" && chips.payload.artifactId).toBe(
          artifact.artifactId,
        );

        // 3 — chip.update re-runs the affected step: version 2, parent 1.
        const chipsPayload = chips?.type === "chips.updated" ? chips.payload : null;
        client.send({
          type: "chip.update",
          requestId: "turn-chip",
          payload: {
            messageId: chipsPayload?.messageId as string,
            kind: "platform",
            value: "mobile",
          },
        });
        const chipVersion = await client.waitFor(
          (event) =>
            event.type === "artifact.version_created" &&
            event.payload.version.number === 2,
          "the chip re-run's version",
          KEYLESS_TIMEOUT_MS,
        );
        expect(
          chipVersion.type === "artifact.version_created" &&
            chipVersion.payload.version.parent,
        ).toBe(1);
        await client.waitFor(
          (event) =>
            event.type === "chat.message_completed" &&
            event.requestId === "turn-chip",
          "the chip turn to complete",
          KEYLESS_TIMEOUT_MS,
        );
        await awaitComplianceEvent(client, 2, KEYLESS_TIMEOUT_MS);

        // 4 — refinement via two-pass substitution, no brief restated:
        // context carried server-side; version 3, parent 2.
        const refinement = await runTurn(
          client,
          "turn-refine",
          "swap the header copy to Welcome back",
          KEYLESS_TIMEOUT_MS,
        );
        const refinementTools = refinement.events
          .filter((event) => event.type === "chat.tool_started")
          .map((event) =>
            event.type === "chat.tool_started" ? event.payload.tool : "",
          );
        expect(refinementTools).toEqual([
          "wf_build_substitution_request",
          "wf_apply_substitutions",
        ]);
        expect(refinement.artifactRefs).toEqual([
          { artifactId: artifact.artifactId, version: 3 },
        ]);
        await awaitComplianceEvent(client, 3, KEYLESS_TIMEOUT_MS);

        // 5 — HTTP reads: lineage, SVG, spec, compliance for the new head.
        const state = await fetchArtifactState(
          fixture,
          wsId,
          artifact.artifactId,
          3,
        );
        expect(state.detail.headVersion).toBe(3);
        const v3 = state.detail.versions.find((entry) => entry.number === 3);
        expect(v3?.parent).toBe(2);
        expect(v3?.tool).toBe("wf_apply_substitutions");
        expect(state.svg).toContain("Welcome back");
        expect(["pass", "warn", "fail"]).toContain(state.compliance.status);
        expect(state.compliance.rules.length).toBeGreaterThan(0);

        // Compliance ran on EVERY version, not on demand.
        for (const version of [1, 2, 3]) {
          const perVersion = await http(
            fixture.base,
            "GET",
            `/api/workspaces/${wsId}/artifacts/${artifact.artifactId}/versions/${version}/compliance`,
          );
          expect(perVersion.status).toBe(200);
        }

        // 6 — restore version 1 as the new head: RestoreResponse + WS event.
        const restored = await http(
          fixture.base,
          "POST",
          `/api/workspaces/${wsId}/artifacts/${artifact.artifactId}/versions/1/restore`,
        );
        expect(restored.status).toBe(200);
        const summary = restored.body as RestoreResponse;
        expect(summary.number).toBe(4);
        expect(summary.tool).toBe("restore");
        expect(summary.parent).toBe(3);

        const restoreEvent = await client.waitFor(
          (event) =>
            event.type === "artifact.version_created" &&
            event.payload.version.number === 4,
          "the restore's artifact.version_created",
          KEYLESS_TIMEOUT_MS,
        );
        expect(
          restoreEvent.type === "artifact.version_created" &&
            restoreEvent.payload.version.tool,
        ).toBe("restore");

        // The restored head serves byte-identical version 1 content.
        const v1Svg = await http(
          fixture.base,
          "GET",
          `/api/workspaces/${wsId}/artifacts/${artifact.artifactId}/versions/1/svg`,
        );
        const v4Svg = await http(
          fixture.base,
          "GET",
          `/api/workspaces/${wsId}/artifacts/${artifact.artifactId}/versions/4/svg`,
        );
        expect(v4Svg.body).toEqual(v1Svg.body);
      } finally {
        client?.terminate();
        await fixture.close();
      }
    },
    KEYLESS_TIMEOUT_MS,
  );
});

// ── Keyed headless loop (the real SDK; skipped without a key) ──

describe.skipIf(!HAS_KEY)("headless loop (keyed: real Agent SDK)", () => {
  it(
    "completes brief → refinement → compliance → restore through the live agent",
    async () => {
      const log = captureLogger("info");
      const agentConfig = {
        ...agentConfigFromStudioConfig(realStudioConfig(), {
          stagingDir: makeTempDir("keyed-headless-staging"),
        }),
        maxTurns: 24,
      };
      const fixture = await startApiServer({
        startBridge: true,
        runtime: createSdkAgentRuntime(agentConfig, log.logger),
        env: process.env,
      });
      let client: TestWsClient | undefined;
      try {
        const created = await http(fixture.base, "POST", "/api/workspaces", {});
        const wsId = (created.body as WorkspaceSummary).id;
        client = await connectWs(fixture.wsUrl);
        await attachWorkspace(client, wsId, { requestId: "attach-keyed" });

        // Brief → ordered stream → version 1.
        const generation = await runTurn(
          client,
          "keyed-brief",
          "wireframe a login screen for a banking app in the swiss system, mobile platform",
          KEYED_TIMEOUT_MS,
        );
        expectGenerationStream(generation);
        expect(generation.artifactRefs.length).toBeGreaterThan(0);
        const artifact = generation.artifactRefs[0] as {
          artifactId: string;
          version: number;
        };

        // Refinement without restating the brief (two-pass substitution).
        const refinement = await runTurn(
          client,
          "keyed-refine",
          "swap the header copy to say Welcome back",
          KEYED_TIMEOUT_MS,
        );
        expect(refinement.artifactRefs.length).toBeGreaterThan(0);
        const refined = refinement.artifactRefs[0] as {
          artifactId: string;
          version: number;
        };
        expect(refined.artifactId).toBe(artifact.artifactId);
        expect(refined.version).toBeGreaterThan(artifact.version);

        // HTTP reads for the refined head.
        const state = await fetchArtifactState(
          fixture,
          wsId,
          refined.artifactId,
          refined.version,
        );
        const head = state.detail.versions.find(
          (entry) => entry.number === refined.version,
        );
        expect(head?.parent).toBe(artifact.version);
        expect(state.compliance.rules.length).toBeGreaterThan(0);

        // Restore the first version as the new head.
        const restored = await http(
          fixture.base,
          "POST",
          `/api/workspaces/${wsId}/artifacts/${refined.artifactId}/versions/${artifact.version}/restore`,
        );
        expect(restored.status).toBe(200);
        const summary = restored.body as RestoreResponse;
        expect(summary.tool).toBe("restore");
        expect(summary.number).toBeGreaterThan(refined.version);
        await client.waitFor(
          (event) =>
            event.type === "artifact.version_created" &&
            event.payload.version.number === summary.number,
          "the restore's artifact.version_created",
          60_000,
        );
      } finally {
        client?.terminate();
        await fixture.close();
      }
    },
    KEYED_TIMEOUT_MS,
  );
});
