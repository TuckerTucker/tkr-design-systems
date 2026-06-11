/**
 * StudioSocket units against a scripted fake transport — connection state
 * machine, capped backoff to "offline", typed disconnected sends, attach
 * re-send with the resume cursor, unknown-frame drop. The real-server
 * behavior is covered by the integration suite.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createStudioSocket,
  type WebSocketLike,
} from "../../src/ws/studioSocket.js";

class FakeSocket implements WebSocketLike {
  static instances: FakeSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen: ((event: unknown) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;

  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.simulateClose();
  }

  simulateOpen(): void {
    this.readyState = 1;
    this.onopen?.({});
  }

  simulateClose(): void {
    this.readyState = 3;
    this.onclose?.({});
  }

  simulateMessage(data: string): void {
    this.onmessage?.({ data });
  }
}

function envelope(type: string, seq: number, payload: unknown = {}): string {
  return JSON.stringify({ type, seq, payload });
}

describe("createStudioSocket", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeSocket.instances = [];
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function makeSocket(issues: string[] = []) {
    const states: string[] = [];
    const socket = createStudioSocket({
      url: "ws://test/ws",
      createWebSocket: (url) => new FakeSocket(url),
      backoffInitialMs: 100,
      backoffMaxMs: 200,
      onProtocolIssue: (detail) => issues.push(detail),
      generateRequestId: () => "rid-1",
    });
    socket.onConnectionState((state) => states.push(state));
    return { socket, states };
  }

  it("attaches on open and re-attaches with lastEventSeq after reconnect", () => {
    const { socket } = makeSocket();
    socket.connect();
    socket.attachWorkspace("ws-a");
    const first = FakeSocket.instances[0]!;
    first.simulateOpen();
    expect(first.sent).toHaveLength(1);
    const attach1 = JSON.parse(first.sent[0]!) as {
      type: string;
      payload: { workspaceId: string; lastEventSeq?: number };
    };
    expect(attach1.type).toBe("workspace.attach");
    expect(attach1.payload).toEqual({ workspaceId: "ws-a" });

    first.simulateMessage(envelope("bridge.status", 4, { state: "up" }));
    first.simulateMessage(envelope("auth.status", 5, { state: "missing" }));
    expect(socket.lastSeq()).toBe(5);

    first.simulateClose();
    expect(socket.state()).toBe("reconnecting");
    vi.advanceTimersByTime(100);
    const second = FakeSocket.instances[1]!;
    second.simulateOpen();
    const attach2 = JSON.parse(second.sent[0]!) as {
      payload: { workspaceId: string; lastEventSeq?: number };
    };
    expect(attach2.payload).toEqual({ workspaceId: "ws-a", lastEventSeq: 5 });
    expect(socket.state()).toBe("open");
  });

  it("reaches offline at the backoff cap while retries continue", () => {
    const { socket, states } = makeSocket();
    socket.connect();
    FakeSocket.instances[0]!.simulateOpen();
    FakeSocket.instances[0]!.simulateClose();
    expect(socket.state()).toBe("reconnecting");
    vi.advanceTimersByTime(100); // retry #1 (delay now 200 = cap)
    FakeSocket.instances[1]!.simulateClose();
    expect(socket.state()).toBe("offline");
    vi.advanceTimersByTime(200); // retries continue at the capped interval
    expect(FakeSocket.instances).toHaveLength(3);
    expect(states).toContain("offline");
  });

  it("send while disconnected returns a typed result, never a silent drop", () => {
    const { socket } = makeSocket();
    const result = socket.send({
      type: "chat.send",
      payload: { text: "hello" },
    });
    expect(result).toEqual({
      ok: false,
      reason: "disconnected",
      state: "connecting",
    });
  });

  it("dispatches typed events to on() subscribers and supports unsubscribe", () => {
    const { socket } = makeSocket();
    socket.connect();
    const first = FakeSocket.instances[0]!;
    first.simulateOpen();
    const seen: number[] = [];
    const off = socket.on("chat.assistant_delta", (message) => {
      seen.push(message.seq);
    });
    first.simulateMessage(
      envelope("chat.assistant_delta", 1, { messageId: "m", delta: "a" }),
    );
    off();
    first.simulateMessage(
      envelope("chat.assistant_delta", 2, { messageId: "m", delta: "b" }),
    );
    expect(seen).toEqual([1]);
  });

  it("drops unknown or malformed frames and reports them", () => {
    const issues: string[] = [];
    const { socket } = makeSocket(issues);
    socket.connect();
    const first = FakeSocket.instances[0]!;
    first.simulateOpen();
    first.simulateMessage("not json");
    first.simulateMessage(JSON.stringify({ type: "evil.exec", seq: 1, payload: {} }));
    first.simulateMessage(JSON.stringify({ type: "bridge.status" })); // no seq
    expect(issues).toHaveLength(3);
    expect(socket.lastSeq()).toBeUndefined();
  });

  it("switching workspaces resets the resume cursor", () => {
    const { socket } = makeSocket();
    socket.connect();
    const first = FakeSocket.instances[0]!;
    first.simulateOpen();
    socket.attachWorkspace("ws-a");
    first.simulateMessage(envelope("bridge.status", 9, { state: "up" }));
    expect(socket.lastSeq()).toBe(9);
    socket.attachWorkspace("ws-b");
    expect(socket.lastSeq()).toBeUndefined();
    const attach = JSON.parse(first.sent.at(-1)!) as {
      payload: { workspaceId: string; lastEventSeq?: number };
    };
    expect(attach.payload).toEqual({ workspaceId: "ws-b" });
  });
});
