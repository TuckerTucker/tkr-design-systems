/**
 * Silent persistence for panel UI state — last-viewed system and section
 * expand/collapse, restored on next mount with no save action. Backed by
 * localStorage so the state survives closing and reopening the studio
 * (story: designer-switches-design-systems). Storage failures degrade to
 * in-memory state; browsing never blocks on persistence.
 *
 * The LayoutPreference wire contract (preferences.ts, owned by
 * docking-shell) carries no library fields, so panel-local UI state
 * persists client-side rather than through PUT /api/preferences.
 */

const PREFIX = "studio.library.";

export function readSessionValue(key: string): string | null {
  try {
    return globalThis.localStorage.getItem(`${PREFIX}${key}`);
  } catch {
    return null;
  }
}

export function writeSessionValue(key: string, value: string): void {
  try {
    globalThis.localStorage.setItem(`${PREFIX}${key}`, value);
  } catch {
    // In-memory state keeps working; persistence is best-effort.
  }
}
