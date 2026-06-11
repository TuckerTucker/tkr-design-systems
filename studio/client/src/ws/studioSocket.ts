/**
 * StudioSocket — the single typed WebSocket client over the
 * @studio/contract envelope. One /ws connection; workspaces attach by
 * message (architecture contract).
 *
 * - send() returns a typed SendResult while disconnected — never a silent
 *   drop, so panels can disable affordances with the reason in place
 * - reconnect uses capped exponential backoff; once the delay reaches the
 *   cap the state reads "offline" while retries continue at the capped
 *   interval
 * - workspace.attach is re-sent automatically after every reconnect with
 *   the last seq seen, so the server replays missed events or re-syncs
 * - inbound messages are validated against the contract vocabulary;
 *   unknown types are reported to the injected onProtocolIssue and
 *   dropped, never executed
 *
 * The WebSocket constructor is injected (browser global by default; the
 * `ws` package in node integration tests).
 */
import {
  SERVER_MESSAGE_TYPES,
  type ClientMessage,
  type ServerMessage,
} from "@studio/contract";

export type ConnectionState =
  | "connecting"
  | "open"
  | "reconnecting"
  | "offline";

export type Unsubscribe = () => void;

export type SendResult =
  | { ok: true }
  | { ok: false; reason: "disconnected"; state: ConnectionState };

export interface StudioSocket {
  connect(): void;
  /** Sends workspace.attach; re-sent automatically after every reconnect. */
  attachWorkspace(workspaceId: string): void;
  send(message: ClientMessage): SendResult;
  on<T extends ServerMessage["type"]>(
    type: T,
    handler: (message: Extract<ServerMessage, { type: T }>) => void,
  ): Unsubscribe;
  onConnectionState(handler: (state: ConnectionState) => void): Unsubscribe;
  state(): ConnectionState;
  /** Last server seq seen for the attached workspace (resume cursor). */
  lastSeq(): number | undefined;
  attachedWorkspaceId(): string | null;
  close(): void;
}

/** The subset of the WebSocket surface the client uses (browser and ws). */
export interface WebSocketLike {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((event: unknown) => void) | null;
  onclose: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
}

const WS_OPEN = 1;

export interface StudioSocketOptions {
  url: string;
  createWebSocket?: (url: string) => WebSocketLike;
  backoffInitialMs?: number;
  backoffMaxMs?: number;
  setTimeoutImpl?: typeof setTimeout;
  clearTimeoutImpl?: typeof clearTimeout;
  /** Invalid inbound frames (diagnostics seam; defaults to silent drop). */
  onProtocolIssue?: (detail: string) => void;
  generateRequestId?: () => string;
}

const SERVER_TYPES: ReadonlySet<string> = new Set(SERVER_MESSAGE_TYPES);

/** Browser WebSocket by default; node callers must inject (ws package). */
function defaultCreateWebSocket(url: string): WebSocketLike {
  const ctor = (
    globalThis as { WebSocket?: new (url: string) => unknown }
  ).WebSocket;
  if (ctor === undefined) {
    throw new Error(
      "No global WebSocket implementation; inject createWebSocket.",
    );
  }
  return new ctor(url) as WebSocketLike;
}

