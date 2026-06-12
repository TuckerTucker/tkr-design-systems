/**
 * Chat view-model reducer — pure-logic coverage of every contract event
 * type and the panel's local actions: streaming accumulation keyed by
 * messageId, re-sync replacement semantics, out-of-order tool events,
 * unknown-id tolerance, cancel/completion racing, error anchoring (turn,
 * chip row, refused send, protocol-level), chip re-run lifecycle, and
 * artifact-reference correlation (live requestId echo and restored head
 * snapshots anchored through the decision set).
 */
import { describe, expect, it } from "vitest";

import type { ApiError, DecisionChip, ServerMessage } from "@studio/contract";

import {
  chatReducer,
  initialChatState,
  isBusy,
  type ChatAction,
  type ChatViewState,
} from "../../../src/panels/chat/messageViewModel.js";

let seq = 0;

function server(message: Omit<ServerMessage, "seq">): ChatAction {
  seq += 1;
  return { kind: "server", message: { ...message, seq } as ServerMessage };
}

function reduce(state: ChatViewState, ...actions: ChatAction[]): ChatViewState {
  return actions.reduce(chatReducer, state);
}

function chips(): DecisionChip[] {
  return [
    { kind: "system", value: "swiss", options: ["swiss", "terminal"], rerunStep: "generate" },
    { kind: "layout", value: "dashboard", options: ["dashboard", "login"], rerunStep: "generate" },
    { kind: "platform", value: "desktop", options: ["mobile", "desktop"], rerunStep: "generate" },
  ];
}

function anError(overrides: Partial<ApiError> = {}): ApiError {
  return {
    code: "tool_failed",
    message: "It failed.",
    fix: "Fix it like this.",
    ...overrides,
  };
}

/** user_send + message_started for one turn. */
function openTurn(
  state: ChatViewState,
  requestId = "r1",
  messageId = "m1",
): ChatViewState {
  return reduce(
    state,
    { kind: "user_send", messageId: `user-${requestId}`, requestId, text: "brief" },
    server({
      type: "chat.message_started",
      requestId,
      payload: { messageId, workspaceId: "ws" },
    }),
  );
}

