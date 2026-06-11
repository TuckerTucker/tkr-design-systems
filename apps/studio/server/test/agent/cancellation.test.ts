/**
 * Slice 7 — cancellation: cancel(requestId) aborts the in-flight run, the
 * stream terminates with a cancelled error, no partial artifact lands, the
 * transcript keeps the turn marked cancelled with partial assistant text,
 * the session stays usable, and unknown/completed requestIds are typed
 * no-ops.
 */
import { describe, expect, it } from "vitest";

import type { AgentEvent } from "@studio/contract";
import type { MessagePayload } from "../../src/agent/transcript.js";
import {
  collect,
  converseScript,
  eventTypes,
  findEvent,
  makeSessionFixture,
} from "./agent-helpers.js";

describe("mid-generation cancellation", () => {
  it("aborts the run, emits cancelled, lands no artifact, and the session keeps working", async () => {
    const fixture = makeSessionFixture({
      scripts: [
        [
          { type: "assistant_text", text: "Working on it" },
          {
            type: "tool_started",
            toolUseId: "tu-1",
            toolName: "wf_generate",
            input: { brief: "a dashboard" },
          },
          { type: "wait_for_abort" },
        ],
        converseScript("Back to normal."),
      ],
    });

    const stream = fixture.session.send({
      requestId: "req-cancel",
      text: "a dashboard",
    })[Symbol.asyncIterator]();

    const events: AgentEvent[] = [];
    // Drain up to the in-flight tool_started, then cancel.
    for (let i = 0; i < 3; i++) {
      const next = await stream.next();
      if (next.done === true) {
        break;
      }
      events.push(next.value);
    }
    expect(eventTypes(events)).toEqual([
      "message_started",
      "assistant_delta",
      "tool_started",
    ]);

    const result = await fixture.session.cancel("req-cancel");
    expect(result).toEqual({ ok: true, cancelled: true });

    let next = await stream.next();
    while (next.done !== true) {
      events.push(next.value);
      next = await stream.next();
    }
    const last = events.at(-1);
    expect(last?.type).toBe("error");
    if (last?.type === "error") {
      expect(last.code).toBe("cancelled");
    }

    // No partial artifact: nothing was ingested, nothing produced.
    expect(findEvent(events, "artifact_produced")).toBeUndefined();
    expect(fixture.ingest.requests).toHaveLength(0);

    // The cancelled turn persists with the partial assistant text.
    const assistant = fixture.transcripts.records
      .map((record) => record.payload as MessagePayload)
      .find((payload) => payload.role === "assistant");
    expect(assistant?.status).toBe("cancelled");
    expect(assistant?.text).toBe("Working on it");

    // The next send on the SAME session runs normally.
    const followUp = await collect(
      fixture.session.send({ requestId: "req-after", text: "hello again" }),
    );
    expect(eventTypes(followUp).at(-1)).toBe("message_completed");

    // Cancelling the finished requestId is a typed no-op.
    expect(await fixture.session.cancel("req-cancel")).toEqual({
      ok: true,
      cancelled: false,
      reason: "already_completed",
    });
  });

  it("returns not_running for an unknown requestId without throwing", async () => {
    const fixture = makeSessionFixture({});
    expect(await fixture.session.cancel("never-seen")).toEqual({
      ok: true,
      cancelled: false,
      reason: "not_running",
    });
  });

  it("returns already_completed when the cancel races a natural completion", async () => {
    const fixture = makeSessionFixture({ scripts: [converseScript()] });
    await collect(
      fixture.session.send({ requestId: "req-done", text: "quick question" }),
    );
    expect(await fixture.session.cancel("req-done")).toEqual({
      ok: true,
      cancelled: false,
      reason: "already_completed",
    });
  });
});
