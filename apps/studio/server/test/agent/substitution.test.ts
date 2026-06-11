/**
 * Slice 5 — two-pass substitution: refinement without restatement (context
 * supplies brief/system/layout/platform/svg_path), staged paths source,
 * surfaced unapplied_finds and grammar_warnings, parent-version provenance,
 * chips carried forward, and per-artifact context isolation.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type {
  RoutingPayload,
  ToolCallPayload,
} from "../../src/agent/transcript.js";
import { makeTempDir } from "../helpers.js";
import {
  collect,
  eventTypes,
  findEvent,
  generationScript,
  makeSessionFixture,
  WORKSPACE_ID,
  type ScriptStep,
  type SessionFixture,
} from "./agent-helpers.js";

const BRIEF = "a dashboard for a meditation app";
const REFINEMENT = "swap the header copy for something calmer";
const SUBSTITUTED_SVG = "<svg><text>Breathe Easy</text></svg>";
const PARENT_SPEC = "wireframe:\n  brief: a dashboard for a meditation app\n";

/** Seed the head version files the resolver points at (pass-2 inputs). */
function seedHeadVersion(fixture: SessionFixture, artifactId: string): void {
  const svgPath = fixture.versionFiles(WORKSPACE_ID, artifactId, 1, "svg");
  const specPath = fixture.versionFiles(WORKSPACE_ID, artifactId, 1, "spec");
  mkdirSync(path.dirname(svgPath), { recursive: true });
  writeFileSync(svgPath, "<svg><text>HEADER</text></svg>");
  writeFileSync(specPath, PARENT_SPEC);
}

function substitutionScript(svgPath: string): ScriptStep[] {
  const pass1Input = {
    brief: REFINEMENT,
    system_id: "swiss",
    platform: "desktop",
    layout_id: "dashboard",
  };
  const pass2Input = {
    svg_path: svgPath,
    substitutions: [
      { find: "HEADER", replace: "Breathe Easy", rationale: "calmer copy" },
      { find: "GONE", replace: "x", rationale: "stale find" },
    ],
    system_id: "swiss",
  };
  return [
    {
      type: "tool_started",
      toolUseId: "tu-p1",
      toolName: "wf_build_substitution_request",
      input: pass1Input,
    },
    {
      type: "tool_finished",
      toolUseId: "tu-p1",
      toolName: "wf_build_substitution_request",
      input: pass1Input,
      ok: true,
      result: {
        ok: true,
        text_nodes: [{ text: "HEADER" }],
        grammar_caveats: ["Swiss prefers sentence case"],
        selected_pattern: {
          pattern_id: "dashboard",
          rationale: "explicit layout_id",
        },
      },
    },
    {
      type: "tool_started",
      toolUseId: "tu-p2",
      toolName: "wf_apply_substitutions",
      input: pass2Input,
    },
    {
      type: "tool_finished",
      toolUseId: "tu-p2",
      toolName: "wf_apply_substitutions",
      input: pass2Input,
      ok: true,
      result: {
        ok: true,
        svg_text: SUBSTITUTED_SVG,
        unapplied_finds: ["GONE"],
        grammar_warnings: ["'Breathe Easy' breaks sentence case"],
      },
    },
    { type: "turn_completed" },
  ];
}

