/**
 * App — shell composition: error boundary, shell state (workspaces,
 * socket, routing), dock state, silent persistence wiring, top chrome
 * (workspace switcher + inline connection state), ShellFrame.
 *
 * Every dependency arrives as a prop (IoC): main.tsx composes the real
 * ones; tests compose fakes or a real local server.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";

import type { ApiClient } from "../api/apiClient.js";
import {
  defaultLayout,
  fromLayoutPreference,
  toLayoutPreference,
  type HydratedLayout,
} from "../preferences/layoutMapping.js";
import type {
  LayoutPersistence,
  SyncStatus,
} from "../preferences/layoutPersistence.js";
import type { WorkspaceHistory } from "../routing/workspaceRoutes.js";
import { WorkspaceSwitcher } from "../routing/WorkspaceSwitcher.jsx";
import { DockProvider, useDock } from "../shell/DockContext.jsx";
import { AppErrorBoundary } from "../shell/ErrorBoundary.jsx";
import { ShellFrame } from "../shell/ShellFrame.jsx";
import { SyncStatusProvider } from "../shell/SyncStatusContext.jsx";
import type { DockState, PanelDefinition } from "../shell/types.js";
import { ConnectionStatus } from "../ws/ConnectionStatus.jsx";
import type { StudioSocket } from "../ws/studioSocket.js";
import { CenterStage } from "./CenterStage.jsx";
import { ShellStateProvider } from "./shellState.jsx";

export interface AppProps {
  panels: readonly PanelDefinition[];
  api: ApiClient;
  socket: StudioSocket;
  history: WorkspaceHistory;
  persistence: LayoutPersistence;
  /** Hydrated before first paint (or defaults when the GET failed). */
  initialLayout: HydratedLayout;
  /** GET /api/preferences failed at boot → retry in the background. */
  initialLoadFailed?: boolean;
  initialWorkspaceId: string | null;
  /** initialWorkspaceId came from preferences, not a deep link. */
  initialFromPreferences?: boolean;
  /** Background retry cadence for a failed boot GET (test override). */
  layoutRetryMs?: number;
}

/**
 * Background recovery for a failed boot-time GET /api/preferences: keep
 * retrying; when the stored layout arrives, hydrate only if the user has
 * not re-arranged in the meantime (spec: error_handling).
 */
function LayoutRecovery(props: {
  api: ApiClient;
  panels: readonly PanelDefinition[];
  userArranged: () => boolean;
  retryMs: number;
}): null {
  const { api, panels, userArranged, retryMs } = props;
  const { dispatch } = useDock();

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function attempt(): Promise<void> {
      const stored = await api.getPreferences();
      if (cancelled) {
        return;
      }
      if (stored.ok) {
        if (!userArranged()) {
          const hydrated = fromLayoutPreference(stored.value, panels);
          if (hydrated !== null) {
            dispatch({ type: "hydrate", state: hydrated.dock });
          }
        }
        return;
      }
      timer = setTimeout(() => void attempt(), retryMs);
    }

    timer = setTimeout(() => void attempt(), retryMs);
    return () => {
      cancelled = true;
      if (timer !== null) {
        clearTimeout(timer);
      }
    };
  }, [api, panels, userArranged, retryMs, dispatch]);

  return null;
}

export function App(props: AppProps): ReactElement {
  const { panels, api, socket, history, persistence } = props;
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    persistence.status(),
  );
  const dockRef = useRef<DockState>(props.initialLayout.dock);
  const lastWorkspaceIdRef = useRef<string | null>(props.initialWorkspaceId);
  const userArrangedRef = useRef(false);

  useEffect(() => persistence.onStatus(setSyncStatus), [persistence]);

  // Flush a pending layout write when the page is being torn down.
  useEffect(() => {
    const flush = (): void => {
      void persistence.flush();
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [persistence]);

  // A persisted placement for an unregistered panel was dropped during
  // hydration → write the cleaned layout back (silently).
  useEffect(() => {
    if (props.initialLayout.droppedPanelIds.length > 0) {
      persistence.schedule(
        toLayoutPreference(dockRef.current, lastWorkspaceIdRef.current),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot-time only
  }, []);

  const handleDockChange = useCallback(
    (state: DockState): void => {
      dockRef.current = state;
      userArrangedRef.current = true;
      persistence.schedule(
        toLayoutPreference(state, lastWorkspaceIdRef.current),
      );
    },
    [persistence],
  );

  const handleWorkspaceChange = useCallback(
    (workspaceId: string): void => {
      lastWorkspaceIdRef.current = workspaceId;
      persistence.schedule(
        toLayoutPreference(dockRef.current, workspaceId),
      );
    },
    [persistence],
  );

  const userArranged = useCallback(() => userArrangedRef.current, []);

  return (
    <AppErrorBoundary label="The studio shell">
      <ShellStateProvider
        socket={socket}
        api={api}
        history={history}
        initialWorkspaceId={props.initialWorkspaceId}
        initialFromPreferences={props.initialFromPreferences ?? false}
        onWorkspaceChange={handleWorkspaceChange}
      >
        <SyncStatusProvider value={syncStatus}>
          <DockProvider
            panels={panels}
            initialState={props.initialLayout.dock}
            onChange={handleDockChange}
          >
            <div className="app-root">
              <header className="topbar">
                <span className="topbar-title">Studio</span>
                <WorkspaceSwitcher />
                <span className="topbar-spacer" />
                <ConnectionStatus />
              </header>
              <ShellFrame center={<CenterStage />} />
            </div>
            {props.initialLoadFailed === true ? (
              <LayoutRecovery
                api={api}
                panels={panels}
                userArranged={userArranged}
                retryMs={props.layoutRetryMs ?? 3_000}
              />
            ) : null}
          </DockProvider>
        </SyncStatusProvider>
      </ShellStateProvider>
    </AppErrorBoundary>
  );
}

/** Boot-time layout resolution (hydrate before first paint). */
export function resolveBootLayout(
  storedOk: boolean,
  stored: Parameters<typeof fromLayoutPreference>[0] | null,
  panels: readonly PanelDefinition[],
): { layout: HydratedLayout; failed: boolean } {
  if (storedOk && stored !== null) {
    const hydrated = fromLayoutPreference(stored, panels);
    // Unrecognized schemaVersion → defaults; stored value left untouched.
    return { layout: hydrated ?? defaultLayout(panels), failed: false };
  }
  return { layout: defaultLayout(panels), failed: !storedOk };
}
