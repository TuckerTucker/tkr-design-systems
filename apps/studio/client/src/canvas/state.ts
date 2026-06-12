/**
 * CanvasViewState — the panel's reducer-owned model: artifact selection,
 * version lineage, platform mode, scrub preview, inspect/highlight state,
 * restore/undo, and the progressive generation indicator.
 *
 * Pure logic, fully unit-testable; CanvasPanel dispatches into it and the
 * effects (fetching, caching, WS subscriptions) live in the panel.
 */
import type {
  ApiError,
  ArtifactDetail,
  ArtifactSummary,
  Platform,
  VersionSummary,
} from "@studio/contract";

export type PlatformMode = "mobile" | "desktop" | "side-by-side";

export interface HighlightState {
  ruleId: string;
  nodeIds: string[];
}

export interface UndoState {
  /** The superseded head — restoring it is the inline Undo. */
  undoTarget: number;
  /** The head the restore created (from RestoreResponse). */
  restoredAs: number;
}

export interface CanvasState {
  artifacts: ArtifactSummary[] | null;
  artifactsError: ApiError | null;
  /** Explicit selection (chat focus or the artifact picker). */
  selectedArtifactId: string | null;
  /** workspace.yaml's active artifact, used when nothing is selected. */
  workspaceDefaultArtifactId: string | null;
  detail: ArtifactDetail | null;
  detailError: ApiError | null;
  platformMode: PlatformMode;
  /** null → the stage renders head. */
  scrubVersion: number | null;
  inspectEnabled: boolean;
  highlight: HighlightState | null;
  generation: { inProgress: boolean; summary: string | null };
  restorePending: boolean;
  restoreError: ApiError | null;
  undo: UndoState | null;
}

export const initialCanvasState: CanvasState = {
  artifacts: null,
  artifactsError: null,
  selectedArtifactId: null,
  workspaceDefaultArtifactId: null,
  detail: null,
  detailError: null,
  platformMode: "desktop",
  scrubVersion: null,
  inspectEnabled: false,
  highlight: null,
  generation: { inProgress: false, summary: null },
  restorePending: false,
  restoreError: null,
  undo: null,
};

export type CanvasAction =
  | { type: "workspace_changed" }
  | {
      type: "artifacts_loaded";
      artifacts: ArtifactSummary[];
      workspaceDefaultArtifactId: string | null;
    }
  | { type: "artifacts_failed"; error: ApiError }
  | { type: "select_artifact"; artifactId: string }
  | { type: "detail_loaded"; detail: ArtifactDetail }
  | { type: "detail_failed"; error: ApiError }
  | { type: "version_created"; artifactId: string; version: VersionSummary }
  | { type: "set_platform_mode"; mode: PlatformMode }
  | { type: "scrub"; version: number | null }
  | { type: "set_inspect"; enabled: boolean }
  | { type: "set_highlight"; highlight: HighlightState | null }
  | { type: "generation_started"; summary: string }
  | { type: "generation_settled" }
  | { type: "restore_started" }
  | { type: "restore_succeeded"; restoredAs: number; undoTarget: number }
  | { type: "restore_failed"; error: ApiError };

/** The artifact whose lineage drives the stage, filmstrip, and bar. */
export function activeArtifact(state: CanvasState): ArtifactSummary | null {
  if (state.artifacts === null || state.artifacts.length === 0) {
    return null;
  }
  const byId = (id: string | null): ArtifactSummary | undefined =>
    id === null
      ? undefined
      : state.artifacts?.find((artifact) => artifact.id === id);
  return (
    byId(state.selectedArtifactId) ??
    byId(state.workspaceDefaultArtifactId) ??
    state.artifacts[0] ??
    null
  );
}

/**
 * The sibling-platform variant of the active artifact: same name and
 * system, the other platform. Drives the platform-mode switcher and
 * side-by-side rendering; null → those modes are disabled-with-reason.
 */
export function siblingArtifact(state: CanvasState): ArtifactSummary | null {
  const active = activeArtifact(state);
  if (active === null || state.artifacts === null) {
    return null;
  }
  return (
    state.artifacts.find(
      (artifact) =>
        artifact.id !== active.id &&
        artifact.platform !== active.platform &&
        artifact.system === active.system &&
        artifact.name.toLowerCase() === active.name.toLowerCase(),
    ) ?? null
  );
}

