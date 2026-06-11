/**
 * CanvasPanel — slices 1–3: the native SVG stage (real fixture content,
 * stable node IDs intact, never an <img>), the empty state pointing at
 * chat, inline fetch errors with retry, true-dimension device frames with
 * the side-by-side mode (disabled-with-reason without a sibling variant),
 * keyboard-complete zoom/pan with clamping, and the shell focus seam.
 */
import { fireEvent, screen, waitFor } from "@testing-library/dom";
import { describe, expect, it } from "vitest";

import { setReducedMotion } from "../unit/helpers/media.js";
import {
  createFakeCanvasApi,
  renderCanvas,
  seedAssembledArtifact,
} from "./helpers/canvasHarness.jsx";

describe("empty and loading surfaces", () => {
  it("renders the empty state pointing at chat for a workspace with no artifacts", async () => {
    const canvasApi = createFakeCanvasApi();
    renderCanvas({ canvasApi });
    await waitFor(() =>
      expect(screen.getByTestId("canvas-empty")).toBeTruthy(),
    );
    expect(screen.getByText(/describe a screen in chat/i)).toBeTruthy();
    // No dead chrome: no filmstrip, no compliance bar.
    expect(screen.queryByTestId("canvas-filmstrip")).toBeNull();
    expect(screen.queryByTestId("canvas-compliance-bar")).toBeNull();
  });

  it("shows the artifact-list failure inline with a retry that recovers", async () => {
    const canvasApi = createFakeCanvasApi();
    seedAssembledArtifact(canvasApi);
    canvasApi.listError = {
      code: "store_failure",
      message: "The workspace store could not be read.",
      fix: "Check disk permissions and retry.",
    };
    renderCanvas({ canvasApi });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("could not be loaded");
    expect(alert.textContent).toContain("Check disk permissions");

    canvasApi.listError = null;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() =>
      expect(screen.getByTestId("canvas-svg-host")).toBeTruthy(),
    );
  });
});

describe("native SVG stage (slice 1)", () => {
  it("renders the head version as inline vector DOM with stable node IDs, no <img>", async () => {
    const canvasApi = createFakeCanvasApi();
    seedAssembledArtifact(canvasApi);
    const { container } = renderCanvas({ canvasApi });

    await waitFor(() =>
      expect(screen.getByTestId("canvas-svg-host")).toBeTruthy(),
    );
    const host = screen.getByTestId("canvas-svg-host");
    expect(host.getAttribute("data-version")).toBe("1");
    await waitFor(() => expect(host.querySelector("svg")).not.toBeNull());
    expect(host.querySelector('[id="main__banner-info_0"]')).not.toBeNull();
    expect(host.querySelector('[id="header__breadcrumb-default_0"]')).not.toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(host.querySelector("script")).toBeNull();
  });

  it("shows an inline SVG fetch error with what failed, the fix, and a working retry", async () => {
    const canvasApi = createFakeCanvasApi();
    const artifact = seedAssembledArtifact(canvasApi);
    canvasApi.failSvg.set(`${artifact.id}/1`, {
      code: "internal_error",
      message: "The SVG could not be read.",
      fix: "Check that studio-server is running, then retry.",
    });
    renderCanvas({ canvasApi });

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Version 1 could not be loaded");
    expect(alert.textContent).toContain("Check that studio-server is running");

    canvasApi.failSvg.clear();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() =>
      expect(screen.getByTestId("canvas-svg-host")).toBeTruthy(),
    );
  });
});