describe("streaming lifecycle", () => {
  it("user_send appends an optimistic user message and marks the request pending", () => {
    const state = reduce(initialChatState, {
      kind: "user_send",
      messageId: "user-r1",
      requestId: "r1",
      text: "a login screen",
    });
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]?.role).toBe("user");
    expect(state.messages[0]?.text).toBe("a login screen");
    expect(state.pendingRequestId).toBe("r1");
    expect(isBusy(state)).toBe(true);
  });

  it("message_started opens a streaming assistant turn and clears the pending request", () => {
    const state = openTurn(initialChatState);
    expect(state.messages).toHaveLength(2);
    const assistant = state.messages[1];
    expect(assistant?.role).toBe("assistant");
    expect(assistant?.streaming).toBe(true);
    expect(state.activeMessageId).toBe("m1");
    expect(state.pendingRequestId).toBeNull();
    expect(isBusy(state)).toBe(true);
  });

  it("assistant deltas accumulate on the message keyed by messageId", () => {
    const state = reduce(
      openTurn(initialChatState),
      server({ type: "chat.assistant_delta", payload: { messageId: "m1", delta: "Hello " } }),
      server({ type: "chat.assistant_delta", payload: { messageId: "m1", delta: "world" } }),
    );
    expect(state.messages[1]?.text).toBe("Hello world");
  });

  it("a delta for an unknown messageId is tolerated and changes nothing", () => {
    const before = openTurn(initialChatState);
    const after = reduce(
      before,
      server({ type: "chat.assistant_delta", payload: { messageId: "ghost", delta: "x" } }),
    );
    expect(after).toEqual(before);
  });

  it("message_completed closes the stream and merges its artifactRefs", () => {
    const state = reduce(
      openTurn(initialChatState),
      server({
        type: "chat.message_completed",
        requestId: "r1",
        payload: {
          messageId: "m1",
          artifactRefs: [{ artifactId: "login", version: 1 }],
          cancelled: false,
        },
      }),
    );
    expect(state.messages[1]?.streaming).toBe(false);
    expect(state.messages[1]?.artifactRefs).toEqual([
      { artifactId: "login", version: 1 },
    ]);
    expect(state.activeMessageId).toBeNull();
    expect(isBusy(state)).toBe(false);
  });

  it("a cancelled completion marks the turn stopped, not errored", () => {
    const state = reduce(
      openTurn(initialChatState),
      server({
        type: "chat.message_completed",
        requestId: "r1",
        payload: { messageId: "m1", artifactRefs: [], cancelled: true },
      }),
    );
    expect(state.messages[1]?.cancelled).toBe(true);
    expect(state.messages[1]?.error).toBeNull();
    expect(isBusy(state)).toBe(false);
  });

  it("completion for a turn that never opened is tolerated (cancel racing completion)", () => {
    const state = reduce(
      initialChatState,
      server({
        type: "chat.message_completed",
        payload: { messageId: "m9", artifactRefs: [], cancelled: false },
      }),
    );
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]?.streaming).toBe(false);
  });

  it("message_started for a known messageId is a re-sync replacement, never a duplicate", () => {
    const live = reduce(
      openTurn(initialChatState),
      server({ type: "chat.assistant_delta", payload: { messageId: "m1", delta: "old text" } }),
      server({
        type: "chat.message_completed",
        requestId: "r1",
        payload: { messageId: "m1", artifactRefs: [], cancelled: false },
      }),
    );
    // Full re-sync replays the same message from the transcript.
    const resynced = reduce(
      live,
      server({ type: "chat.message_started", payload: { messageId: "m1", workspaceId: "ws" } }),
      server({ type: "chat.assistant_delta", payload: { messageId: "m1", delta: "restored text" } }),
      server({
        type: "chat.message_completed",
        payload: { messageId: "m1", artifactRefs: [], cancelled: false },
      }),
    );
    const assistants = resynced.messages.filter((m) => m.messageId === "m1");
    expect(assistants).toHaveLength(1);
    expect(assistants[0]?.text).toBe("restored text");
    expect(assistants[0]?.streaming).toBe(false);
  });
});

describe("tool progress", () => {
  it("tool_started stacks running markers in start order on the owning message", () => {
    const state = reduce(
      openTurn(initialChatState),
      server({
        type: "chat.tool_started",
        payload: { messageId: "m1", toolCallId: "t1", tool: "wf_generate", summary: "Generating in swiss" },
      }),
      server({
        type: "chat.tool_started",
        payload: { messageId: "m1", toolCallId: "t2", tool: "wf_apply_substitutions", summary: "" },
      }),
    );
    const tools = state.messages[1]?.tools ?? [];
    expect(tools.map((t) => t.toolCallId)).toEqual(["t1", "t2"]);
    expect(tools[0]?.label).toBe("Generating in swiss");
    expect(tools[1]?.label).toBe("Applying content substitutions");
    expect(tools.every((t) => t.state === "running")).toBe(true);
  });

  it("tool_finished resolves its marker independently", () => {
    const state = reduce(
      openTurn(initialChatState),
      server({
        type: "chat.tool_started",
        payload: { messageId: "m1", toolCallId: "t1", tool: "wf_generate", summary: "Generating" },
      }),
      server({
        type: "chat.tool_finished",
        payload: { messageId: "m1", toolCallId: "t1", tool: "wf_generate", status: "ok", detail: "landed v1" },
      }),
    );
    const tool = state.messages[1]?.tools[0];
    expect(tool?.state).toBe("ok");
    expect(tool?.detail).toBe("landed v1");
  });

  it("tool_finished without a matching start creates the marker in its finished state", () => {
    const state = reduce(
      openTurn(initialChatState),
      server({
        type: "chat.tool_finished",
        payload: { messageId: "m1", toolCallId: "t9", tool: "wf_generate", status: "error", detail: "boom" },
      }),
    );
    const tool = state.messages[1]?.tools[0];
    expect(tool?.toolCallId).toBe("t9");
    expect(tool?.state).toBe("error");
  });

  it("a tool event with an unanchored messageId falls back to the active stream", () => {
    // The relay sends messageId "" when a tool starts before message_started
    // lands its id; the active message owns it.
    const state = reduce(
      openTurn(initialChatState),
      server({
        type: "chat.tool_started",
        payload: { messageId: "", toolCallId: "t1", tool: "wf_generate", summary: "Generating" },
      }),
    );
    expect(state.messages[1]?.tools).toHaveLength(1);
  });
});

