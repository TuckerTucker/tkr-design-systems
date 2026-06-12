/**
 * useChatPanel — wires the shell's StudioSocket to the pure chat reducer
 * and exposes the typed dispatchers (send, retry, cancel, chip update).
 *
 * Late-mount restore: the panel module loads lazily, so the workspace's
 * attach re-sync can flow before this hook subscribes. When the store is
 * empty but the socket has already seen events for the attached workspace
 * (lastSeq defined), the hook re-sends a fresh workspace.attach WITHOUT a
 * resume cursor — the server answers with an authoritative full re-sync
 * the reducer rebuilds from (re-played messages replace in place, so a
 * redundant re-sync is harmless). The check is deferred a tick so the
 * shell's own attach (which resets the cursor on workspace switch) wins.
 */
import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
} from "react";

import type { ChipKind, LibraryReference } from "@studio/contract";

import type { StudioSocket } from "../../ws/studioSocket.js";
import {
  chatReducer,
  initialChatState,
  isBusy,
  type ChatViewState,
} from "./messageViewModel.js";

export type ChatSendOutcome =
  | { ok: true }
  | { ok: false; reason: "disconnected" };

export interface ChatPanelController {
  state: ChatViewState;
  busy: boolean;
  /** Dispatch chat.send with an optimistic user append. */
  send(text: string, references: readonly LibraryReference[]): ChatSendOutcome;
  /** Re-dispatch a failed optimistic send (same text and references). */
  retry(messageId: string): ChatSendOutcome;
  /** Cancel the in-flight turn (chat.cancel with its messageId). */
  cancel(): void;
  /** Dispatch chip.update for a decision chip on `messageId`. */
  updateChip(messageId: string, kind: ChipKind, value: string): void;
}

export interface UseChatPanelOptions {
  socket: StudioSocket;
  workspaceId: string | null;
  /** Injected in tests for deterministic correlation ids. */
  generateRequestId?: () => string;
}

function defaultRequestId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi !== undefined && "randomUUID" in cryptoApi) {
    return cryptoApi.randomUUID();
  }
  return `req-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export function useChatPanel(options: UseChatPanelOptions): ChatPanelController {
  const { socket, workspaceId } = options;
  const generateRequestId = options.generateRequestId ?? defaultRequestId;
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const stateRef = useRef(state);
  stateRef.current = state;
  /** Failed optimistic sends, recoverable by messageId. */
  const failedSends = useRef(
    new Map<string, { text: string; references: LibraryReference[] }>(),
  );

  // ── Server event subscriptions (live for the socket's lifetime) ──
  useEffect(() => {
    const types = [
      "chat.message_started",
      "chat.assistant_delta",
      "chat.tool_started",
      "chat.tool_finished",
      "chat.message_completed",
      "chat.error",
      "chips.updated",
      "artifact.version_created",
    ] as const;
    const unsubscribes = types.map((type) =>
      socket.on(type, (message) => dispatch({ kind: "server", message })),
    );
    const offConnection = socket.onConnectionState((connectionState) => {
      if (connectionState !== "open") {
        dispatch({ kind: "disconnected" });
      }
    });
    return () => {
      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
      offConnection();
    };
  }, [socket]);

  // ── Per-workspace isolation + late-mount restore ──
  useEffect(() => {
    dispatch({ kind: "reset" });
    failedSends.current.clear();
    if (workspaceId === null) {
      return;
    }
    // Deferred: the shell's attach effect (parent) runs after ours and
    // resets the resume cursor on a workspace switch; by the time this
    // fires, a defined lastSeq means events flowed before we subscribed.
    const timer = setTimeout(() => {
      if (
        socket.lastSeq() !== undefined &&
        socket.attachedWorkspaceId() === workspaceId &&
        stateRef.current.messages.length === 0
      ) {
        socket.send({
          type: "workspace.attach",
          requestId: generateRequestId(),
          payload: { workspaceId },
        });
      }
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-per-workspace only
  }, [socket, workspaceId]);

  const send = useCallback(
    (
      text: string,
      references: readonly LibraryReference[],
    ): ChatSendOutcome => {
      const requestId = generateRequestId();
      const messageId = `user-${requestId}`;
      dispatch({ kind: "user_send", messageId, requestId, text });
      const result = socket.send({
        type: "chat.send",
        requestId,
        payload: {
          text,
          ...(references.length > 0 ? { references: [...references] } : {}),
        },
      });
      if (!result.ok) {
        failedSends.current.set(messageId, {
          text,
          references: [...references],
        });
        dispatch({ kind: "send_failed", messageId });
        return { ok: false, reason: "disconnected" };
      }
      return { ok: true };
    },
    [socket, generateRequestId],
  );

  const retry = useCallback(
    (messageId: string): ChatSendOutcome => {
      const failed = failedSends.current.get(messageId);
      if (failed === undefined) {
        return { ok: false, reason: "disconnected" };
      }
      const requestId = generateRequestId();
      dispatch({ kind: "send_retried", messageId, requestId });
      const result = socket.send({
        type: "chat.send",
        requestId,
        payload: {
          text: failed.text,
          ...(failed.references.length > 0
            ? { references: failed.references }
            : {}),
        },
      });
      if (!result.ok) {
        dispatch({ kind: "send_failed", messageId });
        return { ok: false, reason: "disconnected" };
      }
      failedSends.current.delete(messageId);
      return { ok: true };
    },
    [socket, generateRequestId],
  );

  const cancel = useCallback((): void => {
    const activeMessageId = stateRef.current.activeMessageId;
    if (activeMessageId === null) {
      return;
    }
    socket.send({
      type: "chat.cancel",
      requestId: generateRequestId(),
      payload: { messageId: activeMessageId },
    });
    // The stream closes itself with message_completed { cancelled: true };
    // a cancel racing completion is a server-side no-op.
  }, [socket, generateRequestId]);

  const updateChip = useCallback(
    (messageId: string, kind: ChipKind, value: string): void => {
      const requestId = generateRequestId();
      dispatch({
        kind: "chip_update_sent",
        rerun: { requestId, messageId, kind },
      });
      const result = socket.send({
        type: "chip.update",
        requestId,
        payload: { messageId, kind, value },
      });
      if (!result.ok) {
        dispatch({
          kind: "chip_update_failed",
          messageId,
          error: {
            code: "invalid_message",
            message: "The chip change could not be sent — connection lost.",
            fix: "The connection is re-establishing; change the chip again once it recovers.",
          },
        });
      }
    },
    [socket, generateRequestId],
  );

  return {
    state,
    busy: isBusy(state),
    send,
    retry,
    cancel,
    updateChip,
  };
}
