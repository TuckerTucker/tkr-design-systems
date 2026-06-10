/**
 * Slice 4 — per-artifact context and transcript persistence: all four
 * record kinds land per producing turn, a reopened session restores the
 * context from the transcript (refinement continues with no restatement,
 * provenance links the restored head), chip state restores with its turn,
 * and context assembly stays bounded on long conversations.
 */
import path from "node:path";

import { describe, expect, it } from "vitest";

import { MAX_CONTEXT_REFINEMENTS } from "../../src/agent/context.js";
import { TRANSCRIPT_RECORD_KINDS } from "@studio/contract";
import { makeTempDir } from "../helpers.js";
import {
  collect,
  converseScript,
  createScriptedRuntime,
  eventTypes,
  findEvent,
  generationScript,
  makeSessionFixture,
  type Script,
} from "./agent-helpers.js";

const BRIEF = "a dashboard for a meditation app";

describe("transcript persistence", () => {
  it("persists all four record kinds on a producing turn", async () => {
    const outputDir = path.join(makeTempDir("ctx-out"), "v1");
    const fixture = makeSessionFixture({
      scripts: [generationScript({ outputDir })],
    });
    await collect(fixture.session.send({ requestId: "req-gen", text: BRIEF }));

    const kinds = new Set(fixture.transcripts.records.map((r) => r.kind));
    for (const kind of TRANSCRIPT_RECORD_KINDS) {
      expect(kinds.has(kind)).toBe(true);
    }
    // No key material anywhere in the persisted transcript.
    expect(JSON.stringify(fixture.transcripts.records)).not.toContain("sk-ant");
  });
});

describe("session restore", () => {
  it("reopens the workspace and refines without restatement, linking the restored head", async () => {
    const outputDir = path.join(makeTempDir("ctx-out"), "v1");
    const fixture = makeSessionFixture({
      scripts: [generationScript({ outputDir })],
    });
    await collect(fixture.session.send({ requestId: "req-gen", text: BRIEF }));

    // "Server restart": a fresh session over the same persisted transcript.
    const restoredRuntime = createScriptedRuntime([
      (request) => {
        // The restored context supplies everything — no restatement.
        expect(request.prompt).toContain(BRIEF);
        expect(request.prompt).toContain("system: swiss");
        expect(request.prompt).toContain("layout_id: dashboard");
        expect(request.prompt).toContain("platform: desktop");
        return converseScript("Continuing in context.");
      },
    ]);
    const reopened = fixture.reopen(restoredRuntime);
    const events = await collect(
      reopened.send({
        requestId: "req-resume",
        text: "now make the stats card show weekly numbers",
      }),
    );
    expect(eventTypes(events).at(-1)).toBe("message_completed");
    expect(restoredRuntime.requests).toHaveLength(1);
  });

  it("restores head-version linkage: the next landing's parent is the restored head", async () => {
    const out1 = path.join(makeTempDir("ctx-out"), "v1");
    const out2 = path.join(makeTempDir("ctx-out"), "v2");
    const fixture = makeSessionFixture({
      scripts: [generationScript({ outputDir: out1 })],
    });
    await collect(fixture.session.send({ requestId: "req-gen", text: BRIEF }));

    const restoredRuntime = createScriptedRuntime([
      generationScript({
        outputDir: out2,
        platform: "mobile",
        skipRouting: true,
      }) as Script,
    ]);
    const reopened = fixture.reopen(restoredRuntime);
    const events = await collect(
      reopened.updateChip({
        requestId: "req-chip-after-restore",
        artifactId: "art-1",
        kind: "platform",
        value: "mobile",
      }),
    );
    const produced = findEvent(events, "artifact_produced");
    // The restored context knew the artifact's head (version 1).
    expect(produced?.provenance.parentArtifactVersion).toBe(1);
    expect(produced?.artifactId).toBe("art-1");
  });

  it("restores chip state with its turn (validation vocabulary survives restart)", async () => {
    const outputDir = path.join(makeTempDir("ctx-out"), "v1");
    const fixture = makeSessionFixture({
      scripts: [generationScript({ outputDir })],
    });
    await collect(fixture.session.send({ requestId: "req-gen", text: BRIEF }));

    const reopened = fixture.reopen(createScriptedRuntime([]));
    const events = await collect(
      reopened.updateChip({
        requestId: "req-bad",
        artifactId: "art-1",
        kind: "platform",
        value: "tablet",
      }),
    );
    // Rejected against the RESTORED chip options — proof the chips came back.
    expect(events[0]?.type).toBe("error");
    if (events[0]?.type === "error") {
      expect(events[0].code).toBe("chip_invalid");
      expect(events[0].message).toContain("tablet");
    }
  });
});

describe("bounded context assembly", () => {
  it("truncates oldest refinements while the brief and defaults survive", async () => {
    const outputDir = path.join(makeTempDir("ctx-out"), "v1");
    const turns = MAX_CONTEXT_REFINEMENTS + 4;
    const scripts: Script[] = [generationScript({ outputDir })];
    for (let i = 0; i < turns; i++) {
      scripts.push(converseScript(`answer ${i}. `));
    }
    let lastPrompt = "";
    scripts.push((request) => {
      lastPrompt = request.prompt;
      return converseScript("final");
    });
    const fixture = makeSessionFixture({ scripts });

    await collect(fixture.session.send({ requestId: "req-gen", text: BRIEF }));
    for (let i = 0; i < turns; i++) {
      await collect(
        fixture.session.send({
          requestId: `req-talk-${i}`,
          text: `refinement chatter number ${i}`,
        }),
      );
    }
    await collect(
      fixture.session.send({ requestId: "req-final", text: "one more thing" }),
    );

    // The brief and current defaults always survive truncation.
    expect(lastPrompt).toContain(BRIEF);
    expect(lastPrompt).toContain("system: swiss");
    expect(lastPrompt).toContain("platform: desktop");
    // Bounded: the oldest refinement turns are truncated away.
    expect(lastPrompt).not.toContain("refinement chatter number 0");
    const refinementLines = lastPrompt
      .split("\n")
      .filter((line) => line.startsWith("- "));
    expect(refinementLines.length).toBeLessThanOrEqual(MAX_CONTEXT_REFINEMENTS);
  });
});
