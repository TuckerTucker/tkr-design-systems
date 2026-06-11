/**
 * WS connection registry and message dispatch — the WsConnectionHandler
 * studio-api registers on the foundation's gateway seam.
 *
 * Owns: boundary validation of every inbound message (validation.ts),
 * workspace.attach binding (existence checked, previous binding released),
 * resume replay vs full re-sync, and routing chat.send / chat.cancel /
 * chip.update into the relay. Transport mechanics (heartbeat, close codes,
 * upgrade) stay in studio-server's gateway.
 *
 * Attach acknowledgement: bridge.status then auth.status are sent first as
 * snapshots — the first envelope echoes the attach requestId — followed by
 * the journal replay or the full state re-sync.
 */
import type { ApiError, WorkspaceRepository } from "@studio/contract";

import type { AuthManager } from "../../agent/index.js";
import type { McpBridge } from "../../mcp/index.js";
import type { Logger } from "../../logging/create-logger.js";
import type {
  WsConnection,
  WsConnectionHandler,
} from "../../ws/connection-gateway.js";
import { apiError, fromStoreError } from "../errors.js";
import { parseClientMessage } from "../validation.js";
import type { ChatRelay } from "./chat-relay.js";
import type { HubRegistry, WorkspaceHub } from "./journal.js";
import { resyncWorkspaceState, type ResyncDeps } from "./resync.js";

export interface WsSessionDeps {
  workspaces: WorkspaceRepository;
  hubs: HubRegistry;
  relay: ChatRelay;
  bridge: McpBridge;
  auth: AuthManager;
  resync: ResyncDeps;
  logger: Logger;
}

interface ConnectionState {
  connection: WsConnection;
  hub: WorkspaceHub | null;
  log: Logger;
}

export function createWsSessionHandler(
  deps: WsSessionDeps,
): WsConnectionHandler {
  const log = deps.logger.child({ component: "ws-session" });

  function sendError(
    state: ConnectionState,
    error: ApiError,
    requestId?: string,
  ): void {
    // chat.error outside any workspace binding still needs an envelope;
    // seq snapshots at the bound hub's head, or 0 pre-attach.
    const seq = state.hub?.headSeq() ?? 0;
    state.connection.send(
      JSON.stringify({
        type: "chat.error",
        ...(requestId !== undefined ? { requestId } : {}),
        seq,
        payload: { error },
      }),
    );
  }

  async function handleAttach(
    state: ConnectionState,
    requestId: string | undefined,
    workspaceId: string,
    lastEventSeq: number | undefined,
  ): Promise<void> {
    const exists = await deps.workspaces.get(workspaceId);
    if (!exists.ok) {
      sendError(
        state,
        fromStoreError(exists.error, "workspace_not_found"),
        requestId,
      );
      return;
    }

    // Attach to B while attached to A → A's binding is released first.
    if (state.hub !== null) {
      state.hub.detach(state.connection);
      state.hub = null;
    }

    const hub = deps.hubs.hub(workspaceId);
    const decision = hub.resumeFrom(lastEventSeq);

    // Attach acknowledgement: snapshot statuses first (requestId echo on
    // the first envelope), then replay/re-sync, then live events.
    hub.sendSnapshot(state.connection, {
      type: "bridge.status",
      ...(requestId !== undefined ? { requestId } : {}),
      payload: deps.bridge.status(),
    });
    const authState = await deps.auth.resolve();
    const authReport = await deps.auth.status();
    hub.sendSnapshot(state.connection, {
      type: "auth.status",
      ...(requestId !== undefined ? { requestId } : {}),
      payload: {
        state: authState.status,
        ...(authState.status !== "configured" && authReport.detail !== undefined
          ? { fix: authReport.detail }
          : {}),
      },
    });

    if (decision.mode === "replay") {
      for (const raw of decision.entries) {
        state.connection.send(raw);
      }
      state.log.info(
        { workspaceId, lastEventSeq, replayed: decision.entries.length },
        "workspace attach with journal replay",
      );
    } else {
      await resyncWorkspaceState(deps.resync, hub, state.connection);
      state.log.info({ workspaceId, lastEventSeq }, "workspace attach with full re-sync");
    }

    // Bind AFTER replay/re-sync so live broadcasts cannot interleave with
    // historical sends (single-threaded dispatch keeps this airtight).
    hub.attach(state.connection);
    state.hub = hub;
  }

  function requireAttached(
    state: ConnectionState,
    requestId: string | undefined,
    action: string,
  ): WorkspaceHub | null {
    if (state.hub === null) {
      sendError(
        state,
        apiError(
          "not_attached",
          `${action} requires an attached workspace.`,
          "Send workspace.attach { workspaceId } first.",
        ),
        requestId,
      );
      return null;
    }
    return state.hub;
  }

  async function dispatch(state: ConnectionState, raw: string): Promise<void> {
    const parsed = parseClientMessage(raw);
    if (!parsed.ok) {
      sendError(state, parsed.rejection.error, parsed.rejection.requestId);
      return;
    }
    const message = parsed.message;
    switch (message.type) {
      case "workspace.attach":
        await handleAttach(
          state,
          message.requestId,
          message.payload.workspaceId,
          message.payload.lastEventSeq,
        );
        return;
      case "chat.send": {
        const hub = requireAttached(state, message.requestId, "chat.send");
        if (hub === null) {
          return;
        }
        // Turns run for whole seconds — dispatch must NOT hold the
        // connection's message queue (chat.cancel has to interleave).
        // relay.send never rejects by construction; a breach is logged.
        deps.relay
          .send(hub.workspaceId, message.requestId, message.payload)
          .catch((err: unknown) => {
            state.log.error({ err }, "chat.send relay rejected unexpectedly");
          });
        return;
      }
      case "chat.cancel": {
        const hub = requireAttached(state, message.requestId, "chat.cancel");
        if (hub === null) {
          return;
        }
        await deps.relay.cancel(
          hub.workspaceId,
          message.requestId,
          message.payload.messageId,
        );
        return;
      }
      case "chip.update": {
        const hub = requireAttached(state, message.requestId, "chip.update");
        if (hub === null) {
          return;
        }
        deps.relay
          .updateChip(hub.workspaceId, message.requestId, message.payload)
          .catch((err: unknown) => {
            state.log.error({ err }, "chip.update relay rejected unexpectedly");
          });
        return;
      }
    }
  }

  return {
    onConnection(connection) {
      const state: ConnectionState = {
        connection,
        hub: null,
        log: log.child({ connectionId: connection.connectionId }),
      };

      // Per-connection dispatch is SERIALIZED: a message is fully handled
      // (attach bound, re-sync emitted) before the next one runs — so a
      // chat.send queued behind workspace.attach sees the binding. Long
      // turns do not hold the queue: chat.send/chip.update dispatch only
      // initiates the turn.
      let queue: Promise<void> = Promise.resolve();
      connection.onMessage((raw) => {
        queue = queue.then(() =>
          dispatch(state, raw).catch((err: unknown) => {
            // Dispatch never rejects by construction; a breach is logged
            // and answered structurally so the connection stays usable.
            state.log.error({ err }, "ws dispatch failed unexpectedly");
            sendError(
              state,
              apiError(
                "internal_error",
                "The message could not be processed.",
                "Retry; if the failure persists, check the server logs.",
              ),
            );
          }),
        );
      });

      connection.onClose(() => {
        if (state.hub !== null) {
          state.hub.detach(connection);
          state.hub = null;
        }
      });
    },
  };
}
