/**
 * Preferences contract — owned by docking-shell — declared ahead of Phase 2;
 * the store persists this document opaquely.
 *
 * This is a minimal faithful declaration of the LayoutPreference shape from
 * _planning/architecture.md so that workspace-store's PreferencesRepository
 * can type its seam in Wave 1. docking-shell (Wave 5) extends this module;
 * the store never interprets fields — preferences.yaml round-trips verbatim,
 * including keys this declaration does not know about.
 */

/**
 * Where a single panel is docked.
 *
 * `panelId` and `zone` are the Wave 1 wire shape the server validates;
 * docking-shell (Phase 2) writes `zone` as `"left"` or `"right"` and adds
 * the optional fields below, which the server round-trips opaquely
 * (entry-level extras pass validation and persist verbatim). Older
 * documents without them hydrate with shell defaults.
 */
export interface PanelPlacement {
  /** Panel identifier, e.g. "library" or "chat". */
  panelId: string;
  /** Docking zone identifier; docking-shell writes "left" or "right". */
  zone: string;
  /** Stack position within the rail (tab order); 0-based. */
  order?: number;
  /** True when the panel lives in the rail's icon strip. */
  collapsed?: boolean;
  /** True when this panel is its rail's visible (active) tab. */
  active?: boolean;
}

/**
 * The whole-document panel layout preference, persisted at
 * studio/workspaces/preferences.yaml. Single preferences shape on the wire
 * and on disk (architecture.md canonical resolution).
 */
export interface LayoutPreference {
  schemaVersion: 1;
  placements: PanelPlacement[];
  /**
   * Identifier of the active tab in the docked panel stack. The wire keeps
   * this as a single string (Wave 1 shape, server-validated); docking-shell
   * derives per-rail active tabs from the `active` flags on `placements`
   * and writes the most recently activated panel id here ("" when no panel
   * is active anywhere).
   */
  activeTab: string;
  /** Rail widths in pixels. */
  railWidths: { left: number; right: number };
  /** Workspace to reopen on launch; null before any workspace was opened. */
  lastWorkspaceId: string | null;
}