/** The version on stage: scrub preview when active, otherwise head. */
export function renderedVersion(state: CanvasState): number | null {
  if (state.scrubVersion !== null) {
    return state.scrubVersion;
  }
  return state.detail?.headVersion ?? null;
}

function resetForArtifactChange(
  state: CanvasState,
  next: Partial<CanvasState>,
): CanvasState {
  return {
    ...state,
    ...next,
    detail: null,
    detailError: null,
    scrubVersion: null,
    highlight: null,
    restorePending: false,
    restoreError: null,
    undo: null,
  };
}

export function canvasReducer(
  state: CanvasState,
  action: CanvasAction,
): CanvasState {
  switch (action.type) {
    case "workspace_changed":
      return {
        ...initialCanvasState,
        inspectEnabled: state.inspectEnabled,
        generation: state.generation,
      };

    case "artifacts_loaded": {
      const next: CanvasState = {
        ...state,
        artifacts: action.artifacts,
        artifactsError: null,
        workspaceDefaultArtifactId: action.workspaceDefaultArtifactId,
      };
      const activeBefore = activeArtifact(state)?.id ?? null;
      const activeAfter = activeArtifact(next)?.id ?? null;
      if (activeAfter !== activeBefore) {
        const platform = activeArtifact(next)?.platform;
        return resetForArtifactChange(next, {
          platformMode: platform ?? next.platformMode,
        });
      }
      return next;
    }

    case "artifacts_failed":
      return { ...state, artifactsError: action.error };

    case "select_artifact": {
      if (activeArtifact(state)?.id === action.artifactId) {
        return { ...state, selectedArtifactId: action.artifactId };
      }
      const platform = state.artifacts?.find(
        (artifact) => artifact.id === action.artifactId,
      )?.platform;
      return resetForArtifactChange(state, {
        selectedArtifactId: action.artifactId,
        platformMode: platform ?? state.platformMode,
      });
    }

    case "detail_loaded":
      return {
        ...state,
        detail: action.detail,
        detailError: null,
        platformMode:
          state.platformMode === "side-by-side"
            ? state.platformMode
            : action.detail.platform,
      };

    case "detail_failed":
      return { ...state, detailError: action.error };

    case "version_created": {
      if (
        state.detail === null ||
        activeArtifact(state)?.id !== action.artifactId
      ) {
        // Stale event for a non-active artifact: the panel refreshes its
        // caches; the stage is never hijacked.
        return state;
      }
      const exists = state.detail.versions.some(
        (version) => version.number === action.version.number,
      );
      const versions = exists
        ? state.detail.versions
        : [...state.detail.versions, action.version].sort(
            (a, b) => a.number - b.number,
          );
      return {
        ...state,
        detail: {
          ...state.detail,
          versions,
          headVersion: Math.max(
            state.detail.headVersion ?? 0,
            action.version.number,
          ),
        },
        // The stage follows the new head when not scrubbing → any
        // violation highlight belongs to the previous render.
        highlight: state.scrubVersion === null ? null : state.highlight,
      };
    }

    case "set_platform_mode":
      return { ...state, platformMode: action.mode };

    case "scrub":
      if (action.version === state.scrubVersion) {
        return state;
      }
      return { ...state, scrubVersion: action.version, highlight: null };

    case "set_inspect":
      return { ...state, inspectEnabled: action.enabled };

    case "set_highlight":
      return { ...state, highlight: action.highlight };

    case "generation_started":
      return {
        ...state,
        generation: { inProgress: true, summary: action.summary },
      };

    case "generation_settled":
      return { ...state, generation: { inProgress: false, summary: null } };

    case "restore_started":
      return { ...state, restorePending: true, restoreError: null };

    case "restore_succeeded":
      return {
        ...state,
        restorePending: false,
        restoreError: null,
        scrubVersion: null,
        undo: { undoTarget: action.undoTarget, restoredAs: action.restoredAs },
      };

    case "restore_failed":
      return { ...state, restorePending: false, restoreError: action.error };
  }
}

/** True platform dimensions per architecture.md — binding. */
export const PLATFORM_DIMENSIONS: Record<
  Platform,
  { width: number; height: number }
> = {
  mobile: { width: 375, height: 812 },
  desktop: { width: 1280, height: 800 },
};
