/**
 * Compliance bar (slice 6) — per-rule chips with non-color glyphs for the
 * RENDERED version, inline rule expansion (no modal), click-to-highlight
 * through the violating fixture's known mapping (swiss-fixed-type-scale →
 * main__banner-info_0) with Escape clearing, node-less violations
 * disabled-with-reason, per-version results following the scrub, and the
 * pending state that never blocks the stage.
 */
import { fireEvent, screen, waitFor } from "@testing-library/dom";
import { describe, expect, it } from "vitest";

import {
  createFakeCanvasApi,
  renderCanvas,
  seedAssembledArtifact,
  type FakeCanvasApi,
} from "./helpers/canvasHarness.jsx";
import {
  passingComplianceResponse,
  violatingComplianceResponse,
  VIOLATING_SVG_TEXT,
} from "./helpers/fixtures.js";

async function readyBar(
  seed: (canvasApi: FakeCanvasApi) => void,
): Promise<FakeCanvasApi> {
  const canvasApi = createFakeCanvasApi();
  seed(canvasApi);
  renderCanvas({ canvasApi });
  await screen.findByTestId("canvas-compliance-bar");
  return canvasApi;
}

describe("compliance bar states", () => {
  it("shows the pending state without blocking the stage", async () => {
    await readyBar((canvasApi) => {
      seedAssembledArtifact(canvasApi);
      // No compliance seeded → the fake serves "pending".
    });
    expect(screen.getByText(/Checking compliance for v1/)).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByTestId("canvas-svg-host").querySelector("svg")).not.toBeNull(),
    );
  });

  it("shows unavailable in place with the reason", async () => {
    await readyBar((canvasApi) => {
      const artifact = seedAssembledArtifact(canvasApi);
      canvasApi.compliance.set(`${artifact.id}/1`, {
        kind: "unavailable",
        reason: "the design-systems bridge was down",
      });
    });
    await waitFor(() =>
      expect(screen.getByText(/Compliance unavailable for v1/)).toBeTruthy(),
    );
    expect(screen.getByText(/bridge was down/)).toBeTruthy();
  });

  it("renders overall and per-rule status with non-color glyphs", async () => {
    await readyBar((canvasApi) => {
      const artifact = seedAssembledArtifact(canvasApi);
      canvasApi.svgs.set(`${artifact.id}/1`, VIOLATING_SVG_TEXT);
      canvasApi.compliance.set(`${artifact.id}/1`, {
        kind: "completed",
        response: violatingComplianceResponse(),
      });
    });
    const overall = await screen.findByTestId("compliance-overall");
    expect(overall.getAttribute("data-status")).toBe("fail");
    expect(overall.textContent).toContain("6 passed");
    expect(overall.textContent).toContain("1 failed");
    const failChip = screen.getByTestId("compliance-chip-swiss-fixed-type-scale");
    expect(failChip.getAttribute("data-status")).toBe("fail");
    expect(failChip.textContent).toContain("✕"); // non-color indicator
    expect(
      screen.getByTestId("compliance-chip-swiss-grid-columns").textContent,
    ).toContain("✓");
  });
});

describe("violation highlighting via stable node IDs", () => {
  async function readyViolating(): Promise<FakeCanvasApi> {
    return readyBar((canvasApi) => {
      const artifact = seedAssembledArtifact(canvasApi);
      canvasApi.svgs.set(`${artifact.id}/1`, VIOLATING_SVG_TEXT);
      canvasApi.compliance.set(`${artifact.id}/1`, {
        kind: "completed",
        response: violatingComplianceResponse(),
      });
    });
  }

  it("expanding a failed rule lists the violation inline — no modal", async () => {
    await readyViolating();
    const chip = await screen.findByTestId(
      "compliance-chip-swiss-fixed-type-scale",
    );
    fireEvent.click(chip);
    expect(chip.getAttribute("aria-expanded")).toBe("true");
    const detail = screen.getByTestId("compliance-detail-swiss-fixed-type-scale");
    expect(detail.textContent).toContain("font-size 17");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("clicking the violation outlines main__banner-info_0 on the stage and Escape clears it", async () => {
    await readyViolating();
    await waitFor(() =>
      expect(
        screen
          .getByTestId("canvas-svg-host")
          .querySelector('[id="main__banner-info_0"]'),
      ).not.toBeNull(),
    );
    fireEvent.click(
      await screen.findByTestId("compliance-chip-swiss-fixed-type-scale"),
    );
    const highlightButton = screen.getByRole("button", {
      name: "Highlight on canvas",
    });
    expect((highlightButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(highlightButton);

    const outline = await screen.findByTestId("highlight-main__banner-info_0");
    expect(outline).toBeTruthy();
    // Escape clears the highlight in place.
    fireEvent.keyDown(screen.getByTestId("canvas-stage"), { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByTestId("highlight-main__banner-info_0")).toBeNull(),
    );
  });

  it("a node-less violation lists with the highlight disabled and the reason shown", async () => {
    await readyViolating();
    fireEvent.click(
      await screen.findByTestId("compliance-chip-swiss-photography-discipline"),
    );
    const detail = screen.getByTestId(
      "compliance-detail-swiss-photography-discipline",
    );
    const button = detail.querySelector("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(detail.textContent).toContain("whole document");
  });
});

describe("results follow the rendered version", () => {
  it("scrubbing to an earlier version swaps to that version's stored result", async () => {
    const canvasApi = createFakeCanvasApi();
    const artifact = seedAssembledArtifact(canvasApi, { versions: 2 });
    canvasApi.compliance.set(`${artifact.id}/1`, {
      kind: "completed",
      response: violatingComplianceResponse(),
    });
    canvasApi.compliance.set(`${artifact.id}/2`, {
      kind: "completed",
      response: passingComplianceResponse(),
    });
    renderCanvas({ canvasApi });

    const overall = await screen.findByTestId("compliance-overall");
    expect(overall.getAttribute("data-status")).toBe("pass");

    fireEvent.mouseOver(await screen.findByTestId("filmstrip-entry-1"));
    await waitFor(() =>
      expect(
        screen.getByTestId("compliance-overall").getAttribute("data-status"),
      ).toBe("fail"),
    );
    expect(
      screen.getByTestId("canvas-compliance-bar").getAttribute("data-version"),
    ).toBe("1");
  });
});