function defaultRequestId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi !== undefined && "randomUUID" in cryptoApi) {
    return cryptoApi.randomUUID();
  }
  return `req-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function parseServerMessage(data: unknown): ServerMessage | null {
  if (typeof data !== "string") {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  const candidate = parsed as { type?: unknown; seq?: unknown; payload?: unknown };
  if (
    typeof candidate.type !== "string" ||
    !SERVER_TYPES.has(candidate.type) ||
    typeof candidate.seq !== "number" ||
    typeof candidate.payload !== "object" ||
    candidate.payload === null
  ) {
    return null;
  }
  return parsed as ServerMessage;
}

export function createStudioSocket(options: StudioSocketOptions): StudioSocket {
  const createWebSocket = options.createWebSocket ?? defaultCreateWebSocket;
  const backoffInitial = options.backoffInitialMs ?? 500;
  const backoffMax = options.backoffMaxMs ?? 16_000;
  const setT = options.setTimeoutImpl ?? setTimeout;
  const clearT = options.clearTimeoutImpl ?? clearTimeout;
  const onProtocolIssue = options.onProtocolIssue ?? ((): void => undefined);
  const generateRequestId = options.generateRequestId ?? defaultRequestId;

  let socket: WebSocketLike | null = null;
  let connectionState: ConnectionState = "connecting";
  let closedByUs = false;
  let backoffDelay = backoffInitial;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let workspaceId: string | null = null;
  let lastSeqSeen: number | undefined;

  const stateHandlers = new Set<(state: ConnectionState) => void>();
  const messageHandlers = new Map<
    string,
    Set<(message: ServerMessage) => void>
  >();

  function setState(state: ConnectionState): void {
    if (state === connectionState) {
      return;
    }
    connectionState = state;
    for (const handler of stateHandlers) {
      handler(state);
    }
  }

  function sendAttach(): void {
    if (socket === null || socket.readyState !== WS_OPEN || workspaceId === null) {
      return;
    }
    const attach: ClientMessage = {
      type: "workspace.attach",
      requestId: generateRequestId(),
      payload: {
        workspaceId,
        ...(lastSeqSeen !== undefined ? { lastEventSeq: lastSeqSeen } : {}),
      },
    };
    socket.send(JSON.stringify(attach));
  }

  function scheduleReconnect(): void {
    if (closedByUs || retryTimer !== null) {
      return;
    }
    setState(backoffDelay >= backoffMax ? "offline" : "reconnecting");
    retryTimer = setT(() => {
      retryTimer = null;
      openSocket();
    }, backoffDelay);
    backoffDelay = Math.min(backoffMax, backoffDelay * 2);
  }

  function handleMessage(event: { data: unknown }): void {
    const message = parseServerMessage(event.data);
    if (message === null) {
      onProtocolIssue(
        `dropped an invalid or unknown websocket frame: ${String(event.data).slice(0, 120)}`,
      );
      return;
    }
    if (lastSeqSeen === undefined || message.seq > lastSeqSeen) {
      lastSeqSeen = message.seq;
    }
    const handlers = messageHandlers.get(message.type);
    if (handlers !== undefined) {
      for (const handler of [...handlers]) {
        handler(message);
      }
    }
  }

  function openSocket(): void {
    if (closedByUs) {
      return;
    }
    const ws = createWebSocket(options.url);
    socket = ws;
    ws.onopen = () => {
      if (socket !== ws) {
        return;
      }
      backoffDelay = backoffInitial;
      setState("open");
      sendAttach();
    };
    ws.onmessage = (event) => {
      if (socket === ws) {
        handleMessage(event);
      }
    };
    ws.onerror = () => {
      // The close handler owns the reconnect; errors alone are noise.
    };
    ws.onclose = () => {
      if (socket !== ws) {
        return;
      }
      socket = null;
      if (!closedByUs) {
        scheduleReconnect();
      }
    };
  }

  return {
    connect(): void {
      if (socket !== null || retryTimer !== null) {
        return;
      }
      closedByUs = false;
      setState("connecting");
      openSocket();
    },

    attachWorkspace(id: string): void {
      if (id !== workspaceId) {
        workspaceId = id;
        // Seq is per-workspace on the server; a fresh attach re-syncs.
        lastSeqSeen = undefined;
      }
      sendAttach();
    },

    send(message: ClientMessage): SendResult {
      if (socket === null || socket.readyState !== WS_OPEN) {
        return { ok: false, reason: "disconnected", state: connectionState };
      }
      socket.send(JSON.stringify(message));
      return { ok: true };
    },

    on<T extends ServerMessage["type"]>(
      type: T,
      handler: (message: Extract<ServerMessage, { type: T }>) => void,
    ): Unsubscribe {
      let handlers = messageHandlers.get(type);
      if (handlers === undefined) {
        handlers = new Set();
        messageHandlers.set(type, handlers);
      }
      const wrapped = handler as (message: ServerMessage) => void;
      handlers.add(wrapped);
      return () => {
        handlers.delete(wrapped);
      };
    },

    onConnectionState(handler: (state: ConnectionState) => void): Unsubscribe {
      stateHandlers.add(handler);
      return () => {
        stateHandlers.delete(handler);
      };
    },

    state: () => connectionState,
    lastSeq: () => lastSeqSeen,
    attachedWorkspaceId: () => workspaceId,

    close(): void {
      closedByUs = true;
      if (retryTimer !== null) {
        clearT(retryTimer);
        retryTimer = null;
      }
      if (socket !== null) {
        socket.close(1000, "client closed");
        socket = null;
      }
    },
  };
}