describe("two-pass substitution", () => {
  it("runs the two passes from context, stages a paths source, and surfaces warnings", async () => {
    const out1 = path.join(makeTempDir("sub-out"), "v1");
    const fixture = makeSessionFixture({
      scripts: [
        generationScript({ outputDir: out1, brief: BRIEF }),
        (request) => {
          // Refinement without restatement: the context block supplies the
          // brief, system, layout, platform, and the head svg_path.
          expect(request.prompt).toContain(BRIEF);
          expect(request.prompt).toContain("system: swiss");
          expect(request.prompt).toContain("layout_id: dashboard");
          expect(request.prompt).toContain("platform: desktop");
          const svgPath = fixture.versionFiles(
            WORKSPACE_ID,
            "art-1",
            1,
            "svg",
          );
          expect(request.prompt).toContain(svgPath);
          return substitutionScript(svgPath);
        },
      ],
    });

    await collect(fixture.session.send({ requestId: "req-gen", text: BRIEF }));
    seedHeadVersion(fixture, "art-1");

    const events = await collect(
      fixture.session.send({ requestId: "req-sub", text: REFINEMENT }),
    );
    expect(eventTypes(events).at(-1)).toBe("message_completed");

    // Staged paths source: the substituted SVG and the parent spec copy.
    const produced = findEvent(events, "artifact_produced");
    expect(produced?.artifactId).toBe("art-1");
    expect(produced?.source.kind).toBe("paths");
    if (produced?.source.kind === "paths") {
      expect(existsSync(produced.source.svgPath)).toBe(true);
      expect(readFileSync(produced.source.svgPath, "utf8")).toBe(SUBSTITUTED_SVG);
      expect(readFileSync(produced.source.specPath, "utf8")).toBe(PARENT_SPEC);
    }
    expect(produced?.provenance.tool).toBe("wf_apply_substitutions");
    expect(produced?.provenance.parentArtifactVersion).toBe(1);
    expect(produced?.provenance.parameters["substitutions"]).toContainEqual({
      find: "HEADER",
      replace: "Breathe Easy",
    });

    // unapplied_finds and grammar_warnings surface, never dropped.
    const finishes = events.filter(
      (event): event is Extract<typeof event, { type: "tool_finished" }> =>
        event.type === "tool_finished",
    );
    const pass2 = finishes.find((event) => event.toolUseId === "tu-p2");
    expect(pass2?.ok).toBe(true);
    expect(pass2?.summary).toContain("unapplied find: GONE");
    expect(pass2?.summary).toContain("grammar:");

    const toolRecord = fixture.transcripts.records
      .filter((record) => record.kind === "tool_call")
      .map((record) => record.payload as ToolCallPayload)
      .find((payload) => payload.toolName === "wf_apply_substitutions");
    expect(toolRecord?.warnings.join(" ")).toContain("GONE");

    // Chips carried forward unchanged on the refinement turn.
    const chips = findEvent(events, "chips_updated");
    const byKind = new Map(chips?.chipSet.chips.map((c) => [c.kind, c]));
    expect(byKind.get("system")?.value).toBe("swiss");
    expect(byKind.get("layout")?.value).toBe("dashboard");
    expect(byKind.get("platform")?.value).toBe("desktop");

    // Routing recorded the substitute intent with the applied substitutions.
    const completed = findEvent(events, "message_completed");
    expect(completed?.routing.intent).toBe("substitute");
    const routing = fixture.transcripts.records
      .filter((record) => record.kind === "routing_result")
      .map((record) => record.payload as RoutingPayload)
      .at(-1);
    expect(routing?.substitutions).toEqual([
      { find: "HEADER", replace: "Breathe Easy" },
      { find: "GONE", replace: "x" },
    ]);
  });

  it("keeps per-artifact contexts isolated: untargeted refinements hit the active artifact only", async () => {
    const outA = path.join(makeTempDir("iso-out"), "a");
    const outB = path.join(makeTempDir("iso-out"), "b");
    const fixture = makeSessionFixture({
      scripts: [
        generationScript({ outputDir: outA, brief: "artifact A brief" }),
        generationScript({
          outputDir: outB,
          brief: "artifact B brief",
          layoutId: "login",
        }),
        (request) => {
          // The untargeted refinement frames artifact B (the active one).
          expect(request.prompt).toContain("artifact_id: art-2");
          expect(request.prompt).toContain("artifact B brief");
          expect(request.prompt).not.toContain("artifact A brief");
          const svgPath = fixture.versionFiles(WORKSPACE_ID, "art-2", 1, "svg");
          return substitutionScript(svgPath);
        },
      ],
    });
    await collect(
      fixture.session.send({ requestId: "req-a", text: "artifact A brief" }),
    );
    await collect(
      fixture.session.send({ requestId: "req-b", text: "artifact B brief" }),
    );
    seedHeadVersion(fixture, "art-2");

    const events = await collect(
      fixture.session.send({ requestId: "req-ref", text: REFINEMENT }),
    );
    const produced = findEvent(events, "artifact_produced");
    expect(produced?.artifactId).toBe("art-2");
    // Artifact A is untouched: its only ingest was the original generation.
    const artifactAIngests = fixture.ingest.requests.filter(
      (request) => request.artifactId === "art-1",
    );
    expect(artifactAIngests).toHaveLength(0);
  });
});
