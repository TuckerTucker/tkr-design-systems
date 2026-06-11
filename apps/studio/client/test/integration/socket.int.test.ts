/**
 * StudioSocket over a REAL /ws connection to a real composed server —
 * attach acknowledgement (bridge.status then auth.status, requestId echo
 * on the first envelope), ordered seq on a streamed chat turn, drop →
 * reconnect → automatic re-attach with the lastEventSeq resume cursor,
 * and typed disconnected sends.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";

import type { ServerMessage } from "@studio/contract";

import {
  startApiServer,
  http,
  type ApiServerFixture,
} from "../../../server/test/api/api-helpers.js";
import { converseScript, type Script } from "../../../server/test/agent/agent-helpers.js";

import {
  createStudioSocket,
  type ConnectionState,
  type StudioSocket,
  type WebSocketLike,
} from "../../src/ws/studioSocket.js";

function waitUntil(
  condition: () => boolean,
  what: string,
  timeoutMs = 15_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = (): void => {
      if (condition()) {
        resolve();
        return;
      }
      if (Date.now() > deadline) {
        reject(new Error(`Timed out waiting for ${what}`));
        return;
      }
      setTimeout(tick, 20);
    };
    tick();
  });
}

interface TrackedTransport {
  createWebSocket: (url: string) => WebSocketLike;
  /** Raw frames the client sent, across all connections. */
  sentFrames: string[];
  /** Underlying sockets, in creation order. */
  sockets: WebSocket[];
}

function trackedTransport(): TrackedTransport {
  const sentFrames: string[] = [];
  const sockets: WebSocket[] = [];
  return {
    sentFrames,
    sockets,
    createWebSocket(url: string): WebSocketLike {
      const ws = new WebSocket(url);
      sockets.push(ws);
      const wrapper: WebSocketLike = {
        get readyState(): number {
          return ws.readyState;
        },
        send(data: string): void {
          sentFrames.push(data);
          ws.send(data);
        },
        close(code?: number, reason?: string): void {
          ws.close(code, reason);
        },
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
    },
  };
}

describe("StudioSocket against the real server", () => {
  let fixture: ApiServerFixture;
  let workspaceId: string;
  const scripts: Script[] = [];
  const openSockets: StudioSocket[] = [];

  beforeAll(async () => {
    fixture = await startApiServer({ scripts });
    const created = await http(fixture.base, "POST", "/api/workspaces", {
      name: "Socket Test",
    });
    expect(created.status).toBe(201);
    workspaceId = (created.body as { id: string }).id;
  });

  afterAll(async () => {
    for (const socket of openSockets) {
      socket.close();
    }
    await fixture.close();
  });

  function makeSocket(transport = trackedTransport()): {
    socket: StudioSocket;
    transport: TrackedTransport;
    events: ServerMessage[];
    states: ConnectionState[];
  } {
    const events: ServerMessage[] = [];
    const states: ConnectionState[] = [];
    const socket = createStudioSocket({
      url: fixture.wsUrl,
      createWebSocket: transport.createWebSocket,
      backoffInitialMs: 50,
      backoffMaxMs: 400,
      generateRequestId: () => `rid-${events.length}-${Date.now()}`,
    });
    socket.onConnectionState((state) => states.push(state));
    for (const type of [
      "bridge.status",
      "auth.status",
      "chat.message_started",
      "chat.assistant_delta",
      "chat.message_completed",
    ] as const) {
      socket.on(type, (message) => events.push(message));
    }
    openSockets.push(socket);
    return { socket, transport, events, states };
  }

  it("attach is acknowledged with bridge.status then auth.status, requestId echoed", async () => {
    const { socket, events } = makeSocket();
    socket.connect();
    await waitUntil(() => socket.state() === "open", "socket open");
    socket.attachWorkspace(workspaceId);
    await waitUntil(() => events.length >= 2, "attach acknowledgement");

    expect(events[0]?.type).toBe("bridge.status");
    expect(events[1]?.type).toBe("auth.status");
    expect(events[0]?.requestId).toMatch(/^rid-/);
    // seq is monotonic across the acknowledgement.
    expect(events[1]!.seq).toBeGreaterThanOrEqual(events[0]!.seq);
    expect(socket.lastSeq()).toBe(events[1]!.seq);
  });

  it("streams a chat turn with strictly ordered seq", async () => {
    const { socket, events } = makeSocket();
    socket.connect();
    await waitUntil(() => socket.state() === "open", "socket open");
    socket.attachWorkspace(workspaceId);
    await waitUntil(() => events.length >= 2, "attach acknowledgement");

    scripts.push(converseScript("Hello from the scripted runtime. "));
    const sent = socket.send({
      type: "chat.send",
      requestId: "turn-1",
      payload: { text: "say hello" },
    });
    expect(sent).toEqual({ ok: true });

    await waitUntil(
      () => events.some((event) => event.type === "chat.message_completed"),
      "the chat turn to complete",
    );
    const turnEvents = events.filter((event) =>
      event.type.startsWith("chat."),
    );
    const types = turnEvents.map((event) => event.type);
    expect(types[0]).toBe("chat.message_started");
    expect(types.at(-1)).toBe("chat.message_completed");
    expect(
      types.slice(1, -1).every((type) => type === "chat.assistant_delta"),
    ).toBe(true);
    expect(types).toContain("chat.assistant_delta");
    // Journaled live events are strictly ordered; attach snapshots may
    // share the head seq, so the overall stream is non-decreasing.
    const seqs = events.map((event) => event.seq);
    for (let i = 1; i < seqs.length; i += 1) {
      expect(seqs[i]!).toBeGreaterThanOrEqual(seqs[i - 1]!);
    }
    const turnSeqs = turnEvents.map((event) => event.seq);
    for (let i = 1; i < turnSeqs.length; i += 1) {
      expect(turnSeqs[i]!).toBeGreaterThan(turnSeqs[i - 1]!);
    }
  });

  it("reconnects after a drop and re-attaches automatically with the resume cursor", async () => {
    const transport = trackedTransport();
    const { socket, events, states } = makeSocket(transport);
    socket.connect();
    await waitUntil(() => socket.state() === "open", "socket open");
    socket.attachWorkspace(workspaceId);
    await waitUntil(() => events.length >= 2, "attach acknowledgement");
    const seqBeforeDrop = socket.lastSeq();
    expect(seqBeforeDrop).toBeDefined();
    const eventCountBeforeDrop = events.length;

    // Kill the transport out from under the client (server restart blip).
    transport.sockets.at(-1)!.terminate();
    await waitUntil(
      () => states.includes("reconnecting"),
      "the reconnecting state",
    );

    // Reconnect happens by itself; the attach is re-sent with lastEventSeq.
    await waitUntil(
      () => socket.state() === "open" && events.length >= eventCountBeforeDrop + 2,
      "automatic re-attach acknowledgement",
    );
    const attaches = transport.sentFrames
      .map((frame) => JSON.parse(frame) as { type: string; payload: Record<string, unknown> })
      .filter((frame) => frame.type === "workspace.attach");
    expect(attaches.length).toBeGreaterThanOrEqual(2);
    expect(attaches.at(-1)?.payload["lastEventSeq"]).toBe(seqBeforeDrop);
    expect(attaches.at(-1)?.payload["workspaceId"]).toBe(workspaceId);

    // While dropped, sends were typed failures, never silent (state check).
    expect(states).toContain("reconnecting");
  });

  it("send while disconnected returns the typed disconnected result", () => {
    const { socket } = makeSocket();
    // Never connected.
    const result = socket.send({
      type: "chat.send",
      payload: { text: "queued?" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("disconnected");
    }
  });
});
