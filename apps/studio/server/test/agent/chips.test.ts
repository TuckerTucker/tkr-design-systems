/**
 * Slice 3 — decision-chip edits: updateChip re-runs only the affected step
 * with the changed parameter, system changes refresh the layout vocabulary
 * from the new system, and out-of-vocabulary values are rejected at the
 * boundary before any tool call.
 */
import path from "node:path";

import { describe, expect, it } from "vitest";

import { makeTempDir } from "../helpers.js";
import {
  collect,
  eventTypes,
  findEvent,
  generationScript,
  makeSessionFixture,
  type SessionFixture,
} from "./agent-helpers.js";

const BRIEF = "a dashboard for a meditation app";

async function runInitialGeneration(fixture: SessionFixture): Promise<void> {
  const events = await collect(
    fixture.session.send({ requestId: "req-gen", text: BRIEF }),
  );
  expect(eventTypes(events).at(-1)).toBe("message_completed");
}

describe("updateChip", () => {
  it("platform change re-runs generation only, at the new platform, linking the parent version", async () => {
    const out1 = path.join(makeTempDir("chip-out"), "v1");
    const out2 = path.join(makeTempDir("chip-out"), "v2");
    const fixture = makeSessionFixture({
      scripts: [
        generationScript({ outputDir: out1 }),
        (request) => {
          // The deterministic re-run prompt carries the recovered brief and
          // the changed platform — the conversation is not replayed.
          expect(request.prompt).toContain("Re-run request");
          expect(request.prompt).toContain(BRIEF);
          expect(request.prompt).toContain("Platform: mobile");
          return generationScript({
            outputDir: out2,
            platform: "mobile",
            skipRouting: true,
          });
        },
      ],
    });
    await runInitialGeneration(fixture);
    const artifactId = "art-1";

    const events = await collect(
      fixture.session.updateChip({
        requestId: "req-chip",
        artifactId,
        kind: "platform",
        value: "mobile",
      }),
    );

    // Only the generation step re-ran: one wf_generate pair, no routing pass.
    const toolStarts = events.filter((event) => event.type === "tool_started");
    expect(toolStarts).toHaveLength(1);

    const produced = findEvent(events, "artifact_produced");
    expect(produced?.artifactId).toBe(artifactId);
    expect(produced?.provenance.parentArtifactVersion).toBe(1);
    expect(produced?.provenance.parameters).toMatchObject({
      platform: "mobile",
      layout_id: "dashboard",
      system: "swiss",
    });
    // The re-run landed on the same artifact as a new version.
    expect(fixture.ingest.requests[1]?.artifactId).toBe(artifactId);

    const chips = findEvent(events, "chips_updated");
    const byKind = new Map(chips?.chipSet.chips.map((c) => [c.kind, c]));
    expect(byKind.get("platform")?.value).toBe("mobile");
    expect(byKind.get("system")?.value).toBe("swiss");
    expect(byKind.get("layout")?.value).toBe("dashboard");

    const completed = findEvent(events, "message_completed");
    expect(completed?.routing.intent).toBe("generate");
    expect(completed?.routing.rationale).toContain("platform");
  });

  it("system change re-runs generation in the new system and refreshes layout options", async () => {
    const out1 = path.join(makeTempDir("chip-out"), "v1");
    const out2 = path.join(makeTempDir("chip-out"), "v2");
    const fixture = makeSessionFixture({
      scripts: [
        generationScript({ outputDir: out1 }),
        (request) => {
          expect(request.prompt).toContain('system_id="terminal"');
          return [
            {
              type: "tool_started",
              toolUseId: "tu-sel",
              toolName: "wf_select_layout",
              input: { brief: BRIEF, system_id: "terminal", platform: "desktop" },
            },
            {
              type: "tool_finished",
              toolUseId: "tu-sel",
              toolName: "wf_select_layout",
              input: { brief: BRIEF, system_id: "terminal", platform: "desktop" },
              ok: true,
              result: {
                ok: true,
                available_patterns: [
                  { pattern_id: "terminal-dash" },
                  { pattern_id: "terminal-login" },
                ],
              },
            },
            ...generationScript({
              outputDir: out2,
              system: "terminal",
              layoutId: "terminal-dash",
              skipRouting: true,
            }),
          ];
        },
      ],
    });
    await runInitialGeneration(fixture);

    const events = await collect(
      fixture.session.updateChip({
        requestId: "req-chip-sys",
        artifactId: "art-1",
        kind: "system",
        value: "terminal",
      }),
    );

    const chips = findEvent(events, "chips_updated");
    const byKind = new Map(chips?.chipSet.chips.map((c) => [c.kind, c]));
    expect(byKind.get("system")?.value).toBe("terminal");
    // Layout options re-sourced from the new system's patterns.
    expect(byKind.get("layout")?.options).toContain("terminal-dash");
    expect(byKind.get("layout")?.options).toContain("terminal-login");
    expect(byKind.get("layout")?.options).not.toContain("login");
    const produced = findEvent(events, "artifact_produced");
    expect(produced?.provenance.parameters).toMatchObject({ system: "terminal" });
  });

  it("rejects a value outside the chip's options before any tool call", async () => {
    const out1 = path.join(makeTempDir("chip-out"), "v1");
    const fixture = makeSessionFixture({
      scripts: [generationScript({ outputDir: out1 })],
    });
    await runInitialGeneration(fixture);
    const runtimeCallsBefore = fixture.runtime.requests.length;

    const events = await collect(
      fixture.session.updateChip({
        requestId: "req-bad-chip",
        artifactId: "art-1",
        kind: "platform",
        value: "tablet",
      }),
    );
    expect(events).toHaveLength(1);
    const error = events[0];
    expect(error?.type).toBe("error");
    if (error?.type === "error") {
      expect(error.code).toBe("chip_invalid");
      expect(error.message).toContain("tablet");
    }
    // No re-run started, no tool call occurred.
    expect(fixture.runtime.requests).toHaveLength(runtimeCallsBefore);
    expect(fixture.ingest.requests).toHaveLength(1);
  });

  it("rejects updates for an artifact with no recorded chips", async () => {
    const fixture = makeSessionFixture({});
    const events = await collect(
      fixture.session.updateChip({
        requestId: "req-none",
        artifactId: "ghost",
        kind: "system",
        value: "swiss",
      }),
    );
    expect(events[0]?.type).toBe("error");
    if (events[0]?.type === "error") {
      expect(events[0].code).toBe("chip_invalid");
    }
  });
});
