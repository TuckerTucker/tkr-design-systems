/**
 * Dock reducer units — every DockAction, normalization invariants, and
 * the spec's edge cases (collapse-the-active-tab promotion, restore to
 * prior placement, width clamping as a constraint).
 */
import { describe, expect, it } from "vitest";

import {
  createDockReducer,
  defaultDockState,
  MAX_RAIL_WIDTH,
  railPlacements,
} from "../../src/shell/dockReducer.js";
import type { DockState } from "../../src/shell/types.js";
import { makeTestPanels } from "./helpers/shellHarness.jsx";

const panels = makeTestPanels();
const reduce = createDockReducer(panels);

function ids(state: DockState, rail: "left" | "right"): string[] {
  return railPlacements(state, rail).map((p) => p.panelId);
}

describe("defaultDockState", () => {
  it("places every registered panel at its defaultPlacement, expanded", () => {
    const state = defaultDockState(panels);
    expect(ids(state, "left")).toEqual(["chat"]);
    expect(ids(state, "right")).toEqual(["library"]);
    expect(state.placements.every((p) => !p.collapsed)).toBe(true);
    expect(state.activeTab).toEqual({ left: "chat", right: "library" });
  });
});

describe("move", () => {
  it("moves a panel to the other rail and activates it there", () => {
    const state = reduce(defaultDockState(panels), {
      type: "move",
      panelId: "library",
      rail: "left",
    });
    expect(ids(state, "left")).toEqual(["chat", "library"]);
    expect(ids(state, "right")).toEqual([]);
    expect(state.activeTab.left).toBe("library");
    expect(state.activeTab.right).toBeNull();
  });

  it("inserts at the requested order", () => {
    const state = reduce(defaultDockState(panels), {
      type: "move",
      panelId: "library",
      rail: "left",
      order: 0,
    });
    expect(ids(state, "left")).toEqual(["library", "chat"]);
  });

  it("reorders within the same rail instead of swapping", () => {
    const stacked = reduce(defaultDockState(panels), {
      type: "move",
      panelId: "library",
      rail: "left",
      order: 1,
    });
    const reordered = reduce(stacked, {
      type: "move",
      panelId: "library",
      rail: "left",
      order: 0,
    });
    expect(ids(reordered, "left")).toEqual(["library", "chat"]);
  });

  it("keeps the source rail's active tab valid after the move", () => {
    const stacked = reduce(defaultDockState(panels), {
      type: "move",
      panelId: "library",
      rail: "left",
    });
    // active on left is library; move it away → chat promotes.
    const moved = reduce(stacked, {
      type: "move",
      panelId: "library",
      rail: "right",
    });
    expect(moved.activeTab.left).toBe("chat");
    expect(moved.activeTab.right).toBe("library");
  });

  it("ignores a move for an unknown panel", () => {
    const state = defaultDockState(panels);
    expect(reduce(state, { type: "move", panelId: "nope", rail: "left" })).toBe(
      state,
    );
  });
});

describe("collapse and restore", () => {
  it("collapses to the icon strip and promotes the next expanded tab", () => {
    const stacked = reduce(defaultDockState(panels), {
      type: "move",
      panelId: "library",
      rail: "left",
    });
    expect(stacked.activeTab.left).toBe("library");
    const collapsed = reduce(stacked, { type: "collapse", panelId: "library" });
    expect(
      collapsed.placements.find((p) => p.panelId === "library")?.collapsed,
    ).toBe(true);
    expect(collapsed.activeTab.left).toBe("chat");
  });

  it("restore returns the panel to its prior rail and order, active", () => {
    const stacked = reduce(defaultDockState(panels), {
      type: "move",
      panelId: "library",
      rail: "left",
      order: 0,
    });
    const collapsed = reduce(stacked, { type: "collapse", panelId: "library" });
    const restored = reduce(collapsed, { type: "restore", panelId: "library" });
    expect(ids(restored, "left")).toEqual(["library", "chat"]);
    expect(
      restored.placements.find((p) => p.panelId === "library")?.collapsed,
    ).toBe(false);
    expect(restored.activeTab.left).toBe("library");
  });

  it("all panels collapsed leaves both rails with null active tabs", () => {
    let state = defaultDockState(panels);
    state = reduce(state, { type: "collapse", panelId: "chat" });
    state = reduce(state, { type: "collapse", panelId: "library" });
    expect(state.activeTab).toEqual({ left: null, right: null });
  });

  it("collapse and restore are no-ops on already-matching state", () => {
    const state = defaultDockState(panels);
    expect(reduce(state, { type: "restore", panelId: "chat" })).toBe(state);
    const collapsed = reduce(state, { type: "collapse", panelId: "chat" });
    expect(reduce(collapsed, { type: "collapse", panelId: "chat" })).toBe(
      collapsed,
    );
  });
});

describe("activateTab", () => {
  it("activates an expanded panel on its rail", () => {
    const stacked = reduce(defaultDockState(panels), {
      type: "move",
      panelId: "library",
      rail: "left",
    });
    const activated = reduce(stacked, {
      type: "activateTab",
      rail: "left",
      panelId: "chat",
    });
    expect(activated.activeTab.left).toBe("chat");
  });

  it("rejects activating a collapsed or absent panel", () => {
    const state = defaultDockState(panels);
    expect(
      reduce(state, { type: "activateTab", rail: "left", panelId: "library" }),
    ).toBe(state);
  });
});

describe("resizeRail", () => {
  it("clamps below to the widest hosted panel minWidth", () => {
    const state = reduce(defaultDockState(panels), {
      type: "resizeRail",
      rail: "left",
      width: 10,
    });
    expect(state.railWidths.left).toBe(240); // test panel minWidth
  });

  it("clamps above to the maximum", () => {
    const state = reduce(defaultDockState(panels), {
      type: "resizeRail",
      rail: "left",
      width: 5000,
    });
    expect(state.railWidths.left).toBe(MAX_RAIL_WIDTH);
  });
});

describe("hydrate", () => {
  it("normalizes a sparse persisted state", () => {
    const hydrated = reduce(defaultDockState(panels), {
      type: "hydrate",
      state: {
        placements: [
          { panelId: "library", rail: "left", order: 7, collapsed: false },
          { panelId: "chat", rail: "left", order: 3, collapsed: true },
        ],
        activeTab: { left: null, right: null },
        railWidths: { left: 50, right: 9999 },
      },
    });
    expect(ids(hydrated, "left")).toEqual(["chat", "library"]);
    expect(hydrated.activeTab.left).toBe("library");
    expect(hydrated.railWidths.left).toBeGreaterThanOrEqual(240);
    expect(hydrated.railWidths.right).toBeLessThanOrEqual(MAX_RAIL_WIDTH);
  });
});
