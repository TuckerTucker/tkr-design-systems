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

/** Where a single panel is docked. Refined by docking-shell in Phase 2. */
export interface PanelPlacement {
  /** Panel identifier, e.g. "library" or "chat". */
  panelId: string;
  /** Docking zone identifier, e.g. "left-rail" or "right-rail". */
  zone: string;
}

/**
 * The whole-document panel layout preference, persisted at
 * studio/workspaces/preferences.yaml. Single preferences shape on the wire
 * and on disk (architecture.md canonical resolution).
 */
export interface LayoutPreference {
  schemaVersion: 1;
  placements: PanelPlacement[];
  /** Identifier of the active tab in the docked panel stack. */
  activeTab: string;
  /** Rail widths in pixels. */
  railWidths: { left: number; right: number };
  /** Workspace to reopen on launch; null before any workspace was opened. */
  lastWorkspaceId: string | null;
}
