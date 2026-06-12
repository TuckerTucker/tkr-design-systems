/**
 * Chat panel view model over a REAL composed studio-server with the
 * scripted AgentRuntime — the StudioSocket feeds the panel's pure reducer
 * exactly as useChatPanel wires it, proving the view model against wire
 * truth (chat-relay.ts and resync.ts, never harness-invented envelopes):
 *
 * attach → brief → streamed generation turn (deltas, inline tool progress,
 * decision chips, artifact reference correlated by the echoed requestId) →
 * chip.update re-run → reattach on a fresh connection restores the
 * transcript (messages, chips, head reference re-anchored).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";

import type { ServerMessage } from "@studio/contract";

import {
  fixtureGenerationScript,
  http,
  startApiServer,
  type ApiServerFixture,
} from "../../../server/test/api/api-helpers.js";
import { type Script } from "../../../server/test/agent/agent-helpers.js";

import {
  chatReducer,
  initialChatState,
  isBusy,
  type ChatViewState,
} from "../../src/panels/chat/messageViewModel.js";
import {
  createStudioSocket,
  type StudioSocket,
  type WebSocketLike,
} from "../../src/ws/studioSocket.js";

const CHAT_EVENT_TYPES = [
  "chat.message_started",
  "chat.assistant_delta",
  "chat.tool_started",
  "chat.tool_finished",
  "chat.message_completed",
  "chat.error",
  "chips.updated",
  "artifact.version_created",
] as const;

function waitUntil(
  condition: () => boolean,
  what: string | (() => string),
  timeoutMs = 30_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = (): void => {
      if (condition()) {
        resolve();
        return;
      }
      if (Date.now() > deadline) {
        const detail = typeof what === "function" ? what() : what;
        reject(new Error(`Timed out waiting for ${detail}`));
        return;
      }
      setTimeout(tick, 20);
    };
    tick();
  });
}

function nodeWebSocket(url: string): WebSocketLike {
  const ws = new WebSocket(url);
  const wrapper: WebSocketLike = {
    get readyState(): number {
      return ws.readyState;
    },
    send: (data: string) => ws.send(data),
    close: (code?: number, reason?: string) => ws.close(code, reason),
    onopen: null,
    onclose: null,
    onerror: null,
    onmessage: null,
  };
  ws.on("open", () => wrapper.onopen?.({}));
  ws.on("close", () => wrapper.onclose?.({}));
  ws.on("error", () => wrapper.onerror?.({}));
  ws.on("message", (data) => wrapper.onmessage?.({ data: String(data) }));
  return wrapper;
}

/** A reducer store wired to the socket exactly as useChatPanel wires it. */
interface PanelStore {
  socket: StudioSocket;
  state(): ChatViewState;
  events: ServerMessage[];
}

function createPanelStore(wsUrl: string, label: string): PanelStore {
  let state = initialChatState;
  const events: ServerMessage[] = [];
  let counter = 0;
  const socket = createStudioSocket({
    url: wsUrl,
    createWebSocket: nodeWebSocket,
    backoffInitialMs: 50,
    backoffMaxMs: 400,
    generateRequestId: () => `${label}-${(counter += 1)}`,
  });
  for (const type of CHAT_EVENT_TYPES) {
    socket.on(type, (message) => {
      events.push(message);
      state = chatReducer(state, { kind: "server", message });
    });
  }
  return { socket, state: () => state, events };
}

