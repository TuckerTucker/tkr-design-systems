/**
 * Component-test fakes for the injected seams: a StudioSocket whose state
 * and events are driven by the test, and an ApiClient backed by in-memory
 * data. Integration suites use the real implementations against a real
 * server; these exist for deterministic component behavior tests.
 */
import type {
  ApiError,
  ClientMessage,
  LayoutPreference,
  ServerMessage,
  WorkspaceSummary,
} from "@studio/contract";

import type { ApiClient, ApiResult } from "../../../src/api/apiClient.js";
import type {
  ConnectionState,
  SendResult,
  StudioSocket,
} from "../../../src/ws/studioSocket.js";

export interface FakeStudioSocket extends StudioSocket {
  attached: string[];
  sentMessages: ClientMessage[];
  setState(state: ConnectionState): void;
  emit(message: ServerMessage): void;
}

export function createFakeSocket(
  initialState: ConnectionState = "open",
): FakeStudioSocket {
  let connectionState = initialState;
  let workspaceId: string | null = null;
  const attached: string[] = [];
  const sentMessages: ClientMessage[] = [];
  const stateHandlers = new Set<(state: ConnectionState) => void>();
  const handlers = new Map<string, Set<(message: ServerMessage) => void>>();

  return {
    attached,
    sentMessages,
    connect: () => undefined,
    attachWorkspace(id: string): void {
      workspaceId = id;
      attached.push(id);
    },
    send(message: ClientMessage): SendResult {
      if (connectionState !== "open") {
        return { ok: false, reason: "disconnected", state: connectionState };
      }
      sentMessages.push(message);
      return { ok: true };
    },
    on(type, handler) {
      let set = handlers.get(type);
      if (set === undefined) {
        set = new Set();
        handlers.set(type, set);
      }
      const wrapped = handler as (message: ServerMessage) => void;
      set.add(wrapped);
      return () => set.delete(wrapped);
    },
    onConnectionState(handler) {
      stateHandlers.add(handler);
      return () => stateHandlers.delete(handler);
    },
    state: () => connectionState,
    lastSeq: () => undefined,
    attachedWorkspaceId: () => workspaceId,
    close: () => undefined,
    setState(state: ConnectionState): void {
      connectionState = state;
      for (const handler of [...stateHandlers]) {
        handler(state);
      }
    },
    emit(message: ServerMessage): void {
      for (const handler of [...(handlers.get(message.type) ?? [])]) {
        handler(message);
      }
    },
  };
}

export function workspaceSummary(id: string, name?: string): WorkspaceSummary {
  return {
    id,
    name: name ?? id,
    created: "2026-06-10T00:00:00.000Z",
    updated: "2026-06-10T00:00:00.000Z",
    settings: {},
  };
}

export interface FakeApiOptions {
  workspaces?: WorkspaceSummary[];
  preference?: LayoutPreference | null;
  listError?: ApiError;
  getPreferencesError?: ApiError;
}

export interface FakeApi extends ApiClient {
  putCalls: LayoutPreference[];
  setListError(error: ApiError | null): void;
}

export function createFakeApi(options: FakeApiOptions = {}): FakeApi {
  const workspaces = [...(options.workspaces ?? [])];
  const putCalls: LayoutPreference[] = [];
  let listError: ApiError | null = options.listError ?? null;
  let untitled = workspaces.length;

  const defaultPreference: LayoutPreference = {
    schemaVersion: 1,
    placements: [],
    activeTab: "library",
    railWidths: { left: 320, right: 360 },
    lastWorkspaceId: null,
  };

  return {
    putCalls,
    setListError(error: ApiError | null): void {
      listError = error;
    },
    async getPreferences(): Promise<ApiResult<LayoutPreference>> {
      if (options.getPreferencesError !== undefined) {
        return { ok: false, error: options.getPreferencesError };
      }
      return { ok: true, value: options.preference ?? defaultPreference };
    },
    async putPreferences(
      preference: LayoutPreference,
    ): Promise<ApiResult<LayoutPreference>> {
      putCalls.push(preference);
      return { ok: true, value: preference };
    },
    async listWorkspaces(): Promise<ApiResult<WorkspaceSummary[]>> {
      if (listError !== null) {
        return { ok: false, error: listError };
      }
      return { ok: true, value: [...workspaces] };
    },
    async createWorkspace(): Promise<ApiResult<WorkspaceSummary>> {
      untitled += 1;
      const created = workspaceSummary(
        `untitled-workspace-${untitled}`,
        `Untitled Workspace ${untitled}`,
      );
      workspaces.push(created);
      return { ok: true, value: created };
    },
  };
}