describe("errors", () => {
  it("chat.error on an open turn renders on that turn and closes the stream", () => {
    const state = reduce(
      openTurn(initialChatState),
      server({
        type: "chat.error",
        requestId: "r1",
        payload: { messageId: "m1", error: anError() },
      }),
    );
    expect(state.messages[1]?.error?.message).toBe("It failed.");
    expect(state.messages[1]?.streaming).toBe(false);
    expect(isBusy(state)).toBe(false);
  });

  it("a refused send lands the error on the optimistic user message", () => {
    const state = reduce(
      initialChatState,
      { kind: "user_send", messageId: "user-r1", requestId: "r1", text: "brief" },
      server({
        type: "chat.error",
        requestId: "r1",
        payload: { error: anError({ code: "turn_in_progress" }) },
      }),
    );
    expect(state.messages[0]?.error?.code).toBe("turn_in_progress");
    expect(state.pendingRequestId).toBeNull();
  });

  it("a rejected chip.update reverts the rerun and lands the error at the chip row", () => {
    const opened = reduce(
      openTurn(initialChatState),
      server({
        type: "chips.updated",
        requestId: "r1",
        payload: { messageId: "m1", artifactId: "login", chips: chips() },
      }),
      server({
        type: "chat.message_completed",
        requestId: "r1",
        payload: { messageId: "m1", artifactRefs: [], cancelled: false },
      }),
    );
    const state = reduce(
      opened,
      { kind: "chip_update_sent", rerun: { requestId: "r2", messageId: "m1", kind: "system" } },
      server({
        type: "chat.error",
        requestId: "r2",
        payload: { error: anError({ code: "chip_invalid" }) },
      }),
    );
    expect(state.chipRerun).toBeNull();
    expect(state.messages[1]?.chipRow?.error?.code).toBe("chip_invalid");
    expect(isBusy(state)).toBe(false);
  });

  it("a protocol-level error with no anchor renders in the flow", () => {
    const state = reduce(
      initialChatState,
      server({ type: "chat.error", payload: { error: anError({ code: "not_attached" }) } }),
    );
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]?.error?.code).toBe("not_attached");
  });
});

