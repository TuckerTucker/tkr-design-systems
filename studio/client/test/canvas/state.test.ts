/**
 * CanvasViewState reducer — artifact resolution (selection, workspace
 * default, sibling platform variants), rendered-version derivation,
 * version_created lineage handling (active vs stale, dedupe, scrub
 * preservation), restore/undo state, and the binding platform dimensions.
 */
import { describe, expect, it } from "vitest";

import type { ArtifactDetail, ArtifactSummary } from "@studio/contract";

import {
  activeArtifact,
  canvasReducer,
  initialCanvasState,
  PLATFORM_DIMENSIONS,
  renderedVersion,
  siblingArtifact,
  type CanvasState,
} from "../../src/canvas/state.js";
import { versionSummary } from "./helpers/fixtures.js";

function summary(
  id: string,
  platform: "mobile" | "desktop",
  name = "Dashboard",
): ArtifactSummary {
  return { id, name, system: "swiss", platform, headVersion: 1 };
}

function detailOf(artifact: ArtifactSummary, versions: number): ArtifactDetail {
  return {
    ...artifact,
    headVersion: versions,
    versions: Array.from({ length: versions }, (_, index) =>
      versionSummary(index + 1),
    ),
  };
}

function loaded(
  artifacts: ArtifactSummary[],
  workspaceDefaultArtifactId: string | null = null,
): CanvasState {
  return canvasReducer(initialCanvasState, {
    type: "artifacts_loaded",
    artifacts,
    workspaceDefaultArtifactId,
  });
}

describe("platform dimensions (architecture.md, binding)", () => {
  it("mobile is exactly 375×812 and desktop 1280×800", () => {
    expect(PLATFORM_DIMENSIONS.mobile).toEqual({ width: 375, height: 812 });
    expect(PLATFORM_DIMENSIONS.desktop).toEqual({ width: 1280, height: 800 });
  });
});

describe("active artifact resolution", () => {
  it("prefers the explicit selection, then the workspace default, then the first artifact", () => {
    const artifacts = [summary("a", "desktop"), summary("b", "mobile", "Other")];
    expect(activeArtifact(loaded(artifacts))?.id).toBe("a");
    expect(activeArtifact(loaded(artifacts, "b"))?.id).toBe("b");
    const selected = canvasReducer(loaded(artifacts, "b"), {
      type: "select_artifact",
      artifactId: "a",
    });
    expect(activeArtifact(selected)?.id).toBe("a");
  });

  it("finds the sibling platform variant by name and system", () => {
    const artifacts = [
      summary("dash-desktop", "desktop"),
      summary("dash-mobile", "mobile"),
      summary("other", "mobile", "Other Screen"),
    ];
    const state = loaded(artifacts);
    expect(siblingArtifact(state)?.id).toBe("dash-mobile");
  });

  it("has no sibling when only one platform exists", () => {
    expect(siblingArtifact(loaded([summary("solo", "mobile")]))).toBeNull();
  });
});

describe("rendered version", () => {
  it("renders head until a scrub preview is active, then returns to head", () => {
    const artifact = summary("a", "desktop");
    let state = loaded([artifact]);
    state = canvasReducer(state, {
      type: "detail_loaded",
      detail: detailOf(artifact, 3),
    });
    expect(renderedVersion(state)).toBe(3);
    state = canvasReducer(state, { type: "scrub", version: 1 });
    expect(renderedVersion(state)).toBe(1);
    state = canvasReducer(state, { type: "scrub", version: null });
    expect(renderedVersion(state)).toBe(3);
  });
});

