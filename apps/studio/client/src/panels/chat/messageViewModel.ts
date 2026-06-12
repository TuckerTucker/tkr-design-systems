/**
 * Chat view model — a pure reducer over the @studio/contract server
 * vocabulary plus the panel's local actions (optimistic send, retry,
 * chip dispatch, disconnect marking).
 *
 * Wire truth this reducer encodes (server/src/api/ws/resync.ts and
 * chat-relay.ts):
 * - Live turns stream chat.message_started → chat.assistant_delta* →
 *   chat.message_completed (or chat.error), every envelope echoing the
 *   turn's requestId; deltas/tools/chips key on messageId.
 * - Transcript restore (workspace.attach re-sync) replays the transcript
 *   in append order: ASSISTANT messages only, each as started → one
 *   full-text delta → completed { artifactRefs: [], cancelled }, with
 *   chips.updated interleaved in record order — a turn's decision_chips
 *   record is appended mid-turn, BEFORE its message record, so chips can
 *   arrive before their chat.message_started (buffered, never dropped).
 *   Artifact heads follow as artifact.version_created snapshots WITHOUT a
 *   requestId. User turns are not on the wire after a restore.
 * - chat.message_started for an already-known messageId is therefore a
 *   re-sync replacement: the message is rebuilt in place, never
 *   duplicated.
 * - artifact.version_created correlates to its producing message via the
 *   echoed requestId (mid-turn only); snapshot replays carry none and are
 *   the canvas's concern.
 */
import type {
  ApiError,
  ArtifactRef,
  ChipKind,
  DecisionChip,
  ServerMessage,
} from "@studio/contract";

import { progressLabel } from "./progressLabels.js";

export type ChatRole = "user" | "assistant";

export interface ToolProgressView {
  toolCallId: string;
  tool: string;
  /** Human-readable, from the payload summary ("Generating … in swiss"). */
  label: string;
  state: "running" | "ok" | "error";
  /** tool_finished detail (outcome summary). */
  detail: string | null;
}

export interface ChipRowView {
  artifactId: string;
  chips: DecisionChip[];
  /** Error shown at the chip row (failed chip.update), in place. */
  error: ApiError | null;
}

export interface ArtifactRefView {
  artifactId: string;
  version: number;
}

export interface ChatMessageView {
  messageId: string;
  /** The turn's requestId (correlation for cancel and version_created). */
  requestId: string | null;
  role: ChatRole;
  text: string;
  streaming: boolean;
  /** Closed by chat.message_completed { cancelled: true } — "stopped". */
  cancelled: boolean;
  /** Connection dropped mid-stream; cleared when the stream resumes. */
  interrupted: boolean;
  /** Optimistic user message whose chat.send never reached the server. */
  sendFailed: boolean;
  tools: ToolProgressView[];
  chipRow: ChipRowView | null;
  artifactRefs: ArtifactRefView[];
  error: ApiError | null;
}

export interface ChipRerun {
  requestId: string;
  messageId: string;
  kind: ChipKind;
}

export interface ChatViewState {
  messages: ChatMessageView[];
  /** messageId of the streaming assistant turn; null when idle. */
  activeMessageId: string | null;
  /** chat.send dispatched, chat.message_started not yet seen. */
  pendingRequestId: string | null;
  /** chip.update in flight (disables chip rows, shows the reason). */
  chipRerun: ChipRerun | null;
  /** Only the latest decision set is editable. */
  latestChipsMessageId: string | null;
  /**
   * Latest chips.updated per messageId — the transcript replay emits a
   * turn's chips BEFORE its message (record append order), so the row is
   * buffered here and (re)attached whenever its message (re)opens.
   */
  chipRowsByMessageId: Record<string, ChipRowView>;
}

export const initialChatState: ChatViewState = {
  messages: [],
  activeMessageId: null,
  pendingRequestId: null,
  chipRerun: null,
  latestChipsMessageId: null,
  chipRowsByMessageId: {},
};

