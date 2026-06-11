/**
 * Slice 3 — generation flow: routing_request handling, artifact_produced
 * with ArtifactSource { kind: "paths" } + provenance, ingestion hand-off,
 * decision chips with real vocabularies, event ordering, and typed
 * tool-failure surfacing.
 */
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { RoutingPayload } from "../../src/agent/transcript.js";
import { makeTempDir } from "../helpers.js";
import {
  collect,
  eventTypes,
  findEvent,
  generationScript,
  makeSessionFixture,
  WORKSPACE_ID,
} from "./agent-helpers.js";

describe("generation flow", () => {
  it("produces an artifact through wf_generate with paths source and provenance", async () => {
    const outputDir = path.join(makeTempDir("gen-out"), "req-gen");
    const fixture2 = makeSessionFixture({
      scripts: [generationScript({ outputDir })],
    });
    const events = await collect(
      fixture2.session.send({
        requestId: "req-gen",
        text: "a dashboard for a meditation app",
      }),
    );

    expect(eventTypes(events)).toEqual([
      "message_started",
      "tool_started",
      "tool_finished",
      "assistant_delta",
      "tool_started",
      "tool_finished",
      "artifact_produced",
      "chips_updated",
      "message_completed",
    ]);

    const produced = findEvent(events, "artifact_produced");
    expect(produced?.source.kind).toBe("paths");
    if (produced?.source.kind === "paths") {
      expect(produced.source.svgPath).toContain("wireframe.svg");
      expect(produced.source.specPath).toContain("wireframe.spec.yaml");
    }
    expect(produced?.provenance).toMatchObject({
      brief: "a dashboard for a meditation app",
      tool: "wf_generate",
      parentArtifactVersion: null,
    });
    expect(produced?.provenance.parameters).toMatchObject({
      system: "swiss",
      platform: "desktop",
      layout_id: "dashboard",
    });

    // The session handed the result to artifact-pipeline ingestion.
    expect(fixture2.ingest.requests).toHaveLength(1);
    const ingest = fixture2.ingest.requests[0];
    expect(ingest?.workspaceId).toBe(WORKSPACE_ID);
    expect(ingest?.artifactId).toBeUndefined();
    expect(ingest?.source.kind).toBe("paths");
    expect(ingest?.provenance.tool).toBe("wf_generate");

    const completed = findEvent(events, "message_completed");
    expect(completed?.routing.intent).toBe("generate");
    expect(completed?.routing.defaults).toEqual({
      system: "swiss",
      layoutId: "dashboard",
      platform: "desktop",
    });
  });

  it("emits chips with real vocabularies and never asked the user", async () => {
    const outputDir = path.join(makeTempDir("gen-out"), "req-gen");
    const fx = makeSessionFixture({
      scripts: [
        generationScript({ outputDir, patterns: ["dashboard", "login"] }),
      ],
      systems: ["swiss", "terminal", "editorial"],
    });
    const events = await collect(
      fx.session.send({ requestId: "req-gen", text: "a dashboard" }),
    );
    const chips = findEvent(events, "chips_updated");
    expect(chips).toBeDefined();
    const byKind = new Map(
      chips?.chipSet.chips.map((chip) => [chip.kind, chip]),
    );
    expect(byKind.get("system")?.value).toBe("swiss");
    expect(byKind.get("system")?.options).toEqual([
      "swiss",
      "terminal",
      "editorial",
    ]);
    expect(byKind.get("layout")?.value).toBe("dashboard");
    expect(byKind.get("layout")?.options).toEqual(["dashboard", "login"]);
    expect(byKind.get("platform")?.value).toBe("desktop");
    expect(byKind.get("platform")?.options).toEqual(["mobile", "desktop"]);
    expect(byKind.get("system")?.rerunStep).toBe("generate");
    // Chips persist with the turn.
    expect(
      fx.transcripts.records.some((record) => record.kind === "decision_chips"),
    ).toBe(true);
  });

  it("surfaces wf_generate ok:false as a tool_failed error carrying the tool's messages", async () => {
    const fx = makeSessionFixture({
      scripts: [
        [
          {
            type: "tool_started",
            toolUseId: "tu-1",
            toolName: "wf_generate",
            input: { brief: "a login screen", system: "nope" },
          },
          {
            type: "tool_finished",
            toolUseId: "tu-1",
            toolName: "wf_generate",
            input: { brief: "a login screen", system: "nope" },
            ok: true,
            result: {
              ok: false,
              errors: [
                "Unknown system 'nope'",
                "Available systems: swiss, terminal, editorial",
              ],
            },
          },
          { type: "turn_completed" },
        ],
      ],
    });
    const events = await collect(
      fx.session.send({ requestId: "req-bad", text: "a login screen in nope" }),
    );
    const last = events.at(-1);
    expect(last?.type).toBe("error");
    if (last?.type === "error") {
      expect(last.code).toBe("tool_failed");
      expect(last.message).toContain("Unknown system 'nope'");
      expect(last.message).toContain("Available systems");
    }
    expect(findEvent(events, "artifact_produced")).toBeUndefined();
    expect(fx.ingest.requests).toHaveLength(0);
    // The attempted routing decision is still recorded.
    const routing = fx.transcripts.records.find(
      (record) => record.kind === "routing_result",
    )?.payload as RoutingPayload | undefined;
    expect(routing?.intent).toBe("generate");
    expect(routing?.producedVersion).toBeNull();
  });

  it("fails the turn as agent_failed when ingestion rejects the output", async () => {
    const outputDir = path.join(makeTempDir("gen-out"), "req-gen");
    const fx = makeSessionFixture({
      scripts: [generationScript({ outputDir })],
    });
    fx.ingest.failNextWith = "workspace store is read-only";
    const events = await collect(
      fx.session.send({ requestId: "req-gen", text: "a dashboard" }),
    );
    const last = events.at(-1);
    expect(last?.type).toBe("error");
    if (last?.type === "error") {
      expect(last.code).toBe("agent_failed");
      expect(last.message).toContain("read-only");
    }
    expect(findEvent(events, "artifact_produced")).toBeUndefined();
  });
});