describe("version_created", () => {
  function withDetail(versions: number): CanvasState {
    const artifact = summary("a", "desktop");
    return canvasReducer(loaded([artifact]), {
      type: "detail_loaded",
      detail: detailOf(artifact, versions),
    });
  }

  it("appends to the lineage and follows the new head", () => {
    const next = canvasReducer(withDetail(2), {
      type: "version_created",
      artifactId: "a",
      version: versionSummary(3),
    });
    expect(next.detail?.versions.map((v) => v.number)).toEqual([1, 2, 3]);
    expect(next.detail?.headVersion).toBe(3);
    expect(renderedVersion(next)).toBe(3);
  });

  it("never hijacks the stage for a non-active artifact", () => {
    const state = withDetail(2);
    const next = canvasReducer(state, {
      type: "version_created",
      artifactId: "someone-else",
      version: versionSummary(9),
    });
    expect(next).toBe(state);
  });

  it("preserves an active scrub preview while the head indicator updates", () => {
    let state = withDetail(3);
    state = canvasReducer(state, { type: "scrub", version: 1 });
    state = canvasReducer(state, {
      type: "version_created",
      artifactId: "a",
      version: versionSummary(4),
    });
    expect(state.scrubVersion).toBe(1);
    expect(renderedVersion(state)).toBe(1);
    expect(state.detail?.headVersion).toBe(4);
    // Leaving scrub lands on the NEW head.
    state = canvasReducer(state, { type: "scrub", version: null });
    expect(renderedVersion(state)).toBe(4);
  });

  it("de-duplicates a version landed by both the restore response and the WS event", () => {
    let state = withDetail(2);
    const landed = versionSummary(3, { tool: "restore" });
    state = canvasReducer(state, {
      type: "version_created",
      artifactId: "a",
      version: landed,
    });
    state = canvasReducer(state, {
      type: "version_created",
      artifactId: "a",
      version: landed,
    });
    expect(state.detail?.versions).toHaveLength(3);
  });

  it("clears a stale violation highlight when the stage follows the new head", () => {
    let state = withDetail(2);
    state = canvasReducer(state, {
      type: "set_highlight",
      highlight: { ruleId: "r", nodeIds: ["main__banner-info_0"] },
    });
    state = canvasReducer(state, {
      type: "version_created",
      artifactId: "a",
      version: versionSummary(3),
    });
    expect(state.highlight).toBeNull();
  });
});

describe("restore and undo", () => {
  it("tracks the in-flight restore, the new head, and the undo target", () => {
    const artifact = summary("a", "desktop");
    let state = canvasReducer(loaded([artifact]), {
      type: "detail_loaded",
      detail: detailOf(artifact, 4),
    });
    state = canvasReducer(state, { type: "scrub", version: 2 });
    state = canvasReducer(state, { type: "restore_started" });
    expect(state.restorePending).toBe(true);
    state = canvasReducer(state, {
      type: "restore_succeeded",
      restoredAs: 5,
      undoTarget: 4,
    });
    expect(state.restorePending).toBe(false);
    expect(state.scrubVersion).toBeNull();
    expect(state.undo).toEqual({ undoTarget: 4, restoredAs: 5 });
  });

  it("keeps the head and reports the error in place when the restore fails", () => {
    let state = canvasReducer(initialCanvasState, { type: "restore_started" });
    state = canvasReducer(state, {
      type: "restore_failed",
      error: {
        code: "internal_error",
        message: "The restore failed.",
        fix: "Retry.",
      },
    });
    expect(state.restorePending).toBe(false);
    expect(state.restoreError?.message).toBe("The restore failed.");
    expect(state.undo).toBeNull();
  });
});

describe("workspace change", () => {
  it("resets selection and lineage but keeps the inspect preference", () => {
    const artifact = summary("a", "desktop");
    let state = loaded([artifact]);
    state = canvasReducer(state, { type: "set_inspect", enabled: true });
    state = canvasReducer(state, {
      type: "detail_loaded",
      detail: detailOf(artifact, 2),
    });
    state = canvasReducer(state, { type: "workspace_changed" });
    expect(state.artifacts).toBeNull();
    expect(state.detail).toBeNull();
    expect(state.inspectEnabled).toBe(true);
  });
});
