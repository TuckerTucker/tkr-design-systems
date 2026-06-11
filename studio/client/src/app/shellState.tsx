/**
 * Shell state — the seam every panel capability consumes: the active
 * workspace, the StudioSocket (typed event subscriptions), the inline
 * connection state, the latest auth/bridge status, and the artifact focus
 * handoff (chat tells the canvas which artifact to show — Wave 6).
 *
 * Dependencies (socket, api client, history) are injected so tests
 * compose the provider against fakes or a real server.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

import type {
  ApiError,
  AuthStatusPayload,
  BridgeStatusPayload,
  WorkspaceSummary,
} from "@studio/contract";

import type { ApiClient } from "../api/apiClient.js";
import type { WorkspaceHistory } from "../routing/workspaceRoutes.js";
import type { ConnectionState, StudioSocket } from "../ws/studioSocket.js";

export interface ShellState {
  socket: StudioSocket;
  connectionState: ConnectionState;
  /** null until the first list resolves. */
  workspaces: WorkspaceSummary[] | null;
  workspacesError: ApiError | null;
  activeWorkspaceId: string | null;
  /** A URL named this id but the server does not know it. */
  unknownWorkspaceId: string | null;
  selectWorkspace(workspaceId: string): void;
  createWorkspace(): Promise<{ ok: boolean }>;
  refreshWorkspaces(): Promise<void>;
  /** Latest pushed statuses (also live on socket.on for subscribers). */
  authStatus: AuthStatusPayload | null;
  bridgeStatus: BridgeStatusPayload | null;
  /** Artifact focus seam: chat → canvas handoff (Wave 6). */
  focusedArtifactId: string | null;
  focusArtifact(artifactId: string | null): void;
}

const ShellStateContext = createContext<ShellState | null>(null);

export function useShellState(): ShellState {
  const value = useContext(ShellStateContext);
  if (value === null) {
    throw new Error("useShellState must be used inside a ShellStateProvider.");
  }
  return value;
}

export interface ShellStateProviderProps {
  socket: StudioSocket;
  api: Pick<ApiClient, "listWorkspaces" | "createWorkspace">;
  history: WorkspaceHistory;
  /** From the URL, or the preference's lastWorkspaceId (boot decides). */
  initialWorkspaceId: string | null;
  /** True when initialWorkspaceId came from preferences, not the URL. */
  initialFromPreferences?: boolean;
  /** Persist lastWorkspaceId on every switch (App wires persistence). */
  onWorkspaceChange?: (workspaceId: string) => void;
  children: ReactNode;
}

export function ShellStateProvider(
  props: ShellStateProviderProps,
): ReactElement {
  const { socket, api, history, onWorkspaceChange } = props;
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    socket.state(),
  );
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[] | null>(null);
  const [workspacesError, setWorkspacesError] = useState<ApiError | null>(null);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    props.initialWorkspaceId,
  );
  const [authStatus, setAuthStatus] = useState<AuthStatusPayload | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatusPayload | null>(
    null,
  );
  const [focusedArtifactId, setFocusedArtifactId] = useState<string | null>(
    null,
  );
  const initialApplied = useRef(false);

  // Connection state and pushed statuses, distributed from the socket.
  useEffect(() => {
    const offState = socket.onConnectionState(setConnectionState);
    const offAuth = socket.on("auth.status", (message) =>
      setAuthStatus(message.payload),
    );
    const offBridge = socket.on("bridge.status", (message) =>
      setBridgeStatus(message.payload),
    );
    return () => {
      offState();
      offAuth();
      offBridge();
    };
  }, [socket]);

  const refreshWorkspaces = useCallback(async (): Promise<void> => {
    const result = await api.listWorkspaces();
    if (result.ok) {
      setWorkspaces(result.value);
      setWorkspacesError(null);
    } else {
      setWorkspacesError(result.error);
    }
  }, [api]);

  // Initial workspace list and initial URL normalization.
  useEffect(() => {
    void refreshWorkspaces();
  }, [refreshWorkspaces]);

  // Attach whenever the active workspace changes (and reflect it in the
  // URL when the id came from preferences rather than a deep link).
  useEffect(() => {
    if (activeWorkspaceId === null) {
      return;
    }
    socket.attachWorkspace(activeWorkspaceId);
    if (!initialApplied.current) {
      initialApplied.current = true;
      if (props.initialFromPreferences === true) {
        history.replace(activeWorkspaceId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial-only flags
  }, [activeWorkspaceId, socket, history]);

  // Back/forward traversal: URL and active workspace stay in lockstep.
  useEffect(() => {
    return history.listen((workspaceId) => {
      if (workspaceId !== null) {
        setActiveWorkspaceId(workspaceId);
      }
    });
  }, [history]);

  const selectWorkspace = useCallback(
    (workspaceId: string): void => {
      setActiveWorkspaceId(workspaceId);
      history.push(workspaceId);
      onWorkspaceChange?.(workspaceId);
    },
    [history, onWorkspaceChange],
  );

  const createWorkspace = useCallback(async (): Promise<{ ok: boolean }> => {
    const created = await api.createWorkspace({});
    if (!created.ok) {
      setWorkspacesError(created.error);
      return { ok: false };
    }
    await refreshWorkspaces();
    selectWorkspace(created.value.id);
    return { ok: true };
  }, [api, refreshWorkspaces, selectWorkspace]);

  const unknownWorkspaceId = useMemo((): string | null => {
    if (
      activeWorkspaceId === null ||
      workspaces === null ||
      workspaces.some((workspace) => workspace.id === activeWorkspaceId)
    ) {
      return null;
    }
    return activeWorkspaceId;
  }, [activeWorkspaceId, workspaces]);

  const value = useMemo<ShellState>(
    () => ({
      socket,
      connectionState,
      workspaces,
      workspacesError,
      activeWorkspaceId,
      unknownWorkspaceId,
      selectWorkspace,
      createWorkspace,
      refreshWorkspaces,
      authStatus,
      bridgeStatus,
      focusedArtifactId,
      focusArtifact: setFocusedArtifactId,
    }),
    [
      socket,
      connectionState,
      workspaces,
      workspacesError,
      activeWorkspaceId,
      unknownWorkspaceId,
      selectWorkspace,
      createWorkspace,
      refreshWorkspaces,
      authStatus,
      bridgeStatus,
      focusedArtifactId,
    ],
  );

  return (
    <ShellStateContext.Provider value={value}>
      {props.children}
    </ShellStateContext.Provider>
  );
}