describe("chat panel view model against the real server", () => {
  let fixture: ApiServerFixture;
  let workspaceId: string;
  const scripts: Script[] = [];
  const stores: PanelStore[] = [];

  beforeAll(async () => {
    fixture = await startApiServer({ scripts });
    const created = await http(fixture.base, "POST", "/api/workspaces", {
      name: "Chat Panel Integration",
    });
    expect(created.status).toBe(201);
    workspaceId = (created.body as { id: string }).id;
  }, 120_000);

  afterAll(async () => {
    for (const store of stores) {
      store.socket.close();
    }
    await fixture.close();
  });

  async function attach(label: string): Promise<PanelStore> {
    const store = createPanelStore(fixture.wsUrl, label);
    stores.push(store);
    store.socket.connect();
    await waitUntil(() => store.socket.state() === "open", `${label} open`);
    store.socket.attachWorkspace(workspaceId);
    await waitUntil(
      () => store.socket.lastSeq() !== undefined,
      `${label} attach acknowledgement`,
    );
    return store;
  }

  it("streams a generation turn, re-runs a chip, and restores the transcript on reattach", async () => {
    const live = await attach("live");

    // ── Brief → streamed generation turn (scripted runtime, real seams) ──
    scripts.push(
      fixtureGenerationScript(fixture.stagingDir, {
        brief: "a dashboard for a meditation app",
      }),
    );
    const sent = live.socket.send({
      type: "chat.send",
      requestId: "turn-1",
      payload: { text: "a dashboard for a meditation app" },
    });
    expect(sent).toEqual({ ok: true });

    await waitUntil(
      () =>
        live
          .events.some((event) => event.type === "chat.message_completed"),
      "the generation turn to complete",
      60_000,
    );

    const state = live.state();
    expect(isBusy(state)).toBe(false);
    expect(state.messages).toHaveLength(1);
    const turn = state.messages[0];
    expect(turn?.role).toBe("assistant");
    expect(turn?.streaming).toBe(false);
    expect(turn?.text).toContain("Generating with the dashboard layout");
    // Inline tool progress resolved on the turn.
    expect(turn?.tools.length).toBeGreaterThan(0);
    expect(turn?.tools.every((tool) => tool.state === "ok")).toBe(true);
    // Decision chips landed on the turn and are the latest editable set.
    expect(turn?.chipRow).not.toBeNull();
    expect(turn?.chipRow?.chips.map((chip) => chip.kind)).toEqual([
      "system",
      "layout",
      "platform",
    ]);
    expect(state.latestChipsMessageId).toBe(turn?.messageId);
    // The artifact reference correlated through the echoed requestId.
    expect(turn?.artifactRefs).toHaveLength(1);
    expect(turn?.artifactRefs[0]?.version).toBe(1);
    const artifactId = turn?.artifactRefs[0]?.artifactId as string;
    const chipMessageId = turn?.messageId as string;

    // ── Chip re-run: chip.update { messageId, kind, value } on the wire ──
    scripts.push(
      fixtureGenerationScript(fixture.stagingDir, { platform: "mobile" }),
    );
    const platformChip = turn?.chipRow?.chips.find(
      (chip) => chip.kind === "platform",
    );
    expect(platformChip?.options).toContain("mobile");
    const updated = live.socket.send({
      type: "chip.update",
      requestId: "rerun-1",
      payload: { messageId: chipMessageId, kind: "platform", value: "mobile" },
    });
    expect(updated).toEqual({ ok: true });

    await waitUntil(
      () =>
        live.events.filter((event) => event.type === "chat.message_completed")
          .length >= 2,
      "the chip re-run to complete",
      60_000,
    );
    const afterRerun = live.state();
    expect(afterRerun.messages.length).toBeGreaterThanOrEqual(2);
    expect(isBusy(afterRerun)).toBe(false);

    // ── Reattach on a fresh connection: full transcript restore ──
    const restored = await attach("restore");
    await waitUntil(
      () =>
        restored
          .state()
          .messages.some((message) => message.artifactRefs.length > 0),
      () =>
        `the restored transcript with its head reference; saw [${restored.events
          .map((event) => event.type)
          .join(", ")}] state=${JSON.stringify(restored.state())}`,
      30_000,
    );
    const restoredState = restored.state();

    // Every assistant turn restored in order with its text.
    expect(restoredState.messages.length).toBe(afterRerun.messages.length);
    expect(restoredState.messages[0]?.text).toContain(
      "Generating with the dashboard layout",
    );
    expect(restoredState.messages.every((m) => !m.streaming)).toBe(true);
    // Chips restored; the latest set stays the editable one.
    expect(
      restoredState.messages.filter((message) => message.chipRow !== null)
        .length,
    ).toBeGreaterThanOrEqual(1);
    expect(restoredState.latestChipsMessageId).not.toBeNull();
    // The artifact head re-anchored through the decision set is clickable
    // after restore (no requestId on snapshot envelopes — wire truth).
    const anchored = restoredState.messages.find(
      (message) => message.artifactRefs.length > 0,
    );
    expect(anchored?.artifactRefs[0]?.artifactId).toBe(artifactId);
  }, 120_000);
});
