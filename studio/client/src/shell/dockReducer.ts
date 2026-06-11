/**
 * Dock state reducer — the single source of layout truth. Pure: every
 * transition returns a normalized DockState (orders contiguous per rail,
 * active tabs always valid, rail widths clamped to hosted minWidths).
 *
 * The reducer is created against the registered panel definitions so it
 * can clamp rail widths and resolve defaults without reaching into React
 * context — IoC: the registry is injected, never imported as a singleton.
 */
import type {
  DockAction,
  DockPlacement,
  DockState,
  PanelDefinition,
  RailSide,
} from "./types.js";

export const MIN_RAIL_WIDTH = 200;
export const MAX_RAIL_WIDTH = 640;
export const DEFAULT_RAIL_WIDTHS: Record<RailSide, number> = {
  left: 320,
  right: 360,
};

function byOrder(a: DockPlacement, b: DockPlacement): number {
  return a.order - b.order;
}

/** Placements on a rail, sorted by stack order. */
export function railPlacements(
  state: DockState,
  rail: RailSide,
): DockPlacement[] {
  return state.placements.filter((p) => p.rail === rail).sort(byOrder);
}

function expandedOn(placements: DockPlacement[]): DockPlacement[] {
  return placements.filter((p) => !p.collapsed);
}

/** Re-number orders contiguously (0..n-1) per rail, preserving order. */
function normalizeOrders(placements: readonly DockPlacement[]): DockPlacement[] {
  const result: DockPlacement[] = [];
  for (const rail of ["left", "right"] as const) {
    const onRail = placements.filter((p) => p.rail === rail).sort(byOrder);
    onRail.forEach((placement, index) => {
      result.push({ ...placement, order: index });
    });
  }
  return result;
}

/** Pick a valid active tab for a rail: prefer current, else first expanded. */
function resolveActiveTab(
  placements: readonly DockPlacement[],
  rail: RailSide,
  preferred: string | null,
): string | null {
  const expanded = expandedOn(
    placements.filter((p) => p.rail === rail).sort(byOrder) as DockPlacement[],
  );
  if (expanded.length === 0) {
    return null;
  }
  if (preferred !== null && expanded.some((p) => p.panelId === preferred)) {
    return preferred;
  }
  return expanded[0]?.panelId ?? null;
}

function clampWidth(
  width: number,
  rail: RailSide,
  placements: readonly DockPlacement[],
  panels: readonly PanelDefinition[],
): number {
  const hostedMin = placements
    .filter((p) => p.rail === rail && !p.collapsed)
    .map((p) => panels.find((def) => def.id === p.panelId)?.minWidth ?? 0)
    .reduce((max, value) => Math.max(max, value), MIN_RAIL_WIDTH);
  return Math.min(MAX_RAIL_WIDTH, Math.max(hostedMin, width));
}

/** Normalize a whole state: orders, active tabs, widths. */
function normalize(
  state: DockState,
  panels: readonly PanelDefinition[],
): DockState {
  const placements = normalizeOrders(state.placements);
  return {
    placements,
    activeTab: {
      left: resolveActiveTab(placements, "left", state.activeTab.left),
      right: resolveActiveTab(placements, "right", state.activeTab.right),
    },
    railWidths: {
      left: clampWidth(state.railWidths.left, "left", placements, panels),
      right: clampWidth(state.railWidths.right, "right", placements, panels),
    },
  };
}

/** First-run defaults: every registered panel at its defaultPlacement. */
export function defaultDockState(
  panels: readonly PanelDefinition[],
): DockState {
  const placements: DockPlacement[] = panels.map((panel) => ({
    panelId: panel.id,
    rail: panel.defaultPlacement.rail,
    order: panel.defaultPlacement.order,
    collapsed: false,
  }));
  return normalize(
    {
      placements,
      activeTab: { left: null, right: null },
      railWidths: { ...DEFAULT_RAIL_WIDTHS },
    },
    panels,
  );
}

export type DockReducer = (state: DockState, action: DockAction) => DockState;

export function createDockReducer(
  panels: readonly PanelDefinition[],
): DockReducer {
  return function dockReducer(state: DockState, action: DockAction): DockState {
    switch (action.type) {
      case "move": {
        const current = state.placements.find(
          (p) => p.panelId === action.panelId,
        );
        if (current === undefined) {
          return state;
        }
        const others = state.placements.filter(
          (p) => p.panelId !== action.panelId,
        );
        const targetRail = others
          .filter((p) => p.rail === action.rail)
          .sort(byOrder);
        const index = Math.max(
          0,
          Math.min(action.order ?? targetRail.length, targetRail.length),
        );
        // Re-number the target rail 0..n-1 and slot the moved panel in
        // between (fractional order); normalize() renumbers contiguously.
        const reindexed = others.map((p) =>
          p.rail === action.rail
            ? { ...p, order: targetRail.indexOf(p) }
            : p,
        );
        const moved: DockPlacement = {
          ...current,
          rail: action.rail,
          order: index - 0.5,
        };
        const next = normalize(
          {
            ...state,
            placements: [...reindexed, moved],
            activeTab: {
              ...state.activeTab,
              // A moved expanded panel becomes its target rail's active tab.
              ...(current.collapsed ? {} : { [action.rail]: action.panelId }),
            },
          },
          panels,
        );
        return next;
      }

      case "collapse": {
        const current = state.placements.find(
          (p) => p.panelId === action.panelId,
        );
        if (current === undefined || current.collapsed) {
          return state;
        }
        const placements = state.placements.map((p) =>
          p.panelId === action.panelId ? { ...p, collapsed: true } : p,
        );
        // Collapsing the active tab promotes the next expanded panel.
        const preferred =
          state.activeTab[current.rail] === action.panelId
            ? null
            : state.activeTab[current.rail];
        return normalize(
          {
            ...state,
            placements,
            activeTab: { ...state.activeTab, [current.rail]: preferred },
          },
          panels,
        );
      }

      case "restore": {
        const current = state.placements.find(
          (p) => p.panelId === action.panelId,
        );
        if (current === undefined || !current.collapsed) {
          return state;
        }
        const placements = state.placements.map((p) =>
          p.panelId === action.panelId ? { ...p, collapsed: false } : p,
        );
        // The restored panel returns to its prior rail/order and becomes
        // the visible tab (focus moves into it at the component layer).
        return normalize(
          {
            ...state,
            placements,
            activeTab: { ...state.activeTab, [current.rail]: action.panelId },
          },
          panels,
        );
      }

      case "activateTab": {
        const target = state.placements.find(
          (p) =>
            p.panelId === action.panelId &&
            p.rail === action.rail &&
            !p.collapsed,
        );
        if (target === undefined) {
          return state;
        }
        return {
          ...state,
          activeTab: { ...state.activeTab, [action.rail]: action.panelId },
        };
      }

      case "resizeRail": {
        return {
          ...state,
          railWidths: {
            ...state.railWidths,
            [action.rail]: clampWidth(
              action.width,
              action.rail,
              state.placements,
              panels,
            ),
          },
        };
      }

      case "hydrate": {
        return normalize(action.state, panels);
      }
    }
  };
}
