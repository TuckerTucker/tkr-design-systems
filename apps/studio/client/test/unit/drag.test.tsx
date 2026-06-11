/**
 * Drag-to-swap — pointer drag with drop indicators, Escape cancel with no
 * state change, same-rail reorder, cancel on release outside any target,
 * and reduced-motion (no ghost, indicators still render — information,
 * not motion).
 */
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createDockReducer, defaultDockState } from "../../src/shell/dockReducer.js";
import {
  indicatorRect,
  resolveDropTarget,
  type RailZone,
} from "../../src/shell/dragController.js";
import { setReducedMotion } from "./helpers/media.js";
import {
  makeTestPanels,
  railPoint,
  renderShell,
  stubShellGeometry,
} from "./helpers/shellHarness.jsx";

function pointerMove(clientX: number, clientY: number): void {
  fireEvent(
    window,
    new MouseEvent("pointermove", { clientX, clientY, bubbles: true }),
  );
}

function pointerUp(): void {
  fireEvent(window, new MouseEvent("pointerup", { bubbles: true }));
}

function startDrag(headerId: string, clientX: number, clientY: number): void {
  const header = document.getElementById(headerId) as HTMLElement;
  fireEvent.pointerDown(header, { button: 0, clientX, clientY });
}

describe("resolveDropTarget (geometry units)", () => {
  const zones: RailZone[] = [
    {
      rail: "left",
      rect: { left: 0, top: 0, right: 320, bottom: 800, width: 320, height: 800 },
      headerMidYs: [18, 218],
    },
    {
      rail: "right",
      rect: { left: 1000, top: 0, right: 1360, bottom: 800, width: 360, height: 800 },
      headerMidYs: [],
    },
  ];

  it("maps pointer position to rail + insertion index", () => {
    expect(resolveDropTarget({ x: 100, y: 5 }, zones)).toEqual({
      rail: "left",
      index: 0,
    });
    expect(resolveDropTarget({ x: 100, y: 100 }, zones)).toEqual({
      rail: "left",
      index: 1,
    });
    expect(resolveDropTarget({ x: 100, y: 700 }, zones)).toEqual({
      rail: "left",
      index: 2,
    });
    expect(resolveDropTarget({ x: 1100, y: 400 }, zones)).toEqual({
      rail: "right",
      index: 0,
    });
    expect(resolveDropTarget({ x: 600, y: 400 }, zones)).toBeNull();
  });

  it("renders an empty rail's indicator as a rail highlight", () => {
    const rect = indicatorRect({ rail: "right", index: 0 }, zones);
    expect(rect?.height).toBe(800);
    const slot = indicatorRect({ rail: "left", index: 1 }, zones);
    expect(slot?.height).toBe(3);
  });
});

describe("drag-to-swap", () => {
  it("drags the library header to the left rail with indicators, drops, focus follows", async () => {
    const { changes } = renderShell();
    await screen.findByText("Library content");
    stubShellGeometry();

    startDrag("panel-header-library", 1100, 18);
    const target = railPoint("left", 300);
    pointerMove(target.clientX, target.clientY);

    expect(screen.getByTestId("drag-ghost")).toBeTruthy();
    expect(screen.getByTestId("drop-indicator")).toBeTruthy();

    pointerUp();
    expect(screen.queryByTestId("drag-ghost")).toBeNull();
    const last = changes.at(-1);
    expect(last?.placements.find((p) => p.panelId === "library")?.rail).toBe(
      "left",
    );
    // Both panels share the left rail now → tabs.
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(document.activeElement?.id).toBe("panel-header-library");
  });

  it("Escape cancels the drag with no state change", async () => {
    const { changes } = renderShell();
    await screen.findByText("Library content");
    stubShellGeometry();

    startDrag("panel-header-library", 1100, 18);
    pointerMove(160, 300);
    expect(screen.getByTestId("drag-ghost")).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("drag-ghost")).toBeNull();
    pointerUp(); // releasing afterwards must not drop either
    expect(changes).toHaveLength(0);
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
  });

  it("release outside any rail cancels with no state change", async () => {
    const { changes } = renderShell();
    await screen.findByText("Library content");
    stubShellGeometry();

    startDrag("panel-header-library", 1100, 18);
    pointerMove(600, 400); // between the rails
    expect(screen.queryByTestId("drop-indicator")).toBeNull();
    pointerUp();
    expect(changes).toHaveLength(0);
  });

  it("same-rail drop reorders the stack instead of swapping", async () => {
    const panels = makeTestPanels();
    const reduce = createDockReducer(panels);
    const initialState = reduce(defaultDockState(panels), {
      type: "move",
      panelId: "library",
      rail: "left",
      order: 1,
    });
    const { changes } = renderShell({ panels, initialState });
    await screen.findByText("Library content");
    stubShellGeometry();

    // Drag library (second header, top 200) above chat (mid 18).
    startDrag("panel-header-library", 160, 218);
    pointerMove(160, 5);
    pointerUp();

    const left = changes
      .at(-1)!
      .placements.filter((p) => p.rail === "left")
      .sort((a, b) => a.order - b.order)
      .map((p) => p.panelId);
    expect(left).toEqual(["library", "chat"]);
  });

  it("reduced motion: instant placement, no ghost, indicators still render", async () => {
    setReducedMotion(true);
    const { changes } = renderShell();
    await screen.findByText("Library content");
    stubShellGeometry();

    startDrag("panel-header-library", 1100, 18);
    pointerMove(160, 300);
    expect(screen.queryByTestId("drag-ghost")).toBeNull();
    expect(screen.getByTestId("drop-indicator")).toBeTruthy();
    pointerUp();
    expect(
      changes.at(-1)?.placements.find((p) => p.panelId === "library")?.rail,
    ).toBe("left");
  });
});
