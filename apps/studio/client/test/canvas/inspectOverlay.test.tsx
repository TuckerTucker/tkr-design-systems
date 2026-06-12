/**
 * Inspect-on-hover overlay (slice 4) — off by default with zero overlay
 * noise, hover resolves the stable group id to the spec metadata
 * (component id, variant, region), keyboard cycling shows the same
 * popover with aria-describedby exposure, unmapped nodes fall back to a
 * "no component metadata" note, and a failed spec fetch disables the
 * toggle with the reason while the stage keeps rendering.
 */
import { fireEvent, screen, waitFor } from "@testing-library/dom";
import { describe, expect, it } from "vitest";

import {
  createFakeCanvasApi,
  renderCanvas,
  seedAssembledArtifact,
  type FakeCanvasApi,
} from "./helpers/canvasHarness.jsx";

async function readyStage(canvasApi: FakeCanvasApi): Promise<HTMLElement> {
  renderCanvas({ canvasApi });
  const host = await screen.findByTestId("canvas-svg-host");
  await waitFor(() =>
    expect(host.querySelector('[id="main__banner-info_0"]')).not.toBeNull(),
  );
  return host;
}

describe("inspect mode", () => {
  it("is off by default — no outlines, no popovers", async () => {
    const canvasApi = createFakeCanvasApi();
    seedAssembledArtifact(canvasApi);
    const host = await readyStage(canvasApi);
    fireEvent.pointerMove(
      host.querySelector('[id="main__banner-info_0"] text') as Element,
    );
    expect(screen.queryByTestId("inspect-popover")).toBeNull();
    expect(screen.queryByTestId("inspect-outline")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Inspect" }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("hovering a mapped node shows component id, variant, and region from the real spec", async () => {
    const canvasApi = createFakeCanvasApi();
    seedAssembledArtifact(canvasApi);
    const host = await readyStage(canvasApi);

    fireEvent.click(screen.getByRole("button", { name: "Inspect" }));
    fireEvent.pointerMove(
      host.querySelector('[id="main__banner-info_0"] text') as Element,
    );
    const popover = await screen.findByTestId("inspect-popover");
    expect(popover.textContent).toContain("banner-info");
    expect(popover.textContent).toContain("info");
    expect(popover.textContent).toContain("region main");
    expect(popover.textContent).toContain("main__banner-info_0");
    const outline = screen.getByTestId("inspect-outline");
    expect(outline.getAttribute("data-node-id")).toBe("main__banner-info_0");
    // Non-destructive: the artifact SVG itself was never mutated.
    expect(host.querySelector('[id="main__banner-info_0"]')?.getAttribute("style")).toBeNull();
  });

  it("falls back to the node id with a 'no component metadata' note for unmapped nodes", async () => {
    const canvasApi = createFakeCanvasApi();
    const artifact = seedAssembledArtifact(canvasApi);
    // Drop the breadcrumb from the metadata so its group id is unmapped.
    const spec = canvasApi.specs.get(`${artifact.id}/1`);
    if (spec === undefined) {
      throw new Error("spec not seeded");
    }
    spec.design_system.components_used = spec.design_system.components_used.filter(
      (component) => component.id !== "breadcrumb-default",
    );
    const host = await readyStage(canvasApi);

    fireEvent.click(screen.getByRole("button", { name: "Inspect" }));
    fireEvent.pointerMove(
      host.querySelector('[id="header__breadcrumb-default_0"] text') as Element,
    );
    const popover = await screen.findByTestId("inspect-popover");
    expect(popover.textContent).toContain("header__breadcrumb-default_0");
    expect(popover.textContent).toContain("no component metadata");
  });

  it("keyboard cycling shows the same popover and exposes it via aria-describedby", async () => {
    const canvasApi = createFakeCanvasApi();
    seedAssembledArtifact(canvasApi);
    await readyStage(canvasApi);

    fireEvent.click(screen.getByRole("button", { name: "Inspect" }));
    const cycle = await screen.findByTestId("inspect-cycle");
    cycle.focus();
    fireEvent.keyDown(cycle, { key: "ArrowRight" });
    const popover = await screen.findByTestId("inspect-popover");
    expect(popover.textContent).toContain("breadcrumb-default");
    expect(cycle.getAttribute("aria-describedby")).toBe(popover.id);

    fireEvent.keyDown(cycle, { key: "ArrowRight" });
    expect(screen.getByTestId("inspect-popover").textContent).toContain(
      "banner-info",
    );
    fireEvent.keyDown(cycle, { key: "ArrowLeft" });
    expect(screen.getByTestId("inspect-popover").textContent).toContain(
      "breadcrumb-default",
    );
    fireEvent.keyDown(cycle, { key: "Escape" });
    expect(screen.queryByTestId("inspect-popover")).toBeNull();
  });

  it("toggling off removes all overlay chrome", async () => {
    const canvasApi = createFakeCanvasApi();
    seedAssembledArtifact(canvasApi);
    const host = await readyStage(canvasApi);

    const toggle = screen.getByRole("button", { name: "Inspect" });
    fireEvent.click(toggle);
    fireEvent.pointerMove(
      host.querySelector('[id="main__banner-info_0"] text') as Element,
    );
    await screen.findByTestId("inspect-popover");
    fireEvent.click(toggle);
    expect(screen.queryByTestId("inspect-popover")).toBeNull();
    expect(screen.queryByTestId("inspect-layer")).toBeNull();
  });

  it("disables the toggle with the reason when spec metadata is unavailable — the stage still renders", async () => {
    const canvasApi = createFakeCanvasApi();
    const artifact = seedAssembledArtifact(canvasApi);
    canvasApi.specs.delete(`${artifact.id}/1`);
    await readyStage(canvasApi);

    await waitFor(() => {
      const toggle = screen.getByRole("button", { name: "Inspect" });
      expect((toggle as HTMLButtonElement).disabled).toBe(true);
    });
    expect(
      screen.getByRole("button", { name: "Inspect" }).getAttribute("title"),
    ).toContain("metadata is unavailable");
    expect(screen.getByTestId("canvas-svg-host").querySelector("svg")).not.toBeNull();
  });
});
