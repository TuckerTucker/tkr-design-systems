/**
 * Keyboard bindings for panel operations — every docking operation has a
 * keyboard path (UX philosophy: input-agnostic, keyboard parity).
 *
 * Bindings (active while a panel header has focus):
 * - Alt+ArrowLeft / Alt+ArrowRight  → move the panel to that rail
 * - Alt+ArrowUp / Alt+ArrowDown     → reorder within the rail's stack
 * - F6                              → cycle focus across panel headers
 *
 * Collapse, restore, tab activation, and the settings menu are reachable
 * as focusable controls (buttons, ARIA tabs with arrow-key roving focus,
 * menu items) — see PanelHost, TabStrip, IconStrip, PanelSettingsMenu.
 */
import type { DockAction, RailSide } from "./types.js";

export interface PanelKeyContext {
  panelId: string;
  rail: RailSide;
  order: number;
  /** Expanded panel count on the panel's current rail. */
  railSize: number;
}

export type PanelKeyResult =
  | { kind: "dock"; action: DockAction }
  | { kind: "cycle-focus" }
  | null;

export interface KeyStroke {
  key: string;
  altKey: boolean;
}

/**
 * Map a keystroke on a focused panel header to a dock action (or a focus
 * cycle request). Returns null when the stroke is not a shell binding so
 * callers never preventDefault on keys panels may need.
 */
export function panelHeaderKeyAction(
  stroke: KeyStroke,
  context: PanelKeyContext,
): PanelKeyResult {
  if (stroke.key === "F6" && !stroke.altKey) {
    return { kind: "cycle-focus" };
  }
  if (!stroke.altKey) {
    return null;
  }
  switch (stroke.key) {
    case "ArrowLeft":
      return {
        kind: "dock",
        action: { type: "move", panelId: context.panelId, rail: "left" },
      };
    case "ArrowRight":
      return {
        kind: "dock",
        action: { type: "move", panelId: context.panelId, rail: "right" },
      };
    case "ArrowUp":
      return context.order > 0
        ? {
            kind: "dock",
            action: {
              type: "move",
              panelId: context.panelId,
              rail: context.rail,
              order: context.order - 1,
            },
          }
        : null;
    case "ArrowDown":
      return context.order < context.railSize - 1
        ? {
            kind: "dock",
            action: {
              type: "move",
              panelId: context.panelId,
              rail: context.rail,
              // Same-rail move: the reducer reindexes among the others, so
              // moving down one slot targets order + 1 after extraction.
              order: context.order + 1,
            },
          }
        : null;
    default:
      return null;
  }
}
