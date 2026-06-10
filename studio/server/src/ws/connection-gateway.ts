/**
 * WebSocket upgrade plumbing at /ws — connection acceptance, heartbeat,
 * close semantics, and the WsConnection abstraction handed to a pluggable
 * message handler.
 *
 * Message SEMANTICS deliberately live elsewhere: studio-api registers the
 * WsConnectionHandler in Wave 4. Until then, inbound messages are answered
 * with a typed `server.not_ready` error envelope and the connection stays
 * open. Raw strings are forwarded without parsing or evaluation — schema
 * validation is studio-api's boundary.
 */
import { randomUUID } from "node:crypto";
import fastifyWebsocket from "@fastify/websocket";
import type { FastifyPluginAsync } from "fastify";
import type { WebSocket } from "ws";

import type { Logger } from "../logging/create-logger.js";

/** Transport-level connection abstraction decoupling consumers from `ws`. */
export interface WsConnection {
  /** UUID bound into every lifecycle log line for this connection. */
  connectionId: string;
  send(raw: string): void;
  close(code: number, reason: string): void;
  onMessage(listener: (raw: string) => void): void;
  onClose(listener: (code: number, reason: string) => void): void;
}

/** Seam registered by studio-api (Wave 4) — owns all message semantics. */
export interface WsConnectionHandler {
  onConnection(connection: WsConnection): void;
}

export const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000;

export interface ConnectionGatewayOptions {
  logger: Logger;
  handler?: WsConnectionHandler;
  /**
   * Ping cadence. A connection that has not answered the previous ping by
   * the time the next one is due (one missed interval) is terminated.
   */
  heartbeatIntervalMs?: number;
}

export interface ConnectionGateway {
  /** Fastify plugin registering @fastify/websocket and the /ws route. */
  plugin: FastifyPluginAsync;
  /** Open-connection count (used by tests and diagnostics). */
  openConnectionCount(): number;
  /** Stop accepting upgrades (entered at shutdown start). */
  refuseNewConnections(): void;
  /** Close every open connection — shutdown sends 1001 before hooks run. */
  closeAll(code: number, reason: string): void;
}

/**
 * Sent in response to any inbound message while no WsConnectionHandler is
 * registered. Shape follows the architecture envelope ({ type, seq,
 * payload }); the canonical error envelope type lands in @studio/contract
 * errors.ts when studio-api arrives (Wave 4).
 */
const NOT_READY_ENVELOPE = JSON.stringify({
  type: "server.not_ready",
  seq: 0,
  payload: {
    message: "No WebSocket message handler is registered yet",
    detail:
      "Message semantics arrive with studio-api; until then the connection accepts no commands.",
  },
});

export function createConnectionGateway(
  options: ConnectionGatewayOptions,
): ConnectionGateway {
  const {
    logger,
    handler,
    heartbeatIntervalMs = DEFAULT_HEARTBEAT_INTERVAL_MS,
  } = options;

  const sockets = new Set<WebSocket>();
  let refusing = false;

  function handleConnection(socket: WebSocket): void {
    const connectionId = randomUUID();
    const log = logger.child({ connectionId });

    if (refusing) {
      log.info("upgrade refused: server is shutting down");
      socket.close(1001, "server is shutting down");
      return;
    }

    sockets.add(socket);
    log.info("websocket connection opened");

    const messageListeners: Array<(raw: string) => void> = [];
    const closeListeners: Array<(code: number, reason: string) => void> = [];

    const connection: WsConnection = {
      connectionId,
      send(raw) {
        if (socket.readyState === socket.OPEN) {
          socket.send(raw);
        } else {
          log.debug("send skipped: connection is not open");
        }
      },
      close(code, reason) {
        socket.close(code, reason);
      },
      onMessage(listener) {
        messageListeners.push(listener);
      },
      onClose(listener) {
        closeListeners.push(listener);
      },
    };

    // Heartbeat: mark not-alive, ping; a pong flips it back. Still
    // not-alive when the next tick fires means one full interval passed
    // without a pong — terminate.
    let alive = true;
    socket.on("pong", () => {
      alive = true;
    });
    const heartbeat = setInterval(() => {
      if (!alive) {
        log.warn(
          { heartbeatIntervalMs },
          "websocket terminated: heartbeat pong missed",
        );
        socket.terminate();
        return;
      }
      alive = false;
      socket.ping();
    }, heartbeatIntervalMs);

    socket.on("message", (data) => {
      const raw = Array.isArray(data)
        ? Buffer.concat(data).toString("utf8")
        : Buffer.from(data as ArrayBuffer).toString("utf8");
      if (handler === undefined) {
        log.debug("message received before a handler is registered");
        connection.send(NOT_READY_ENVELOPE);
        return;
      }
      for (const listener of messageListeners) {
        listener(raw);
      }
    });

    socket.on("close", (code, reasonBuf) => {
      clearInterval(heartbeat);
      sockets.delete(socket);
      const reason = reasonBuf.toString("utf8");
      log.info({ code, reason }, "websocket connection closed");
      for (const listener of closeListeners) {
        listener(code, reason);
      }
    });

    socket.on("error", (err) => {
      log.warn({ err }, "websocket connection error");
    });

    handler?.onConnection(connection);
  }

  const plugin: FastifyPluginAsync = async (app) => {
    await app.register(fastifyWebsocket);
    app.get("/ws", { websocket: true }, (socket) => {
      handleConnection(socket);
    });
  };

  return {
    plugin,
    openConnectionCount() {
      return sockets.size;
    },
    refuseNewConnections() {
      refusing = true;
    },
    closeAll(code, reason) {
      for (const socket of sockets) {
        socket.close(code, reason);
      }
    },
  };
}
