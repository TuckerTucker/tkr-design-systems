/**
 * Generation-history filmstrip (slice 5) — thumbnails oldest → newest
 * with the head marked, hover/keyboard scrub-to-preview that never moves
 * the head, restore-as-new-head with NO confirmation dialog, the inline
 * Undo that brings the previous head back as another new head, restore
 * failures reported in place, and single-version handling
 * (disabled-with-reason, not hidden).
 */
import { fireEvent, screen, waitFor } from "@testing-library/dom";
import { describe, expect, it } from "vitest";

import {
  createFakeCanvasApi,
  renderCanvas,
  seedAssembledArtifact,
  type FakeCanvasApi,
} from "./helpers/canvasHarness.jsx";

async function readyFilmstrip(versions: number): Promise<FakeCanvasApi> {
  const canvasApi = createFakeCanvasApi();
  seedAssembledArtifact(canvasApi, { versions });
  renderCanvas({ canvasApi });
  await screen.findByTestId("canvas-filmstrip");
  await waitFor(() =>
    expect(screen.getByTestId("canvas-svg-host").getAttribute("data-version")).toBe(
      String(versions),
    ),
  );
  return canvasApi;
}

describe("filmstrip rendering", () => {
  it("lists every version oldest → newest with the head marked and SVG thumbnails", async () => {
    await readyFilmstrip(3);
    const entries = screen.getAllByRole("option");
    expect(entries.map((entry) => entry.getAttribute("data-testid"))).toEqual([
      "filmstrip-entry-1",
      "filmstrip-entry-2",
      "filmstrip-entry-3",
    ]);
    expect(screen.getByTestId("filmstrip-entry-3").getAttribute("data-head")).toBe(
      "true",
    );
    // Thumbnails are native SVG with prefixed ids (no stage collisions).
    await waitFor(() =>
      expect(
        screen
          .getByTestId("thumbnail-svg-1")
          .querySelector('[id="thumb-v1-main__banner-info_0"]'),
      ).not.toBeNull(),
    );
    expect(
      screen.getByTestId("thumbnail-svg-1").querySelector('[id="main__banner-info_0"]'),
    ).toBeNull();
    // Provenance metadata reaches hover/focus surfaces.
    expect(screen.getByTestId("filmstrip-entry-2").getAttribute("title")).toContain(
      "version 2 of the assembled dashboard",
    );
  });
});

describe("scrub to preview", () => {
  it("hover previews a version without changing head; leaving returns to head", async () => {
    await readyFilmstrip(3);
    const host = (): string | null =>
      screen.getByTestId("canvas-svg-host").getAttribute("data-version");

    fireEvent.mouseOver(screen.getByTestId("filmstrip-entry-1"));
    await waitFor(() => expect(host()).toBe("1"));
    expect(screen.getByText(/Previewing v1 — head is v3/)).toBeTruthy();
    expect(screen.getByTestId("filmstrip-entry-3").getAttribute("data-head")).toBe(
      "true",
    );

    fireEvent.mouseOut(
      screen
        .getByTestId("canvas-filmstrip")
        .querySelector(".canvas-filmstrip-strip") as Element,
      { relatedTarget: document.body },
    );
    await waitFor(() => expect(host()).toBe("3"));
  });

  it("Left/Right scrub, Home jumps to the first version, End returns to head", async () => {
    await readyFilmstrip(3);
    const strip = screen.getByRole("listbox");
    strip.focus();
    const host = (): string | null =>
      screen.getByTestId("canvas-svg-host").getAttribute("data-version");

    fireEvent.keyDown(strip, { key: "ArrowLeft" });
    await waitFor(() => expect(host()).toBe("2"));
    fireEvent.keyDown(strip, { key: "ArrowLeft" });
    await waitFor(() => expect(host()).toBe("1"));
    fireEvent.keyDown(strip, { key: "ArrowRight" });
    await waitFor(() => expect(host()).toBe("2"));
    fireEvent.keyDown(strip, { key: "Home" });
    await waitFor(() => expect(host()).toBe("1"));
    fireEvent.keyDown(strip, { key: "End" });
    await waitFor(() => expect(host()).toBe("3"));
  });
});

describe("restore as a new head (undo semantics, never confirmation)", () => {
  it("restores a scrubbed version via Enter — new head appended, no dialog anywhere", async () => {
    const canvasApi = await readyFilmstrip(3);
    const strip = screen.getByRole("listbox");
    strip.focus();
    fireEvent.keyDown(strip, { key: "Home" });
    fireEvent.keyDown(strip, { key: "Enter" });

    await waitFor(() =>
      expect(screen.getByTestId("filmstrip-entry-4")).toBeTruthy(),
    );
    expect(canvasApi.restoreCalls).toEqual([
      { artifactId: "dash-desktop", version: 1 },
    ]);
    expect(screen.getByTestId("filmstrip-entry-4").getAttribute("data-head")).toBe(
      "true",
    );
    // Prior versions remain; nothing was destroyed.
    expect(screen.getByTestId("filmstrip-entry-1")).toBeTruthy();
    // No confirmation dialog appeared at any point.
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    // The stage follows the new head.
    await waitFor(() =>
      expect(
        screen.getByTestId("canvas-svg-host").getAttribute("data-version"),
      ).toBe("4"),
    );
  });

  it("the restore button restores and the inline Undo brings the previous head back as another new head", async () => {
    const canvasApi = await readyFilmstrip(3);
    const restoreButtons = screen.getAllByRole("button", { name: "Restore" });
    fireEvent.click(restoreButtons[0] as Element); // restore v1 → v4

    const undo = await screen.findByRole("button", {
      name: /Undo — bring back v3/,
    });
    fireEvent.click(undo);
    await waitFor(() =>
      expect(screen.getByTestId("filmstrip-entry-5")).toBeTruthy(),
    );
    expect(canvasApi.restoreCalls).toEqual([
      { artifactId: "dash-desktop", version: 1 },
      { artifactId: "dash-desktop", version: 3 },
    ]);
    expect(screen.getByTestId("filmstrip-entry-5").getAttribute("data-head")).toBe(
      "true",
    );
  });

  it("restore is disabled on the head thumbnail and reports failures in place", async () => {
    const canvasApi = await readyFilmstrip(2);
    const buttons = screen.getAllByRole("button", { name: "Restore" });
    const headRestore = buttons[1] as HTMLButtonElement;
    expect(headRestore.disabled).toBe(true);
    expect(headRestore.title).toContain("Already the head version");

    canvasApi.restoreError = {
      code: "internal_error",
      message: "The restore could not be written.",
      fix: "Check the workspace store and retry.",
    };
    fireEvent.click(buttons[0] as Element);
    const error = await screen.findByRole("alert");
    expect(error.textContent).toContain("could not be written");
    // Head unchanged.
    expect(screen.getByTestId("filmstrip-entry-2").getAttribute("data-head")).toBe(
      "true",
    );
    expect(screen.queryByTestId("filmstrip-entry-3")).toBeNull();
  });

  it("a single-version artifact shows restore disabled with the reason, not hidden", async () => {
    await readyFilmstrip(1);
    const restore = screen.getByRole("button", { name: "Restore" }) as HTMLButtonElement;
    expect(restore.disabled).toBe(true);
    expect(restore.title).toContain("only version");
  });
});
