/**
 * Dock context — exposes the dock reducer state, the registered panels,
 * the panel-content slot registry (portal targets, so panel contents
 * survive docking operations without remounting), and post-action focus
 * management (focus follows the moved/collapsed/restored panel).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactElement,
  type ReactNode,
} from "react";

import { createDockReducer } from "./dockReducer.js";
import type {
  DockAction,
  DockState,
  PanelDefinition,
} from "./types.js";

export type FocusTarget = "header" | "content" | "icon";

export interface DockContextValue {
  state: DockState;
  dispatch: (action: DockAction) => void;
  panels: readonly PanelDefinition[];
  /**
   * The stable DOM element a panel's content renders into. The element is
   * created once per panel id and never replaced; PanelHost adopts it into
   * the current slot with appendChild, so React state inside the panel
   * survives every docking operation (no remount on move/collapse/tab).
   */
  contentHost(panelId: string): HTMLElement;
  /** Ask the shell to move focus after the current dispatch settles. */
  requestFocus(panelId: string, target: FocusTarget): void;
}

const DockContext = createContext<DockContextValue | null>(null);

export function useDock(): DockContextValue {
  const value = useContext(DockContext);
  if (value === null) {
    throw new Error("useDock must be used inside a DockProvider.");
  }
  return value;
}

export function focusElementId(panelId: string, target: FocusTarget): string {
  switch (target) {
    case "header":
      return `panel-header-${panelId}`;
    case "content":
      return `panel-content-${panelId}`;
    case "icon":
      return `panel-icon-${panelId}`;
  }
}

export interface DockProviderProps {
  panels: readonly PanelDefinition[];
  initialState: DockState;
  /** Fired on every user-driven dock change (persistence subscribes). */
  onChange?: (state: DockState) => void;
  children: ReactNode;
}

export function DockProvider(props: DockProviderProps): ReactElement {
  const { panels, onChange } = props;
  const reducer = useMemo(() => createDockReducer(panels), [panels]);
  const [state, rawDispatch] = useReducer(reducer, props.initialState);
  const contentHosts = useRef(new Map<string, HTMLElement>());
  const pendingFocus = useRef<{ panelId: string; target: FocusTarget } | null>(
    null,
  );
  const changed = useRef(false);

  const dispatch = useCallback(
    (action: DockAction) => {
      if (action.type !== "hydrate") {
        changed.current = true;
      }
      rawDispatch(action);
    },
    [rawDispatch],
  );

  const contentHost = useCallback((panelId: string): HTMLElement => {
    let host = contentHosts.current.get(panelId);
    if (host === undefined) {
      host = document.createElement("div");
      host.className = "panel-content-host";
      host.style.height = "100%";
      contentHosts.current.set(panelId, host);
    }
    return host;
  }, []);

  const requestFocus = useCallback((panelId: string, target: FocusTarget) => {
    pendingFocus.current = { panelId, target };
  }, []);

  // Focus follows the panel after every move/collapse/restore.
  useEffect(() => {
    const request = pendingFocus.current;
    if (request === null) {
      return;
    }
    pendingFocus.current = null;
    const element = document.getElementById(
      focusElementId(request.panelId, request.target),
    );
    if (element !== null) {
      element.focus();
    }
  }, [state]);

  // Persistence: report user-driven changes only (hydrate is not a change).
  useEffect(() => {
    if (!changed.current) {
      return;
    }
    changed.current = false;
    onChange?.(state);
  }, [state, onChange]);

  const value = useMemo<DockContextValue>(
    () => ({
      state,
      dispatch,
      panels,
      contentHost,
      requestFocus,
    }),
    [state, dispatch, panels, contentHost, requestFocus],
  );

  return <DockContext.Provider value={value}>{props.children}</DockContext.Provider>;
}