describe("decision chips", () => {
  it("chips.updated attaches the row and tracks the latest editable set", () => {
    const first = reduce(
      openTurn(initialChatState),
      server({
        type: "chips.updated",
        requestId: "r1",
        payload: { messageId: "m1", artifactId: "login", chips: chips() },
      }),
    );
    expect(first.messages[1]?.chipRow?.artifactId).toBe("login");
    expect(first.latestChipsMessageId).toBe("m1");

    const second = reduce(
      openTurn(first, "r2", "m2"),
      server({
        type: "chips.updated",
        requestId: "r2",
        payload: { messageId: "m2", artifactId: "login", chips: chips() },
      }),
    );
    expect(second.latestChipsMessageId).toBe("m2");
  });

  it("chips.updated arriving again for the same turn replaces the row in place", () => {
    const updated = chips().map((chip) =>
      chip.kind === "system" ? { ...chip, value: "terminal" } : chip,
    );
    const state = reduce(
      openTurn(initialChatState),
      server({
        type: "chips.updated",
        requestId: "r1",
        payload: { messageId: "m1", artifactId: "login", chips: chips() },
      }),
      server({
        type: "chips.updated",
        requestId: "r1",
        payload: { messageId: "m1", artifactId: "login", chips: updated },
      }),
    );
    const row = state.messages[1]?.chipRow;
    expect(row?.chips.find((chip) => chip.kind === "system")?.value).toBe("terminal");
    expect(row?.chips).toHaveLength(3);
  });

  it("chips replayed BEFORE their message (transcript append order) attach when the turn opens", () => {
    // Wire truth (resync.ts): a turn's decision_chips record is appended
    // mid-turn, before its message record, so the replay emits
    // chips.updated first.
    const state = reduce(
      initialChatState,
      server({
        type: "chips.updated",
        payload: { messageId: "m1", artifactId: "login", chips: chips() },
      }),
      server({ type: "chat.message_started", payload: { messageId: "m1", workspaceId: "ws" } }),
      server({ type: "chat.assistant_delta", payload: { messageId: "m1", delta: "Done." } }),
      server({
        type: "chat.message_completed",
        payload: { messageId: "m1", artifactRefs: [], cancelled: false },
      }),
    );
    expect(state.messages[0]?.chipRow?.artifactId).toBe("login");
    expect(state.latestChipsMessageId).toBe("m1");
  });

  it("a repeated full re-sync re-attaches the buffered chips after the in-place rebuild", () => {
    const replay: ChatAction[] = [
      server({
        type: "chips.updated",
        payload: { messageId: "m1", artifactId: "login", chips: chips() },
      }),
      server({ type: "chat.message_started", payload: { messageId: "m1", workspaceId: "ws" } }),
      server({
        type: "chat.message_completed",
        payload: { messageId: "m1", artifactRefs: [], cancelled: false },
      }),
    ];
    seq = 0;
    const once = reduce(initialChatState, ...replay);
    const twice = reduce(once, ...replay);
    expect(twice.messages).toHaveLength(1);
    expect(twice.messages[0]?.chipRow?.artifactId).toBe("login");
  });

  it("chip_update_sent marks a rerun busy until its completion event", () => {
    const opened = reduce(
      openTurn(initialChatState),
      server({
        type: "chat.message_completed",
        requestId: "r1",
        payload: { messageId: "m1", artifactRefs: [], cancelled: false },
      }),
    );
    const sent = reduce(opened, {
      kind: "chip_update_sent",
      rerun: { requestId: "r2", messageId: "m1", kind: "system" },
    });
    expect(isBusy(sent)).toBe(true);

    const done = reduce(
      sent,
      server({
        type: "chat.message_started",
        requestId: "r2",
        payload: { messageId: "m2", workspaceId: "ws" },
      }),
      server({
        type: "chat.message_completed",
        requestId: "r2",
        payload: { messageId: "m2", artifactRefs: [], cancelled: false },
      }),
    );
    expect(done.chipRerun).toBeNull();
    expect(isBusy(done)).toBe(false);
  });
});