export type ChatAction =
  | { kind: "server"; message: ServerMessage }
  | {
      kind: "user_send";
      messageId: string;
      requestId: string;
      text: string;
    }
  | { kind: "send_failed"; messageId: string }
  | { kind: "send_retried"; messageId: string; requestId: string }
  | { kind: "chip_update_sent"; rerun: ChipRerun }
  | { kind: "chip_update_failed"; messageId: string; error: ApiError }
  | { kind: "disconnected" }
  | { kind: "reset" };

/** A turn is in flight (composer disables with the reason in place). */
export function isBusy(state: ChatViewState): boolean {
  return (
    state.activeMessageId !== null ||
    state.pendingRequestId !== null ||
    state.chipRerun !== null
  );
}

function emptyMessage(
  messageId: string,
  role: ChatRole,
  requestId: string | null,
): ChatMessageView {
  return {
    messageId,
    requestId,
    role,
    text: "",
    streaming: false,
    cancelled: false,
    interrupted: false,
    sendFailed: false,
    tools: [],
    chipRow: null,
    artifactRefs: [],
    error: null,
  };
}

function replaceMessage(
  messages: ChatMessageView[],
  messageId: string,
  update: (message: ChatMessageView) => ChatMessageView,
): ChatMessageView[] {
  return messages.map((message) =>
    message.messageId === messageId ? update(message) : message,
  );
}

function findMessage(
  state: ChatViewState,
  messageId: string,
): ChatMessageView | undefined {
  return state.messages.find((message) => message.messageId === messageId);
}

function mergeRefs(
  existing: ArtifactRefView[],
  incoming: ArtifactRef[],
): ArtifactRefView[] {
  const merged = [...existing];
  for (const ref of incoming) {
    const known = merged.some(
      (entry) =>
        entry.artifactId === ref.artifactId && entry.version === ref.version,
    );
    if (!known) {
      merged.push({ artifactId: ref.artifactId, version: ref.version });
    }
  }
  return merged;
}

