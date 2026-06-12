/**
 * Chat-panel component-test harness — a render helper composing ChatPanel
 * inside a REAL ShellStateProvider over the fake socket (per the testing
 * policy: real provider, no jest-dom, plain DOM assertions), typed
 * ServerEnvelope emitters mirroring the wire truth from
 * server/src/api/ws/{chat-relay,resync}.ts, a focus bridge exposing the
 * shell's focusArtifact seam, and a reference bridge for the library→chat
 * channel.
 */
import { act, render, type RenderResult } from "@testing-library/react";
import { useEffect, type ReactElement } from "react";

import type {
  ApiError,
  ArtifactRef,
  AuthStatusPayload,
  DecisionChip,
  LibraryReference,
  ServerMessage,
  VersionSummary,
} from "@studio/contract";

import {
  ShellStateProvider,
  useShellState,
} from "../../../../src/app/shellState.jsx";
import { ChatPanel } from "../../../../src/panels/chat/ChatPanel.jsx";
import { createWorkspaceHistory } from "../../../../src/routing/workspaceRoutes.js";
import {
  createFakeApi,
  createFakeSocket,
  workspaceSummary,
  type FakeStudioSocket,
} from "../../../unit/helpers/fakes.js";

export const WS_ID = "ws-chat";

// ── Typed envelope builders (seq assigned monotonically per harness) ──

export interface ChatEmitter {
  socket: FakeStudioSocket;
  auth(state: AuthStatusPayload["state"], fix?: string): void;
  messageStarted(messageId: string, requestId?: string): void;
  delta(messageId: string, delta: string): void;
  toolStarted(
    messageId: string,
    toolCallId: string,
    tool: string,
    summary: string,
    requestId?: string,
  ): void;
  toolFinished(
    messageId: string,
    toolCallId: string,
    tool: string,
    status: "ok" | "error",
    detail?: string,
    requestId?: string,
  ): void;
  completed(
    messageId: string,
    options?: {
      requestId?: string;
      artifactRefs?: ArtifactRef[];
      cancelled?: boolean;
    },
  ): void;
  chipsUpdated(
    messageId: string,
    artifactId: string,
    chips?: DecisionChip[],
    requestId?: string,
  ): void;
  versionCreated(artifactId: string, version: number, requestId?: string): void;
  chatError(error: ApiError, options?: { messageId?: string; requestId?: string }): void;
}

export function defaultChips(overrides: Partial<DecisionChip>[] = []): DecisionChip[] {
  const base: DecisionChip[] = [
    {
      kind: "system",
      value: "swiss",
      options: ["swiss", "terminal"],
      rerunStep: "generate",
    },
    {
      kind: "layout",
      value: "dashboard",
      options: ["dashboard", "login"],
      rerunStep: "generate",
    },
    {
      kind: "platform",
      value: "desktop",
      options: ["mobile", "desktop"],
      rerunStep: "generate",
    },
  ];
  return base.map((chip, index) => ({ ...chip, ...(overrides[index] ?? {}) }));
}

export function versionSummary(
  number: number,
  overrides: Partial<VersionSummary> = {},
): VersionSummary {
  return {
    number,
    parent: number > 1 ? number - 1 : null,
    tool: "wf_generate",
    brief: "a dashboard",
    created: "2026-06-10T00:00:00.000Z",
    compliance: { status: "pending" },
    ...overrides,
  };
}

export function apiError(overrides: Partial<ApiError> = {}): ApiError {
  return {
    code: "tool_failed",
    message: "Layout dashboard-3col is not available in terminal.",
    fix: "Pick another layout from the chip, or switch system.",
    ...overrides,
  };
}