describe("artifact references", () => {
  it("version_created with a requestId anchors to the producing assistant turn", () => {
    const state = reduce(
      openTurn(initialChatState),
      server({
        type: "artifact.version_created",
        requestId: "r1",
        payload: {
          artifactId: "login",
          version: {
            number: 3,
            parent: 2,
            tool: "wf_generate",
            brief: "b",
            created: "2026-06-10T00:00:00.000Z",
            compliance: { status: "pending" },
          },
        },
      }),
    );
    expect(state.messages[1]?.artifactRefs).toEqual([
      { artifactId: "login", version: 3 },
    ]);
  });

  it("duplicate refs (event echo + completion payload) are merged once", () => {
    const state = reduce(
      openTurn(initialChatState),
      server({
        type: "artifact.version_created",
        requestId: "r1",
        payload: {
          artifactId: "login",
          version: {
            number: 3,
            parent: 2,
            tool: "wf_generate",
            brief: "b",
            created: "2026-06-10T00:00:00.000Z",
            compliance: { status: "pending" },
          },
        },
      }),
      server({
        type: "chat.message_completed",
        requestId: "r1",
        payload: {
          messageId: "m1",
          artifactRefs: [{ artifactId: "login", version: 3 }],
          cancelled: false,
        },
      }),
    );
    expect(state.messages[1]?.artifactRefs).toHaveLength(1);
  });

  it("a restored head snapshot (no requestId) anchors through the turn's decision set", () => {
    // Re-sync order: transcript messages, chips.updated, artifact heads.
    const state = reduce(
      initialChatState,
      server({ type: "chat.message_started", payload: { messageId: "m1", workspaceId: "ws" } }),
      server({ type: "chat.assistant_delta", payload: { messageId: "m1", delta: "Done." } }),
      server({
        type: "chat.message_completed",
        payload: { messageId: "m1", artifactRefs: [], cancelled: false },
      }),
      server({
        type: "chips.updated",
        payload: { messageId: "m1", artifactId: "login", chips: chips() },
      }),
      server({
        type: "artifact.version_created",
        payload: {
          artifactId: "login",
          version: {
            number: 2,
            parent: 1,
            tool: "wf_generate",
            brief: "b",
            created: "2026-06-10T00:00:00.000Z",
            compliance: { status: "pending" },
          },
        },
      }),
    );
    expect(state.messages[0]?.artifactRefs).toEqual([
      { artifactId: "login", version: 2 },
    ]);
  });

  it("a snapshot with no anchor at all is left to the canvas", () => {
    const state = reduce(
      initialChatState,
      server({
        type: "artifact.version_created",
        payload: {
          artifactId: "orphan",
          version: {
            number: 1,
            parent: null,
            tool: "wf_generate",
            brief: "b",
            created: "2026-06-10T00:00:00.000Z",
            compliance: { status: "pending" },
          },
        },
      }),
    );
    expect(state.messages).toHaveLength(0);
  });
});

describe("send failure and recovery", () => {
  it("send_failed marks the optimistic message and frees the composer", () => {
    const state = reduce(
      initialChatState,
      { kind: "user_send", messageId: "user-r1", requestId: "r1", text: "brief" },
      { kind: "send_failed", messageId: "user-r1" },
    );
    expect(state.messages[0]?.sendFailed).toBe(true);
    expect(state.pendingRequestId).toBeNull();
  });

  it("send_retried clears the failure and re-arms the pending request", () => {
    const state = reduce(
      initialChatState,
      { kind: "user_send", messageId: "user-r1", requestId: "r1", text: "brief" },
      { kind: "send_failed", messageId: "user-r1" },
      { kind: "send_retried", messageId: "user-r1", requestId: "r2" },
    );
    expect(state.messages[0]?.sendFailed).toBe(false);
    expect(state.messages[0]?.requestId).toBe("r2");
    expect(state.pendingRequestId).toBe("r2");
  });

  it("disconnected marks the streaming turn interrupted; a resumed delta clears it", () => {
    const interrupted = reduce(openTurn(initialChatState), { kind: "disconnected" });
    expect(interrupted.messages[1]?.interrupted).toBe(true);

    const resumed = reduce(
      interrupted,
      server({ type: "chat.assistant_delta", payload: { messageId: "m1", delta: "more" } }),
    );
    expect(resumed.messages[1]?.interrupted).toBe(false);
  });

  it("reset returns to the initial state (workspace isolation)", () => {
    const state = reduce(openTurn(initialChatState), { kind: "reset" });
    expect(state).toEqual(initialChatState);
  });
});