function applyServer(
  state: ChatViewState,
  message: ServerMessage,
): ChatViewState {
  switch (message.type) {
    case "chat.message_started": {
      const { messageId } = message.payload;
      const requestId = message.requestId ?? null;
      const known = findMessage(state, messageId);
      const opened: ChatMessageView = {
        ...emptyMessage(
          messageId,
          "assistant",
          requestId ?? known?.requestId ?? null,
        ),
        streaming: true,
        // A buffered decision set (replayed before its message) attaches
        // here; re-sync replacements re-attach it after the rebuild.
        chipRow: state.chipRowsByMessageId[messageId] ?? null,
      };
      const messages =
        known !== undefined
          ? // Re-sync replacement: rebuild the turn in place, keep order.
            replaceMessage(state.messages, messageId, () => opened)
          : [...state.messages, opened];
      return {
        ...state,
        messages,
        activeMessageId: messageId,
        pendingRequestId:
          requestId !== null && state.pendingRequestId === requestId
            ? null
            : state.pendingRequestId,
      };
    }

    case "chat.assistant_delta": {
      const { messageId, delta } = message.payload;
      if (findMessage(state, messageId) === undefined) {
        // Unknown messageId — tolerated, never crashes the reducer.
        return state;
      }
      return {
        ...state,
        messages: replaceMessage(state.messages, messageId, (entry) => ({
          ...entry,
          text: entry.text + delta,
          interrupted: false,
        })),
      };
    }

    case "chat.tool_started": {
      const payload = message.payload;
      const targetId =
        findMessage(state, payload.messageId) !== undefined
          ? payload.messageId
          : state.activeMessageId;
      if (targetId === null || findMessage(state, targetId) === undefined) {
        return state;
      }
      const tool: ToolProgressView = {
        toolCallId: payload.toolCallId,
        tool: payload.tool,
        label: progressLabel(payload.tool, payload.summary),
        state: "running",
        detail: null,
      };
      return {
        ...state,
        messages: replaceMessage(state.messages, targetId, (entry) => ({
          ...entry,
          tools: [
            ...entry.tools.filter((t) => t.toolCallId !== tool.toolCallId),
            tool,
          ],
        })),
      };
    }

    case "chat.tool_finished": {
      const payload = message.payload;
      const targetId =
        findMessage(state, payload.messageId) !== undefined
          ? payload.messageId
          : state.activeMessageId;
      if (targetId === null || findMessage(state, targetId) === undefined) {
        return state;
      }
      const finishedState = payload.status === "ok" ? "ok" : "error";
      return {
        ...state,
        messages: replaceMessage(state.messages, targetId, (entry) => {
          const known = entry.tools.some(
            (t) => t.toolCallId === payload.toolCallId,
          );
          const tools = known
            ? entry.tools.map((t) =>
                t.toolCallId === payload.toolCallId
                  ? {
                      ...t,
                      state: finishedState as ToolProgressView["state"],
                      detail: payload.detail ?? null,
                    }
                  : t,
              )
            : // tool_finished without a started marker — order tolerant.
              [
                ...entry.tools,
                {
                  toolCallId: payload.toolCallId,
                  tool: payload.tool,
                  label: progressLabel(payload.tool, payload.detail ?? ""),
                  state: finishedState as ToolProgressView["state"],
                  detail: payload.detail ?? null,
                },
              ];
          return { ...entry, tools };
        }),
      };
    }

    case "chat.message_completed": {
      const { messageId, artifactRefs, cancelled } = message.payload;
      const requestId = message.requestId ?? null;
      const known = findMessage(state, messageId);
      const messages =
        known === undefined
          ? // Completion for a turn we never saw open — tolerated.
            [...state.messages, emptyMessage(messageId, "assistant", requestId)]
          : state.messages;
      return {
        ...state,
        messages: replaceMessage(messages, messageId, (entry) => ({
          ...entry,
          streaming: false,
          interrupted: false,
          cancelled,
          artifactRefs: mergeRefs(entry.artifactRefs, artifactRefs),
        })),
        activeMessageId:
          state.activeMessageId === messageId ? null : state.activeMessageId,
        pendingRequestId:
          requestId !== null && state.pendingRequestId === requestId
            ? null
            : state.pendingRequestId,
        chipRerun:
          state.chipRerun !== null && state.chipRerun.requestId === requestId
            ? null
            : state.chipRerun,
      };
    }

    case "chat.error": {
      const { error } = message.payload;
      const requestId = message.requestId ?? null;
      const messageId = message.payload.messageId ?? null;

      // Error on an open turn — render on that turn, close the stream.
      if (messageId !== null && findMessage(state, messageId) !== undefined) {
        return {
          ...state,
          messages: replaceMessage(state.messages, messageId, (entry) => ({
            ...entry,
            streaming: false,
            error,
          })),
          activeMessageId:
            state.activeMessageId === messageId ? null : state.activeMessageId,
          pendingRequestId:
            requestId !== null && state.pendingRequestId === requestId
              ? null
              : state.pendingRequestId,
          chipRerun:
            state.chipRerun !== null && state.chipRerun.requestId === requestId
              ? null
              : state.chipRerun,
        };
      }

      // Rejected chip.update — error lands at the chip row, chips revert.
      if (state.chipRerun !== null && state.chipRerun.requestId === requestId) {
        const chipMessageId = state.chipRerun.messageId;
        return {
          ...state,
          messages: replaceMessage(state.messages, chipMessageId, (entry) => ({
            ...entry,
            chipRow:
              entry.chipRow === null ? null : { ...entry.chipRow, error },
          })),
          chipRerun: null,
        };
      }

      // Refused send (busy, keyless before a turn opened) — error lands
      // on the optimistic user message that provoked it.
      if (requestId !== null) {
        const userMessage = state.messages.find(
          (entry) => entry.requestId === requestId && entry.role === "user",
        );
        if (userMessage !== undefined) {
          return {
            ...state,
            messages: replaceMessage(
              state.messages,
              userMessage.messageId,
              (entry) => ({ ...entry, error }),
            ),
            pendingRequestId:
              state.pendingRequestId === requestId
                ? null
                : state.pendingRequestId,
          };
        }
      }

      // Protocol-level error with no anchor — render in the flow.
      const syntheticId = `error-seq-${message.seq}`;
      if (findMessage(state, syntheticId) !== undefined) {
        return state;
      }
      return {
        ...state,
        messages: [
          ...state.messages,
          { ...emptyMessage(syntheticId, "assistant", requestId), error },
        ],
        pendingRequestId:
          requestId !== null && state.pendingRequestId === requestId
            ? null
            : state.pendingRequestId,
      };
    }

    case "chips.updated": {
      const { messageId, artifactId, chips } = message.payload;
      const chipRow: ChipRowView = { artifactId, chips, error: null };
      const known = findMessage(state, messageId) !== undefined;
      return {
        ...state,
        // Buffered even when the message is not on screen yet — the
        // transcript replay emits chips before their message.
        chipRowsByMessageId: {
          ...state.chipRowsByMessageId,
          [messageId]: chipRow,
        },
        messages: known
          ? replaceMessage(state.messages, messageId, (entry) => ({
              ...entry,
              chipRow,
            }))
          : state.messages,
        latestChipsMessageId: messageId,
      };
    }

    case "artifact.version_created": {
      const requestId = message.requestId ?? null;
      const { artifactId } = message.payload;
      const ref: ArtifactRef = {
        artifactId,
        version: message.payload.version.number,
      };
      // Mid-turn landings echo the turn's requestId; re-sync head
      // snapshots carry none and anchor to the latest turn whose decision
      // set produced this artifact (chips replay before artifact heads on
      // re-sync), keeping restored references clickable. With neither
      // anchor the snapshot is the canvas's concern.
      const owner =
        requestId !== null
          ? state.messages.find(
              (entry) =>
                entry.requestId === requestId && entry.role === "assistant",
            )
          : [...state.messages]
              .reverse()
              .find(
                (entry) =>
                  entry.chipRow !== null &&
                  entry.chipRow.artifactId === artifactId,
              );
      if (owner === undefined) {
        return state;
      }
      return {
        ...state,
        messages: replaceMessage(state.messages, owner.messageId, (entry) => ({
          ...entry,
          artifactRefs: mergeRefs(entry.artifactRefs, [ref]),
        })),
      };
    }

    default:
      return state;
  }
}

