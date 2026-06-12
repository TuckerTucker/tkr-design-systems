/**
 * Wire ↔ runtime mapping for the layout preference.
 *
 * The wire shape (LayoutPreference in @studio/contract, validated by the
 * server) keeps the Wave 1 document layout: placements carry panelId +
 * zone, with order/collapsed/active as optional entry-level extras the
 * server round-trips opaquely; the top-level activeTab stays a single
 * string. The runtime DockState derives per-rail active tabs from the
 * per-placement `active` flags.
 *
 * Tolerances (spec: error_handling):
 * - unrecognized schemaVersion → null (caller applies defaults; the
 *   stored value is left untouched until the user re-arranges)
 * - placements naming unregistered panels are dropped; the remainder
 *   hydrates and the next debounced PUT writes the cleaned layout back
 * - registered panels missing from the document join at their
 *   defaultPlacement
 */
import type { LayoutPreference, PanelPlacement } from "@studio/contract";

import {
  defaultDockState,
  DEFAULT_RAIL_WIDTHS,
} from "../shell/dockReducer.js";
import {
  isRailSide,
  type DockPlacement,
  type DockState,
  type PanelDefinition,
  type RailSide,
} from "../shell/types.js";

export interface HydratedLayout {
  dock: DockState;
  lastWorkspaceId: string | null;
  /** Panel ids whose persisted placements were dropped (unregistered). */
  droppedPanelIds: string[];
}

export function fromLayoutPreference(
  preference: LayoutPreference,
  panels: readonly PanelDefinition[],
): HydratedLayout | null {
  if (preference.schemaVersion !== 1) {
    return null;
  }

  const known = new Set(panels.map((panel) => panel.id));
  const droppedPanelIds: string[] = [];
  const placements: DockPlacement[] = [];
  const active: Record<RailSide, string | null> = { left: null, right: null };

  for (const entry of preference.placements) {
    if (!known.has(entry.panelId) || !isRailSide(entry.zone)) {
      droppedPanelIds.push(entry.panelId);
      continue;
    }
    placements.push({
      panelId: entry.panelId,
      rail: entry.zone,
      order:
        typeof entry.order === "number" && Number.isFinite(entry.order)
          ? entry.order
          : placements.length,
      collapsed: entry.collapsed === true,
    });
    if (entry.active === true && entry.collapsed !== true) {
      active[entry.zone] = entry.panelId;
    }
  }

  // Registered panels the document does not know join at their defaults.
  for (const panel of panels) {
    if (!placements.some((placement) => placement.panelId === panel.id)) {
      placements.push({
        panelId: panel.id,
        rail: panel.defaultPlacement.rail,
        order: 1000 + panel.defaultPlacement.order,
        collapsed: false,
      });
    }
  }

  // A rail with expanded panels must always have an active tab — documents
  // persisted with `active: false` everywhere (or written by older builds)
  // would otherwise hydrate every panel host hidden. Mirror the reducer's
  // resolveActiveTab fallback: first expanded panel by order.
  for (const rail of ["left", "right"] as const) {
    if (active[rail] !== null) {
      continue;
    }
    const firstExpanded = placements
      .filter((placement) => placement.rail === rail && !placement.collapsed)
      .sort((a, b) => a.order - b.order)[0];
    active[rail] = firstExpanded?.panelId ?? null;
  }

  const left = Number.isFinite(preference.railWidths.left)
    ? preference.railWidths.left
    : DEFAULT_RAIL_WIDTHS.left;
  const right = Number.isFinite(preference.railWidths.right)
    ? preference.railWidths.right
    : DEFAULT_RAIL_WIDTHS.right;

  return {
    dock: {
      placements,
      activeTab: active,
      railWidths: { left, right },
    },
    lastWorkspaceId: preference.lastWorkspaceId,
    droppedPanelIds,
  };
}

export function toLayoutPreference(
  dock: DockState,
  lastWorkspaceId: string | null,
): LayoutPreference {
  const placements: PanelPlacement[] = [...dock.placements]
    .sort((a, b) =>
      a.rail === b.rail ? a.order - b.order : a.rail === "left" ? -1 : 1,
    )
    .map((placement) => ({
      panelId: placement.panelId,
      zone: placement.rail,
      order: placement.order,
      collapsed: placement.collapsed,
      active: dock.activeTab[placement.rail] === placement.panelId,
    }));

  return {
    schemaVersion: 1,
    placements,
    // Wire keeps a single string (Wave 1 shape, server-validated).
    activeTab: dock.activeTab.right ?? dock.activeTab.left ?? "",
    railWidths: { ...dock.railWidths },
    lastWorkspaceId,
  };
}

/** Defaults used on first run and on unrecognized schema versions. */
export function defaultLayout(
  panels: readonly PanelDefinition[],
): HydratedLayout {
  return {
    dock: defaultDockState(panels),
    lastWorkspaceId: null,
    droppedPanelIds: [],
  };
}
