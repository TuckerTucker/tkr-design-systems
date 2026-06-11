/**
 * Workspace switcher — lives in the shell chrome. Lists workspaces, shows
 * the active one, creates new ones (auto-named by the server), and
 * handles the two failure modes in place: an unknown workspace id from
 * the URL (named, with the available list offered) and a failed list
 * fetch (error + retry affordance, never a dead end).
 */
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
} from "react";

import { useShellState } from "../app/shellState.jsx";

export function WorkspaceSwitcher(): ReactElement {
  const {
    workspaces,
    workspacesError,
    activeWorkspaceId,
    unknownWorkspaceId,
    selectWorkspace,
    createWorkspace,
    refreshWorkspaces,
  } = useShellState();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const popId = useId();

  // An unresolved workspace id opens the switcher in place (no redirect
  // loop, no dead end) so the user can pick a real workspace.
  const forcedOpen = unknownWorkspaceId !== null;
  const isOpen = open || forcedOpen;

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    function onPointerDown(event: PointerEvent): void {
      const target = event.target as Node;
      if (
        popRef.current?.contains(target) !== true &&
        buttonRef.current?.contains(target) !== true
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isOpen]);

  function onPopKeyDown(event: ReactKeyboardEvent): void {
    if (event.key === "Escape") {
      setOpen(false);
      buttonRef.current?.focus();
      return;
    }
    const options = popRef.current?.querySelectorAll<HTMLElement>(
      '[role="option"], .workspace-switcher-create, .workspace-switcher-retry',
    );
    if (options === undefined || options.length === 0) {
      return;
    }
    const list = [...options];
    const activeIndex = list.findIndex((el) => el === document.activeElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      list[(activeIndex + 1) % list.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      list[(activeIndex - 1 + list.length) % list.length]?.focus();
    }
  }

  const activeName =
    workspaces?.find((workspace) => workspace.id === activeWorkspaceId)?.name ??
    activeWorkspaceId ??
    "No workspace";

  return (
    <div className="workspace-switcher">
      <button
        ref={buttonRef}
        type="button"
        className="workspace-switcher-button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? popId : undefined}
        aria-label={`Workspace: ${activeName}`}
        onClick={() => setOpen((value) => !value)}
      >
        {activeName}
        <svg width="10" height="10" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M3 6l5 5 5-5"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      </button>
      {isOpen ? (
        <div
          ref={popRef}
          id={popId}
          className="workspace-switcher-pop"
          onKeyDown={onPopKeyDown}
        >
          {unknownWorkspaceId !== null ? (
            <div className="workspace-switcher-note" role="status">
              Workspace “{unknownWorkspaceId}” was not found. Pick one of the
              available workspaces below, or create a new one.
            </div>
          ) : null}
          {workspacesError !== null ? (
            <div className="workspace-switcher-error" role="alert">
              {workspacesError.message} {workspacesError.fix}
              <button
                type="button"
                className="workspace-switcher-create workspace-switcher-retry"
                onClick={() => void refreshWorkspaces()}
              >
                Retry
              </button>
            </div>
          ) : null}
          {workspaces !== null ? (
            <div role="listbox" aria-label="Workspaces">
              {workspaces.length === 0 ? (
                <div className="workspace-switcher-note">
                  No workspaces yet — create the first one below.
                </div>
              ) : null}
              {workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  type="button"
                  role="option"
                  aria-selected={workspace.id === activeWorkspaceId}
                  onClick={() => {
                    selectWorkspace(workspace.id);
                    setOpen(false);
                    buttonRef.current?.focus();
                  }}
                >
                  {workspace.name}
                </button>
              ))}
            </div>
          ) : workspacesError === null ? (
            <div className="workspace-switcher-note">Loading workspaces…</div>
          ) : null}
          <button
            type="button"
            className="workspace-switcher-create"
            disabled={creating}
            onClick={() => {
              setCreating(true);
              void createWorkspace().finally(() => {
                setCreating(false);
                setOpen(false);
              });
            }}
          >
            {creating ? "Creating workspace…" : "New workspace"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