export function createEmitter(socket: FakeStudioSocket): ChatEmitter {
  let seq = 100;
  function emit(message: Omit<ServerMessage, "seq">): void {
    seq += 1;
    act(() => {
      socket.emit({ ...message, seq } as ServerMessage);
    });
  }
  return {
    socket,
    auth(state, fix): void {
      emit({
        type: "auth.status",
        payload: { state, ...(fix !== undefined ? { fix } : {}) },
      });
    },
    messageStarted(messageId, requestId): void {
      emit({
        type: "chat.message_started",
        ...(requestId !== undefined ? { requestId } : {}),
        payload: { messageId, workspaceId: WS_ID },
      });
    },
    delta(messageId, delta): void {
      emit({ type: "chat.assistant_delta", payload: { messageId, delta } });
    },
    toolStarted(messageId, toolCallId, tool, summary, requestId): void {
      emit({
        type: "chat.tool_started",
        ...(requestId !== undefined ? { requestId } : {}),
        payload: { messageId, toolCallId, tool, summary },
      });
    },
    toolFinished(messageId, toolCallId, tool, status, detail, requestId): void {
      emit({
        type: "chat.tool_finished",
        ...(requestId !== undefined ? { requestId } : {}),
        payload: {
          messageId,
          toolCallId,
          tool,
          status,
          ...(detail !== undefined ? { detail } : {}),
        },
      });
    },
    completed(messageId, options = {}): void {
      emit({
        type: "chat.message_completed",
        ...(options.requestId !== undefined
          ? { requestId: options.requestId }
          : {}),
        payload: {
          messageId,
          artifactRefs: options.artifactRefs ?? [],
          cancelled: options.cancelled ?? false,
        },
      });
    },
    chipsUpdated(messageId, artifactId, chips, requestId): void {
      emit({
        type: "chips.updated",
        ...(requestId !== undefined ? { requestId } : {}),
        payload: { messageId, artifactId, chips: chips ?? defaultChips() },
      });
    },
    versionCreated(artifactId, version, requestId): void {
      emit({
        type: "artifact.version_created",
        ...(requestId !== undefined ? { requestId } : {}),
        payload: { artifactId, version: versionSummary(version) },
      });
    },
    chatError(error, options = {}): void {
      emit({
        type: "chat.error",
        ...(options.requestId !== undefined
          ? { requestId: options.requestId }
          : {}),
        payload: {
          ...(options.messageId !== undefined
            ? { messageId: options.messageId }
            : {}),
          error,
        },
      });
    },
  };
}

// ── Shell seam bridges ──

interface SeamHolder {
  focusedArtifactId: string | null;
  focusArtifact: (artifactId: string | null) => void;
  pendingReferences: readonly LibraryReference[];
  addReference: (reference: LibraryReference) => void;
}

function SeamBridge(props: { holder: SeamHolder }): null {
  const { focusedArtifactId, focusArtifact, pendingReferences, addReference } =
    useShellState();
  const { holder } = props;
  holder.focusedArtifactId = focusedArtifactId;
  holder.pendingReferences = pendingReferences;
  useEffect(() => {
    holder.focusArtifact = focusArtifact;
    holder.addReference = addReference;
  }, [holder, focusArtifact, addReference]);
  return null;
}

export interface ChatRender extends RenderResult {
  socket: FakeStudioSocket;
  emitter: ChatEmitter;
  /** Latest focused artifact on the shell seam. */
  focusedArtifactId(): string | null;
  focusArtifact(artifactId: string | null): void;
  pendingReferences(): readonly LibraryReference[];
  addReference(reference: LibraryReference): void;
  /** Deterministic requestIds handed to the panel, in order. */
  requestIds: string[];
}

export function componentReference(label = "Card — gray_surface"): LibraryReference {
  return {
    kind: "component",
    systemId: "swiss",
    componentId: "card",
    variantId: "gray_surface",
    label,
  };
}

export function renderChat(
  options: { socket?: FakeStudioSocket; workspaceId?: string | null } = {},
): ChatRender {
  const socket = options.socket ?? createFakeSocket();
  const workspaceId =
    options.workspaceId === undefined ? WS_ID : options.workspaceId;
  const shellApi = createFakeApi({
    workspaces: workspaceId !== null ? [workspaceSummary(workspaceId)] : [],
  });
  const requestIds: string[] = [];
  let counter = 0;
  const generateRequestId = (): string => {
    counter += 1;
    const id = `rid-${counter}`;
    requestIds.push(id);
    return id;
  };
  const holder: SeamHolder = {
    focusedArtifactId: null,
    focusArtifact: () => undefined,
    pendingReferences: [],
    addReference: () => undefined,
  };

  const ui: ReactElement = (
    <ShellStateProvider
      socket={socket}
      api={shellApi}
      history={createWorkspaceHistory()}
      initialWorkspaceId={workspaceId}
    >
      <SeamBridge holder={holder} />
      <ChatPanel generateRequestId={generateRequestId} />
    </ShellStateProvider>
  );
  const result = render(ui);

  return Object.assign(result, {
    socket,
    emitter: createEmitter(socket),
    requestIds,
    focusedArtifactId: () => holder.focusedArtifactId,
    focusArtifact: (artifactId: string | null) =>
      act(() => holder.focusArtifact(artifactId)),
    pendingReferences: () => holder.pendingReferences,
    addReference: (reference: LibraryReference) =>
      act(() => holder.addReference(reference)),
  });
}

/** The chat.* / chip.update messages the panel sent over the fake socket. */
export function sentOfType(
  socket: FakeStudioSocket,
  type: string,
): Array<Record<string, unknown>> {
  return socket.sentMessages.filter(
    (message) => message.type === type,
  ) as unknown as Array<Record<string, unknown>>;
}
