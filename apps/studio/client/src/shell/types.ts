/**
 * Docking shell contracts — PanelDefinition (the registration surface
 * Wave 6 panels use), the runtime dock state model, and the reducer
 * action vocabulary. These match the capability spec's data contracts
 * verbatim; the wire shape (LayoutPreference) lives in @studio/contract.
 */
import type { ComponentType, LazyExoticComponent } from "react";

export type RailSide = "left" | "right";

export const RAIL_SIDES: readonly RailSide[] = ["left", "right"];

export function isRailSide(value: unknown): value is RailSide {
  return value === "left" || value === "right";
}

export function otherRail(rail: RailSide): RailSide {
  return rail === "left" ? "right" : "left";
}

/**
 * A panel as registered with the shell. Chat, library, canvas-adjacent
 * panels, and every future panel (compliance detail, history, blueprint
 * tree) plug in through this contract with zero shell changes.
 */
export interface PanelDefinition {
  /** Kebab-case, unique ("chat", "library", future "compliance-detail"). */
  id: string;
  /** Panel header and tab label. */
  title: string;
  /** Icon strip entry and tab glyph. */
  icon: ComponentType<{ size?: number }>;
  /** Panel content, code-split via React.lazy. */
  component: LazyExoticComponent<ComponentType>;
  defaultPlacement: { rail: RailSide; order: number };
  /** px; the rail width clamps to the widest hosted panel. */
  minWidth: number;
}

export interface PanelRegistry {
  /** Duplicate id is a startup error naming both registrations. */
  register(definition: PanelDefinition): void;
  get(id: string): PanelDefinition | undefined;
  list(): readonly PanelDefinition[];
}

/** Runtime placement of one panel (reducer-owned). */
export interface DockPlacement {
  panelId: string;
  rail: RailSide;
  /** Stack position within the rail (tab order). */
  order: number;
  /** true → panel lives in the rail's icon strip. */
  collapsed: boolean;
}

export interface DockState {
  placements: readonly DockPlacement[];
  /** Visible panel per rail when 2+ panels stack on it. */
  activeTab: Record<RailSide, string | null>;
  /** px, clamped to hosted minWidths. */
  railWidths: Record<RailSide, number>;
}

export type DockAction =
  | { type: "move"; panelId: string; rail: RailSide; order?: number }
  | { type: "collapse"; panelId: string }
  | { type: "restore"; panelId: string }
  | { type: "activateTab"; rail: RailSide; panelId: string }
  | { type: "resizeRail"; rail: RailSide; width: number }
  | { type: "hydrate"; state: DockState };
