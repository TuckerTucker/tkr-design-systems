/**
 * Wire ↔ runtime layout mapping — round-trip fidelity, the schemaVersion
 * gate, unknown-panel tolerance, and first-run defaults from the server's
 * shape-complete default document (empty placements).
 */
import { describe, expect, it } from "vitest";

import type { LayoutPreference } from "@studio/contract";

import {
  defaultLayout,
  fromLayoutPreference,
  toLayoutPreference,
} from "../../src/preferences/layoutMapping.js";
import { createDockReducer, defaultDockState } from "../../src/shell/dockReducer.js";
import { makeTestPanels } from "./helpers/shellHarness.jsx";

const panels = makeTestPanels();
const reduce = createDockReducer(panels);

describe("toLayoutPreference / fromLayoutPreference round trip", () => {
  it("survives a stacked, collapsed, resized arrangement", () => {
    let dock = defaultDockState(panels);
    dock = reduce(dock, { type: "move", panelId: "library", rail: "left", order: 0 });
    dock = reduce(dock, { type: "collapse", panelId: "chat" });
    dock = reduce(dock, { type: "resizeRail", rail: "left", width: 400 });

    const wire = toLayoutPreference(dock, "my-workspace");
    expect(wire.schemaVersion).toBe(1);
    expect(typeof wire.activeTab).toBe("string");
    expect(wire.lastWorkspaceId).toBe("my-workspace");
    // Server validation shape: every placement carries panelId + zone.
    for (const placement of wire.placements) {
      expect(typeof placement.panelId).toBe("string");
      expect(["left", "right"]).toContain(placement.zone);
    }

    const hydrated = fromLayoutPreference(wire, panels);
    expect(hydrated).not.toBeNull();
    const restored = reduce(hydrated!.dock, {
      type: "hydrate",
      state: hydrated!.dock,
    });
    expect(restored.placements).toEqual(dock.placements);
    expect(restored.activeTab).toEqual(dock.activeTab);
    expect(restored.railWidths).toEqual(dock.railWidths);
    expect(hydrated!.lastWorkspaceId).toBe("my-workspace");
  });
});

describe("active-tab fallback", () => {
  it("hydrates a document with active:false everywhere to visible panels", () => {
    // Regression: a persisted document where no placement carries
    // active:true (written by older builds, or saved from a null-active
    // state) must not hydrate every panel host hidden — boot feeds this
    // result straight into the reducer's initial state, bypassing the
    // hydrate normalization.
    const wire: LayoutPreference = {
      schemaVersion: 1,
      placements: [
        { panelId: "chat", zone: "left", order: 1000, collapsed: false, active: false },
        { panelId: "library", zone: "right", order: 1000, collapsed: false, active: false },
      ],
      activeTab: "",
      railWidths: { left: 320, right: 360 },
      lastWorkspaceId: "untitled-workspace-1",
    };

    const hydrated = fromLayoutPreference(wire, panels);
    expect(hydrated).not.toBeNull();
    expect(hydrated!.dock.activeTab.left).toBe("chat");
    expect(hydrated!.dock.activeTab.right).toBe("library");
  });

  it("leaves a rail's active tab null only when every panel there is collapsed", () => {
    const wire: LayoutPreference = {
      schemaVersion: 1,
      placements: [
        { panelId: "chat", zone: "left", order: 0, collapsed: true, active: false },
        { panelId: "library", zone: "left", order: 1, collapsed: false, active: false },
      ],
      activeTab: "",
      railWidths: { left: 320, right: 360 },
      lastWorkspaceId: null,
    };

    const hydrated = fromLayoutPreference(wire, panels);
    expect(hydrated).not.toBeNull();
    // library is the first expanded panel on the left; right rail is empty.
    expect(hydrated!.dock.activeTab.left).toBe("library");
    expect(hydrated!.dock.activeTab.right).toBeNull();
  });
});

describe("tolerances", () => {
  it("gates unrecognized schema versions to null (defaults apply)", () => {
    const wire = {
      ...toLayoutPreference(defaultDockState(panels), null),
      schemaVersion: 2,
    } as unknown as LayoutPreference;
    expect(fromLayoutPreference(wire, panels)).toBeNull();
  });

  it("drops placements naming unregistered panels, keeps the rest", () => {
    const wire = toLayoutPreference(defaultDockState(panels), null);
    wire.placements.push({ panelId: "retired-panel", zone: "left" });
    const hydrated = fromLayoutPreference(wire, panels);
    expect(hydrated?.droppedPanelIds).toEqual(["retired-panel"]);
    expect(
      hydrated?.dock.placements.map((placement) => placement.panelId).sort(),
    ).toEqual(["chat", "library"]);
  });

  it("hydrates the server's default document (empty placements) to first-run defaults", () => {
    const serverDefault: LayoutPreference = {
      schemaVersion: 1,
      placements: [],
      activeTab: "library",
      railWidths: { left: 320, right: 360 },
      lastWorkspaceId: null,
    };
    const hydrated = fromLayoutPreference(serverDefault, panels);
    expect(hydrated).not.toBeNull();
    const normalized = reduce(hydrated!.dock, {
      type: "hydrate",
      state: hydrated!.dock,
    });
    expect(normalized.placements).toEqual(defaultLayout(panels).dock.placements);
  });

  it("registered panels missing from the document join at their defaults", () => {
    const wire: LayoutPreference = {
      schemaVersion: 1,
      placements: [{ panelId: "chat", zone: "right", order: 0, collapsed: false }],
      activeTab: "chat",
      railWidths: { left: 320, right: 360 },
      lastWorkspaceId: null,
    };
    const hydrated = fromLayoutPreference(wire, panels);
    const libraryPlacement = hydrated?.dock.placements.find(
      (placement) => placement.panelId === "library",
    );
    expect(libraryPlacement?.rail).toBe("right");
  });
});
