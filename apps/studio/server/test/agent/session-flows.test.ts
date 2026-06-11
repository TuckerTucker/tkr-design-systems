/**
 * Slice 2 — sessions and plain conversation: event ordering, zero tool
 * calls on converse turns, transcript persistence, session reuse,
 * single-in-flight busy rejection, and keyless refusal with in-place
 * recovery once a key appears.
 */
import { describe, expect, it } from "vitest";

import { ANTHROPIC_API_KEY_VAR } from "../../src/agent/auth.js";
import type { MessagePayload, RoutingPayload } from "../../src/agent/transcript.js";
import {
  collect,
  converseScript,
  eventTypes,
  findEvent,
  makeSessionFixture,
  TEST_API_KEY,
} from "./agent-helpers.js";

describe("plain conversation", () => {
  it("streams deltas in order with zero tool events and intent converse", async () => {
    const fixture = makeSessionFixture({ scripts: [converseScript()] });
    const events = await collect(
      fixture.session.send({ requestId: "req-1", text: "what is a wireframe?" }),
    );

    expect(eventTypes(events)).toEqual([
      "message_started",
      "assistant_delta",
      "assistant_delta",
      "message_completed",
    ]);
    const completed = findEvent(events, "message_completed");
    expect(completed?.routing.intent).toBe("converse");
    expect(completed?.routing.artifactId).toBeNull();
    expect(completed?.routing.defaults).toBeNull();
    expect(fixture.ingest.requests).toHaveLength(0);
  });

  it("persists the message, streamed text, and routing result", async () => {
    const fixture = makeSessionFixture({ scripts: [converseScript()] });
    await collect(
      fixture.session.send({ requestId: "req-1", text: "what is a wireframe?" }),
    );

    const kinds = fixture.transcripts.records.map((record) => record.kind);
    expect(kinds).toEqual(["message", "message", "routing_result"]);
    const [user, assistant] = fixture.transcripts.records.map(
      (record) => record.payload as MessagePayload,
    );
    expect(user?.role).toBe("user");
    expect(user?.text).toBe("what is a wireframe?");
    expect(assistant?.role).toBe("assistant");
    expect(assistant?.text).toContain("low-fi layout");
    const routing = fixture.transcripts.records[2]?.payload as RoutingPayload;
    expect(routing.intent).toBe("converse");
  });

  it("reuses the same session across sequential turns", async () => {
    const fixture = makeSessionFixture({
      scripts: [converseScript(), converseScript("Second answer. ")],
    });
    await collect(fixture.session.send({ requestId: "req-1", text: "first" }));
    await collect(fixture.session.send({ requestId: "req-2", text: "second" }));
    expect(fixture.runtime.requests).toHaveLength(2);
    expect(fixture.runtime.requests[1]?.requestId).toBe("req-2");
  });
});

describe("single in-flight run per workspace", () => {
  it("rejects a concurrent send with session_busy naming the active requestId", async () => {
    const fixture = makeSessionFixture({
      scripts: [converseScript(), converseScript()],
    });
    const first = fixture.session.send({ requestId: "req-active", text: "one" })[
      Symbol.asyncIterator
    ]();
    // Pull the first event so the run registers as in flight.
    const started = await first.next();
    expect((started.value as { type: string }).type).toBe("message_started");

    const busyEvents = await collect(
      fixture.session.send({ requestId: "req-second", text: "two" }),
    );
    expect(busyEvents).toHaveLength(1);
    const busy = busyEvents[0];
    expect(busy?.type).toBe("error");
    if (busy?.type === "error") {
      expect(busy.code).toBe("session_busy");
      expect(busy.message).toContain("req-active");
    }

    // The in-flight run is unaffected — it still completes normally.
    const rest: string[] = [];
    let next = await first.next();
    while (next.done !== true) {
      rest.push((next.value as { type: string }).type);
      next = await first.next();
    }
    expect(rest.at(-1)).toBe("message_completed");
    // Only the first turn reached the runtime.
    expect(fixture.runtime.requests).toHaveLength(1);
  });
});

describe("keyless degradation", () => {
  it("refuses with auth_missing naming the variable and studio/.env; no runtime spawn", async () => {
    const fixture = makeSessionFixture({ env: {} });
    const events = await collect(
      fixture.session.send({
        requestId: "req-keyless",
        text: "wireframe a login screen in Swiss",
      }),
    );
    expect(events).toHaveLength(1);
    const error = events[0];
    expect(error?.type).toBe("error");
    if (error?.type === "error") {
      expect(error.code).toBe("auth_missing");
      expect(error.message).toContain(ANTHROPIC_API_KEY_VAR);
      expect(error.fix).toContain("studio/.env");
    }
    // No SDK process spawned — the runtime seam was never invoked.
    expect(fixture.runtime.requests).toHaveLength(0);
    // The refused turn is on the transcript.
    const refused = fixture.transcripts.records[0]?.payload as MessagePayload;
    expect(refused.status).toBe("refused");
  });

  it("recovers in place once a key appears (resolution re-runs per send)", async () => {
    const fixture = makeSessionFixture({ env: {}, scripts: [converseScript()] });
    const refusal = await collect(
      fixture.session.send({ requestId: "req-1", text: "hello" }),
    );
    expect(refusal[0]?.type).toBe("error");

    fixture.env[ANTHROPIC_API_KEY_VAR] = TEST_API_KEY;
    const events = await collect(
      fixture.session.send({ requestId: "req-2", text: "hello again" }),
    );
    expect(eventTypes(events).at(-1)).toBe("message_completed");
    expect((await fixture.auth.status()).status).toBe("configured");
  });

  it("reports auth status missing on the health surface while keyless", async () => {
    const fixture = makeSessionFixture({ env: {} });
    const report = await fixture.auth.status();
    expect(report.status).toBe("missing");
  });
});

describe("invalid key", () => {
  it("maps a runtime auth failure to auth_invalid and flips auth status", async () => {
    const fixture = makeSessionFixture({
      scripts: [
        [
          { type: "assistant_text", text: "..." },
          {
            type: "turn_failed",
            reason: "auth",
            message: "401 authentication_error: invalid x-api-key",
          },
        ],
      ],
    });
    const events = await collect(
      fixture.session.send({ requestId: "req-1", text: "generate something" }),
    );
    const last = events.at(-1);
    expect(last?.type).toBe("error");
    if (last?.type === "error") {
      expect(last.code).toBe("auth_invalid");
    }
    expect(fixture.auth.state().status).toBe("invalid");
    expect((await fixture.auth.status()).status).toBe("invalid");
    // Partial assistant text persists for the failed turn.
    const assistant = fixture.transcripts.records
      .map((record) => record.payload as MessagePayload)
      .find((payload) => payload.role === "assistant");
    expect(assistant?.status).toBe("failed");
  });
});
