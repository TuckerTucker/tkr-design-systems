/**
 * Slice 6 — blueprint composition: decomposition request → agent-authored
 * LayoutBlueprint → wf_assemble_from_blueprint with the text source branch,
 * validation-failure recovery inside the loop, and the blueprint_invalid
 * terminal error when retries exhaust.
 */
import { describe, expect, it } from "vitest";

import {
  collect,
  eventTypes,
  findEvent,
  makeSessionFixture,
  type ScriptStep,
} from "./agent-helpers.js";

const BRIEF = "a kanban board with three columns, in Swiss";
const BLUEPRINT = {
  canvas: { width: 1280, height: 800 },
  regions: [
    {
      id: "board",
      components: [
        { component_id: "card", x: 40, y: 80 },
        { component_id: "card", x: 460, y: 80 },
        { component_id: "card", x: 880, y: 80 },
      ],
    },
  ],
};

function decompositionSteps(): ScriptStep[] {
  const input = { brief: BRIEF, system: "swiss", compose: true };
  return [
    { type: "tool_started", toolUseId: "tu-d", toolName: "wf_generate", input },
    {
      type: "tool_finished",
      toolUseId: "tu-d",
      toolName: "wf_generate",
      input,
      ok: true,
      result: {
        ok: true,
        decomposition_request: {
          components: [{ id: "card" }, { id: "header" }],
          canvas: { width: 1280, height: 800 },
        },
      },
    },
  ];
}

function assembleStep(args: {
  toolUseId: string;
  blueprint: Record<string, unknown>;
  result: Record<string, unknown>;
}): ScriptStep[] {
  const input = { blueprint: args.blueprint, system_id: "swiss" };
  return [
    {
      type: "tool_started",
      toolUseId: args.toolUseId,
      toolName: "wf_assemble_from_blueprint",
      input,
    },
    {
      type: "tool_finished",
      toolUseId: args.toolUseId,
      toolName: "wf_assemble_from_blueprint",
      input,
      ok: true,
      result: args.result,
    },
  ];
}

describe("compose flow", () => {
  it("recovers from validation errors and produces a text-source artifact with the blueprint in provenance", async () => {
    const fixture = makeSessionFixture({
      scripts: [
        [
          ...decompositionSteps(),
          // First attempt fails validation; the agent revises and retries.
          ...assembleStep({
            toolUseId: "tu-a1",
            blueprint: { ...BLUEPRINT, regions: [] },
            result: {
              ok: false,
              svg_text: null,
              validation_errors: ["unknown component_id 'nav'"],
              warnings: [],
            },
          }),
          { type: "assistant_text", text: "Revising the blueprint. " },
          ...assembleStep({
            toolUseId: "tu-a2",
            blueprint: BLUEPRINT,
            result: {
              ok: true,
              svg_text: "<svg><g>kanban</g></svg>",
              validation_errors: [],
              warnings: ["components overlap at x=460"],
            },
          }),
          { type: "turn_completed" },
        ],
      ],
    });

    const events = await collect(
      fixture.session.send({ requestId: "req-compose", text: BRIEF }),
    );
    expect(eventTypes(events).at(-1)).toBe("message_completed");

    const produced = findEvent(events, "artifact_produced");
    expect(produced?.source.kind).toBe("text");
    if (produced?.source.kind === "text") {
      expect(produced.source.svgText).toBe("<svg><g>kanban</g></svg>");
    }
    expect(produced?.provenance.tool).toBe("wf_assemble_from_blueprint");
    // Full reproduction context: the blueprint rides in parameters.
    expect(produced?.provenance.parameters["blueprint"]).toEqual(BLUEPRINT);

    // Assembly warnings surface in the stream.
    const finishes = events.filter(
      (event): event is Extract<typeof event, { type: "tool_finished" }> =>
        event.type === "tool_finished",
    );
    expect(
      finishes.find((event) => event.toolUseId === "tu-a2")?.summary,
    ).toContain("overlap");
    // The failed attempt surfaced too (ok: false), never silently dropped.
    expect(finishes.find((event) => event.toolUseId === "tu-a1")?.ok).toBe(false);

    const completed = findEvent(events, "message_completed");
    expect(completed?.routing.intent).toBe("compose");

    // Chips on the compose turn: layout reflects the composed result.
    const chips = findEvent(events, "chips_updated");
    const byKind = new Map(chips?.chipSet.chips.map((c) => [c.kind, c]));
    expect(byKind.get("system")?.value).toBe("swiss");
    expect(byKind.get("layout")?.value).toBe("composed");
    expect(byKind.get("system")?.rerunStep).toBe("compose");
  });

  it("yields blueprint_invalid listing the unresolved errors when recovery exhausts", async () => {
    const fixture = makeSessionFixture({
      scripts: [
        [
          ...decompositionSteps(),
          ...assembleStep({
            toolUseId: "tu-a1",
            blueprint: BLUEPRINT,
            result: {
              ok: false,
              svg_text: null,
              validation_errors: ["unknown component_id 'nav'"],
              warnings: [],
            },
          }),
          ...assembleStep({
            toolUseId: "tu-a2",
            blueprint: BLUEPRINT,
            result: {
              ok: false,
              svg_text: null,
              validation_errors: [
                "unknown component_id 'nav'",
                "placement out of bounds: (2000, 80)",
              ],
              warnings: [],
            },
          }),
          { type: "turn_completed" },
        ],
      ],
    });

    const events = await collect(
      fixture.session.send({ requestId: "req-compose-fail", text: BRIEF }),
    );
    const last = events.at(-1);
    expect(last?.type).toBe("error");
    if (last?.type === "error") {
      expect(last.code).toBe("blueprint_invalid");
      expect(last.message).toContain("unknown component_id 'nav'");
      expect(last.message).toContain("out of bounds");
    }
    expect(findEvent(events, "artifact_produced")).toBeUndefined();
    expect(fixture.ingest.requests).toHaveLength(0);
  });
});
