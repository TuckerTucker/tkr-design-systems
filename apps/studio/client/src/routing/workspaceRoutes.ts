/**
 * URL ↔ active workspace mapping. Routes are /w/<workspace-id> (history
 * API; the server's SPA fallback serves index.html for extensionless
 * paths so deep links and refreshes work). Workspace ids from the URL are
 * untrusted input: parsed against the slug grammar, matched against the
 * server's workspace list by the caller, never interpolated into markup.
 */

const WORKSPACE_PATH = /^\/w\/([a-z0-9-]+)\/?$/;

export function workspacePath(workspaceId: string): string {
  return `/w/${encodeURIComponent(workspaceId)}`;
}

/** The workspace id named by a pathname, or null. */
export function parseWorkspacePath(pathname: string): string | null {
  const match = WORKSPACE_PATH.exec(pathname);
  return match?.[1] ?? null;
}

export interface WorkspaceHistory {
  current(): string | null;
  /** Push /w/<id> onto history (no-op when already there). */
  push(workspaceId: string): void;
  /** Replace the current entry (initial last-workspace restore). */
  replace(workspaceId: string): void;
  /** Subscribe to back/forward traversal. */
  listen(handler: (workspaceId: string | null) => void): () => void;
}

export function createWorkspaceHistory(
  win: Pick<Window, "addEventListener" | "removeEventListener" | "history" | "location"> = window,
): WorkspaceHistory {
  return {
    current(): string | null {
      return parseWorkspacePath(win.location.pathname);
    },
    push(workspaceId: string): void {
      const path = workspacePath(workspaceId);
      if (win.location.pathname !== path) {
        win.history.pushState({ workspaceId }, "", path);
      }
    },
    replace(workspaceId: string): void {
      const path = workspacePath(workspaceId);
      if (win.location.pathname !== path) {
        win.history.replaceState({ workspaceId }, "", path);
      }
    },
    listen(handler: (workspaceId: string | null) => void): () => void {
      const onPop = (): void => {
        handler(parseWorkspacePath(win.location.pathname));
      };
      win.addEventListener("popstate", onPop);
      return () => win.removeEventListener("popstate", onPop);
    },
  };
}
