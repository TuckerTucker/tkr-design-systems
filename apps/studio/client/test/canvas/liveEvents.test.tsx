/**
 * Live artifact events and progressive loading (slice 7) — the stage
 * swaps to the new head and the filmstrip appends on
 * artifact.version_created without user action, the compliance bar runs
 * pending → refreshed on artifact.compliance_completed, the generation
 * indicator is contextual and non-blocking (current version stays
 * interactive), stale events for non-active artifacts update caches but
 * never hijack the stage, and a reconnect resyncs head and compliance.
 */
import { fireEvent, screen, waitFor } from "@testing-library/dom";
import { describe, expect, it, vi } from "vitest";

import type { ServerMessage } from "@studio/contract";

import {
  createFakeCanvasApi,
  renderCanvas,
  seedAssembledArtifact,
  type CanvasRender,
  type FakeCanvasApi,
} from "./helpers/canvasHarness.jsx";
import {
  ASSEMBLED_SVG_TEXT,
  passingComplianceResponse,
  versionSummary,
} from "./helpers/fixtures.js";

let seq = 100;

function versionCreated(artifactId: string, version: number): ServerMessage {
  seq += 1;
  return {
    type: "artifact.version_created",
    seq,
    payload: { artifactId, version: versionSummary(version) },
  };
}

function complianceCompleted(artifactId: string, version: number): ServerMessage {
  seq += 1;
  return {
    type: "artifact.compliance_completed",
    seq,
    payload: { artifactId, version, status: "completed", passed: 8, failed: 0, advisory: 0 },
  };
}

async function readyCanvas(): Promise<{
  canvasApi: FakeCanvasApi;
  view: CanvasRender;
}> {
  const canvasApi = createFakeCanvasApi();
  seedAssembledArtifact(canvasApi);
  canvasApi.compliance.set("dash-desktop/1", {
    kind: "completed",
    response: passingComplianceResponse(),
  });
  const view = renderCanvas({ canvasApi });
  await waitFor(() =>
    expect(
      screen.getByTestId("canvas-svg-host").getAttribute("data-version"),
    ).toBe("1"),
  );
  return { canvasApi, view };
}

describe("artifact.version_created", () => {
  it("swaps the stage to the new head and appends the filmstrip thumbnail live", async () => {
    const { canvasApi, view } = await readyCanvas();
    // The pipeline lands version 2, then the event arrives.
    canvasApi.landVersion("dash-desktop", versionSummary(2), ASSEMBLED_SVG_TEXT);
    view.socket.emit(versionCreated("dash-desktop", 2));

    await waitFor(() =>
      expect(
        screen.getByTestId("canvas-svg-host").getAttribute("data-version"),
      ).toBe("2"),
    );
    expect(screen.getByTestId("filmstrip-entry-2").getAttribute("data-head")).toBe(
      "true",
    );
    // Compliance for the new version is pending until its run settles.
    expect(screen.getByText(/Checking compliance for v2/)).toBeTruthy();
  });

  it("events for a non-active artifact update caches but never hijack the stage", async () => {
    const { canvasApi, view } = await readyCanvas();
    const listSpy = vi.spyOn(canvasApi, "listArtifacts");

    // Another artifact lands a version (e.g. generated from chat while
    // this one is focused) — the list refreshes, the stage stays put.
    seedAssembledArtifact(canvasApi, { id: "report-mobile", name: "Report", platform: "mobile" });
    view.socket.emit(versionCreated("report-mobile", 1));

    await waitFor(() => expect(listSpy).toHaveBeenCalled());
    expect(
      screen.getByTestId("canvas-svg-host").getAttribute("data-version"),
    ).toBe("1");
    expect(screen.getByTestId("device-frame-desktop")).toBeTruthy();
  });

  it("preserves an active scrub preview while the head advances", async () => {
    const { canvasApi, view } = await readyCanvas();
    canvasApi.landVersion("dash-desktop", versionSummary(2), ASSEMBLED_SVG_TEXT);
    view.socket.emit(versionCreated("dash-desktop", 2));
    await screen.findByTestId("filmstrip-entry-2");

    fireEvent.mouseOver(screen.getByTestId("filmstrip-entry-1"));
    await waitFor(() =>
      expect(
        screen.getByTestId("canvas-svg-host").getAttribute("data-version"),
      ).toBe("1"),
    );

    canvasApi.landVersion("dash-desktop", versionSummary(3), ASSEMBLED_SVG_TEXT);
    view.socket.emit(versionCreated("dash-desktop", 3));
    await screen.findByTestId("filmstrip-entry-3");
    // Scrub preview survives; the head marker moved to v3.
    expect(
      screen.getByTestId("canvas-svg-host").getAttribute("data-version"),
    ).toBe("1");
    expect(screen.getByTestId("filmstrip-entry-3").getAttribute("data-head")).toBe(
      "true",
    );
  });
});

describe("artifact.compliance_completed", () => {
  it("refreshes the bar for the rendered version after the pending window", async () => {
    const { canvasApi, view } = await readyCanvas();
    canvasApi.landVersion("dash-desktop", versionSummary(2), ASSEMBLED_SVG_TEXT);
    view.socket.emit(versionCreated("dash-desktop", 2));
    await screen.findByText(/Checking compliance for v2/);

    canvasApi.compliance.set("dash-desktop/2", {
      kind: "completed",
      response: passingComplianceResponse(),
    });
    view.socket.emit(complianceCompleted("dash-desktop", 2));
    await waitFor(() =>
      expect(
        screen.getByTestId("compliance-overall").getAttribute("data-status"),
      ).toBe("pass"),
    );
  });
});

describe("progressive generation state", () => {
  it("shows a contextual non-blocking indicator while a generation runs", async () => {
    const { view } = await readyCanvas();
    seq += 1;
    view.socket.emit({
      type: "chat.tool_started",
      seq,
      payload: {
        messageId: "m1",
        toolCallId: "t1",
        tool: "wf_generate",
        summary: "Generating the dashboard with layout dashboard",
      },
    });
    const status = await screen.findByTestId("generation-status");
    expect(status.textContent).toContain("Generating");

    // The current version stays fully interactive: zoom still works.
    const stage = screen.getByTestId("canvas-stage");
    fireEvent.keyDown(stage, { key: "+" });
    expect(screen.getByTestId("zoom-level").textContent).toBe("125%");

    seq += 1;
    view.socket.emit({
      type: "chat.message_completed",
      seq,
      payload: { messageId: "m1", artifactRefs: [], cancelled: false },
    });
    await waitFor(() =>
      expect(screen.queryByTestId("generation-status")).toBeNull(),
    );
  });
});

describe("reconnect resync", () => {
  it("re-fetches the lineage and compliance for the active artifact on resume", async () => {
    const { canvasApi, view } = await readyCanvas();
    const detailSpy = vi.spyOn(canvasApi, "getArtifactDetail");
    const complianceSpy = vi.spyOn(canvasApi, "getVersionCompliance");

    // A version landed while we were offline.
    canvasApi.landVersion("dash-desktop", versionSummary(2), ASSEMBLED_SVG_TEXT);
    canvasApi.compliance.set("dash-desktop/2", {
      kind: "completed",
      response: passingComplianceResponse(),
    });
    view.socket.setState("reconnecting");
    view.socket.setState("open");

    await waitFor(() => expect(detailSpy).toHaveBeenCalled());
    await waitFor(() => expect(complianceSpy).toHaveBeenCalled());
    // The resynced lineage carries the missed head.
    await waitFor(() =>
      expect(
        screen.getByTestId("canvas-svg-host").getAttribute("data-version"),
      ).toBe("2"),
    );
  });
});