describe("device frames and side-by-side (slice 2)", () => {
  it("frames a desktop artifact at exactly 1280×800", async () => {
    const canvasApi = createFakeCanvasApi();
    seedAssembledArtifact(canvasApi);
    renderCanvas({ canvasApi });
    const frame = await screen.findByTestId("device-frame-desktop");
    expect(frame.style.width).toBe("1280px");
    expect(frame.style.height).toBe("800px");
  });

  it("frames a mobile artifact at exactly 375×812", async () => {
    const canvasApi = createFakeCanvasApi();
    seedAssembledArtifact(canvasApi, { id: "dash-mobile", platform: "mobile" });
    renderCanvas({ canvasApi });
    const frame = await screen.findByTestId("device-frame-mobile");
    expect(frame.style.width).toBe("375px");
    expect(frame.style.height).toBe("812px");
  });

  it("disables side-by-side and the missing platform with a visible reason when no sibling exists", async () => {
    const canvasApi = createFakeCanvasApi();
    seedAssembledArtifact(canvasApi);
    renderCanvas({ canvasApi });
    await screen.findByTestId("device-frame-desktop");

    const sideBySide = screen.getByRole("button", { name: "side-by-side" });
    const mobile = screen.getByRole("button", { name: "mobile" });
    expect((sideBySide as HTMLButtonElement).disabled).toBe(true);
    expect(sideBySide.getAttribute("title")).toContain("No mobile variant");
    expect((mobile as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "desktop" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("renders both true-dimension frames side by side when the sibling exists", async () => {
    const canvasApi = createFakeCanvasApi();
    seedAssembledArtifact(canvasApi, { id: "dash-desktop", platform: "desktop" });
    seedAssembledArtifact(canvasApi, { id: "dash-mobile", platform: "mobile" });
    renderCanvas({ canvasApi });
    await screen.findByTestId("device-frame-desktop");

    const sideBySide = screen.getByRole("button", { name: "side-by-side" });
    expect((sideBySide as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(sideBySide);
    await waitFor(() => {
      expect(screen.getByTestId("device-frame-desktop")).toBeTruthy();
      expect(screen.getByTestId("device-frame-mobile")).toBeTruthy();
    });
    expect(sideBySide.getAttribute("aria-pressed")).toBe("true");
  });

  it("switching to the sibling platform swaps the active artifact", async () => {
    const canvasApi = createFakeCanvasApi();
    seedAssembledArtifact(canvasApi, { id: "dash-desktop", platform: "desktop" });
    seedAssembledArtifact(canvasApi, { id: "dash-mobile", platform: "mobile" });
    renderCanvas({ canvasApi });
    await screen.findByTestId("device-frame-desktop");

    fireEvent.click(screen.getByRole("button", { name: "mobile" }));
    await screen.findByTestId("device-frame-mobile");
    expect(screen.queryByTestId("device-frame-desktop")).toBeNull();
  });
});

describe("viewport keyboard parity and clamps (slice 3)", () => {
  async function stage(): Promise<HTMLElement> {
    const canvasApi = createFakeCanvasApi();
    seedAssembledArtifact(canvasApi);
    renderCanvas({ canvasApi });
    await screen.findByTestId("canvas-svg-host");
    return screen.getByTestId("canvas-stage");
  }

  it("+ zooms in, - zooms out, 0 refits, 1 sets actual size — keyboard only", async () => {
    const stageEl = await stage();
    const level = (): string => screen.getByTestId("zoom-level").textContent ?? "";
    expect(level()).toBe("100%");

    fireEvent.keyDown(stageEl, { key: "+" });
    expect(level()).toBe("125%");
    fireEvent.keyDown(stageEl, { key: "-" });
    expect(level()).toBe("100%");
    fireEvent.keyDown(stageEl, { key: "1" });
    expect(level()).toBe("100%");
    fireEvent.keyDown(stageEl, { key: "+" });
    fireEvent.keyDown(stageEl, { key: "0" });
    expect(level()).toBe("100%");
  });

  it("clamps at 400% and 10% — further input is a quiet no-op", async () => {
    const stageEl = await stage();
    for (let press = 0; press < 12; press += 1) {
      fireEvent.keyDown(stageEl, { key: "+" });
    }
    expect(screen.getByTestId("zoom-level").textContent).toBe("400%");
    for (let press = 0; press < 30; press += 1) {
      fireEvent.keyDown(stageEl, { key: "-" });
    }
    expect(screen.getByTestId("zoom-level").textContent).toBe("10%");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("arrow keys pan the stage content transform", async () => {
    const stageEl = await stage();
    const content = document.querySelector(".canvas-stage-content") as HTMLElement;
    const before = content.style.transform;
    fireEvent.keyDown(stageEl, { key: "ArrowLeft" });
    expect(content.style.transform).not.toBe(before);
  });
});

describe("reduced motion", () => {
  it("disables the animated stage transform under prefers-reduced-motion", async () => {
    setReducedMotion(true);
    const canvasApi = createFakeCanvasApi();
    seedAssembledArtifact(canvasApi);
    renderCanvas({ canvasApi });
    await screen.findByTestId("canvas-svg-host");
    const content = document.querySelector(".canvas-stage-content") as HTMLElement;
    expect(content.getAttribute("data-animate")).toBe("false");
  });

  it("animates the stage transform when motion is allowed", async () => {
    const canvasApi = createFakeCanvasApi();
    seedAssembledArtifact(canvasApi);
    renderCanvas({ canvasApi });
    await screen.findByTestId("canvas-svg-host");
    const content = document.querySelector(".canvas-stage-content") as HTMLElement;
    expect(content.getAttribute("data-animate")).toBe("true");
  });
});

describe("shell focus seam", () => {
  it("focusArtifact from the shell switches the canvas to that artifact", async () => {
    const canvasApi = createFakeCanvasApi();
    seedAssembledArtifact(canvasApi, { id: "dash-desktop", platform: "desktop" });
    seedAssembledArtifact(canvasApi, {
      id: "report-mobile",
      name: "Report",
      platform: "mobile",
    });
    const view = renderCanvas({ canvasApi });
    await screen.findByTestId("device-frame-desktop");

    view.focusArtifact("report-mobile");
    await screen.findByTestId("device-frame-mobile");
    expect(
      (screen.getByLabelText("Artifact") as HTMLSelectElement).value,
    ).toBe("report-mobile");
  });
});