export function chatReducer(
  state: ChatViewState,
  action: ChatAction,
): ChatViewState {
  switch (action.kind) {
    case "server":
      return applyServer(state, action.message);

    case "user_send":
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            ...emptyMessage(action.messageId, "user", action.requestId),
            text: action.text,
          },
        ],
        pendingRequestId: action.requestId,
      };

    case "send_failed":
      return {
        ...state,
        messages: replaceMessage(state.messages, action.messageId, (entry) => ({
          ...entry,
          sendFailed: true,
        })),
        pendingRequestId:
          findMessage(state, action.messageId)?.requestId ===
          state.pendingRequestId
            ? null
            : state.pendingRequestId,
      };

    case "send_retried":
      return {
        ...state,
        messages: replaceMessage(state.messages, action.messageId, (entry) => ({
          ...entry,
          sendFailed: false,
          error: null,
          requestId: action.requestId,
        })),
        pendingRequestId: action.requestId,
      };

    case "chip_update_sent":
      return {
        ...state,
        chipRerun: action.rerun,
        messages: replaceMessage(
          state.messages,
          action.rerun.messageId,
          (entry) => ({
            ...entry,
            chipRow:
              entry.chipRow === null
                ? null
                : { ...entry.chipRow, error: null },
          }),
        ),
      };

    case "chip_update_failed":
      return {
        ...state,
        chipRerun: null,
        messages: replaceMessage(state.messages, action.messageId, (entry) => ({
          ...entry,
          chipRow:
            entry.chipRow === null
              ? null
              : { ...entry.chipRow, error: action.error },
        })),
      };

    case "disconnected":
      return {
        ...state,
        messages:
          state.activeMessageId === null
            ? state.messages
            : replaceMessage(state.messages, state.activeMessageId, (entry) => ({
                ...entry,
                interrupted: true,
              })),
      };

    case "reset":
      return initialChatState;
  }
}
