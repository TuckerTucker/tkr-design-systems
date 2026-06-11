/**
 * CanvasPanel — the always-center stage. Owns the canvas view state
 * (reducer), the per-(artifact, version) content caches (immutable
 * versions are fetched once), the shared viewport, and the live event
 * wiring; composes the device frames, native SVG stage, inspect overlay,
 * history filmstrip, and the persistent compliance bar.
 *
 * Data arrives only through studio-api (typed fetchers + WS payloads from
 * @studio/contract). Every error renders in place at the affected surface
 * — no toasts, no confirmation dialogs (restore offers undo instead).
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
} from "react";

import type {
  ApiError,
  ParsedSpecMetadata,
  Platform,
} from "@studio/contract";

import { useShellState } from "../app/shellState.jsx";
import { useReducedMotion } from "../shell/useReducedMotion.js";
import { createCanvasApi, type CanvasApi } from "./api.js";
import { ComplianceBar } from "./ComplianceBar.jsx";
import { toComplianceBarModel, type ComplianceBarState, type ComplianceRuleModel } from "./compliance.js";
import { DeviceFrame } from "./DeviceFrame.jsx";
import { EmptyState } from "./EmptyState.jsx";
import { buildFilmstrip } from "./filmstrip.js";
import { HistoryFilmstrip } from "./HistoryFilmstrip.jsx";
import { buildInspectTargets, type InspectTarget } from "./inspect.js";
import { contentRectIn, elementById, InspectOverlay } from "./InspectOverlay.jsx";
import {
  activeArtifact,
  canvasReducer,
  initialCanvasState,
  PLATFORM_DIMENSIONS,
  renderedVersion,
  siblingArtifact,
  type PlatformMode,
} from "./state.js";
import { SvgStage } from "./SvgStage.jsx";
import { useArtifactEvents } from "./useArtifactEvents.js";
import { useViewport, type ViewportSnapshot } from "./useViewport.js";

import "./canvas.css";

type Loadable<T> =
  | { status: "loading" }
  | { status: "ready"; value: T }
  | { status: "error"; error: ApiError };

interface ContentCaches {
  svg: Map<string, Loadable<string>>;
  spec: Map<string, Loadable<ParsedSpecMetadata>>;
  compliance: Map<string, ComplianceBarState>;
}

/** Vertical room the frame label occupies above the device content box. */
const FRAME_LABEL_HEIGHT = 28;
const FRAME_GAP = 48;

export interface CanvasPanelProps {
  /** Injected in tests; defaults to the same-origin fetch client. */
  api?: CanvasApi;
}

export function CanvasPanel(props: CanvasPanelProps): ReactElement {
  const injectedApi = props.api;
  const api = useMemo(() => injectedApi ?? createCanvasApi(), [injectedApi]);
  const { socket, activeWorkspaceId, workspaces, focusedArtifactId } =
    useShellState();
  const [state, dispatch] = useReducer(canvasReducer, initialCanvasState);
  const reducedMotion = useReducedMotion();

  const stateRef = useRef(state);
  stateRef.current = state;
  const workspaceIdRef = useRef(activeWorkspaceId);
  workspaceIdRef.current = activeWorkspaceId;
  const workspacesRef = useRef(workspaces);
  workspacesRef.current = workspaces;

  // ── Immutable per-(workspace, artifact, version) content caches ──
  const caches = useRef<ContentCaches>({
    svg: new Map(),
    spec: new Map(),
    compliance: new Map(),
  });
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const viewportMemory = useRef(new Map<string, ViewportSnapshot>());
  /** Last successfully rendered SVG per artifact (progressive loading). */
  const lastGood = useRef(new Map<string, { version: number; svgText: string }>());

  const [artifactsNonce, setArtifactsNonce] = useState(0);
  const [detailNonce, setDetailNonce] = useState(0);

  const keyFor = useCallback(
    (artifactId: string, version: number): string | null => {
      const workspaceId = workspaceIdRef.current;
      return workspaceId === null
        ? null
        : `${workspaceId}/${artifactId}/${version}`;
    },
    [],
  );

  const ensureSvg = useCallback(
    (artifactId: string, version: number): void => {
      const workspaceId = workspaceIdRef.current;
      const key = keyFor(artifactId, version);
      if (workspaceId === null || key === null) {
        return;
      }
      const existing = caches.current.svg.get(key);
      if (existing !== undefined && existing.status !== "error") {
        return;
      }
      caches.current.svg.set(key, { status: "loading" });
      bump();
      void api.getVersionSvg(workspaceId, artifactId, version).then((result) => {
        caches.current.svg.set(
          key,
          result.ok
            ? { status: "ready", value: result.value }
            : { status: "error", error: result.error },
        );
        bump();
      });
    },
    [api, keyFor],
  );

  const ensureSpec = useCallback(
    (artifactId: string, version: number): void => {
      const workspaceId = workspaceIdRef.current;
      const key = keyFor(artifactId, version);
      if (workspaceId === null || key === null) {
        return;
      }
      if (caches.current.spec.has(key)) {
        return;
      }
      caches.current.spec.set(key, { status: "loading" });
      void api.getVersionSpec(workspaceId, artifactId, version).then((result) => {
        caches.current.spec.set(
          key,
          result.ok
            ? { status: "ready", value: result.value }
            : { status: "error", error: result.error },
        );
        bump();
      });
    },
    [api, keyFor],
  );

  const ensureCompliance = useCallback(
    (artifactId: string, version: number, force: boolean): void => {
      const workspaceId = workspaceIdRef.current;
      const key = keyFor(artifactId, version);
      if (workspaceId === null || key === null) {
        return;
      }
      const existing = caches.current.compliance.get(key);
      if (!force && existing !== undefined && existing.kind !== "error") {
        return;
      }
      if (existing === undefined) {
        caches.current.compliance.set(key, { kind: "pending" });
        bump();
      }
      void api
        .getVersionCompliance(workspaceId, artifactId, version)
        .then((result) => {
          const next: ComplianceBarState =
            result.kind === "completed"
              ? { kind: "ready", model: toComplianceBarModel(result.response) }
              : result.kind === "pending"
                ? { kind: "pending" }
                : result.kind === "unavailable"
                  ? { kind: "unavailable", reason: result.reason }
                  : { kind: "error", error: result.error };
          caches.current.compliance.set(key, next);
          bump();
        });
    },
    [api, keyFor],
  );

  // ── Workspace lifecycle: reset, then load the artifact list ──
  useEffect(() => {
    dispatch({ type: "workspace_changed" });
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (activeWorkspaceId === null) {
      return;
    }
    let cancelled = false;
    void api.listArtifacts(activeWorkspaceId).then((result) => {
      if (cancelled) {
        return;
      }
      if (result.ok) {
        const workspaceDefaultArtifactId =
          workspacesRef.current?.find(
            (workspace) => workspace.id === activeWorkspaceId,
          )?.activeArtifactId ?? null;
        dispatch({
          type: "artifacts_loaded",
          artifacts: result.value,
          workspaceDefaultArtifactId,
        });
      } else {
        dispatch({ type: "artifacts_failed", error: result.error });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [api, activeWorkspaceId, artifactsNonce]);

  // ── Shell focus seam: chat tells the canvas which artifact to show ──
  useEffect(() => {
    if (focusedArtifactId !== null) {
      dispatch({ type: "select_artifact", artifactId: focusedArtifactId });
    }
  }, [focusedArtifactId]);

  const active = activeArtifact(state);
  const activeId = active?.id ?? null;
  const sibling = siblingArtifact(state);
  const siblingId = sibling?.id ?? null;
  const siblingHead = sibling?.headVersion ?? null;
  const rendered = renderedVersion(state);

  // ── Lineage for the active artifact ──
  useEffect(() => {
    if (activeWorkspaceId === null || activeId === null) {
      return;
    }
    let cancelled = false;
    void api.getArtifactDetail(activeWorkspaceId, activeId).then((result) => {
      if (cancelled) {
        return;
      }
      if (result.ok) {
        dispatch({ type: "detail_loaded", detail: result.value });
      } else {
        dispatch({ type: "detail_failed", error: result.error });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [api, activeWorkspaceId, activeId, detailNonce]);

  // ── Content for the rendered version (svg + spec + compliance) ──
  useEffect(() => {
    if (activeId === null || rendered === null) {
      return;
    }
    ensureSvg(activeId, rendered);
    ensureSpec(activeId, rendered);
    ensureCompliance(activeId, rendered, false);
  }, [activeId, rendered, ensureSvg, ensureSpec, ensureCompliance]);

  // ── Sibling head for side-by-side ──
  useEffect(() => {
    if (
      state.platformMode === "side-by-side" &&
      siblingId !== null &&
      siblingHead !== null
    ) {
      ensureSvg(siblingId, siblingHead);
    }
  }, [state.platformMode, siblingId, siblingHead, ensureSvg]);

  // ── Live events: version_created, compliance_completed, generation ──
  useArtifactEvents(socket, {
    onVersionCreated(payload) {
      const current = stateRef.current;
      const currentActive = activeArtifact(current);
      if (currentActive !== null && payload.artifactId === currentActive.id) {
        if (current.detail === null) {
          setDetailNonce((nonce) => nonce + 1);
        } else {
          dispatch({
            type: "version_created",
            artifactId: payload.artifactId,
            version: payload.version,
          });
        }
        const key = keyFor(payload.artifactId, payload.version.number);
        if (key !== null && !caches.current.compliance.has(key)) {
          caches.current.compliance.set(key, { kind: "pending" });
          bump();
        }
      } else {
        // Non-active artifact (possibly brand new): refresh caches; the
        // stage is never hijacked.
        setArtifactsNonce((nonce) => nonce + 1);
      }
    },
    onComplianceCompleted(payload) {
      ensureCompliance(payload.artifactId, payload.version, true);
    },
    onGenerationStarted(summary) {
      dispatch({ type: "generation_started", summary });
    },
    onGenerationSettled() {
      dispatch({ type: "generation_settled" });
    },
    onReconnected() {
      setArtifactsNonce((nonce) => nonce + 1);
      setDetailNonce((nonce) => nonce + 1);
      const current = stateRef.current;
      const currentActive = activeArtifact(current);
      const currentRendered = renderedVersion(current);
      if (currentActive !== null && currentRendered !== null) {
        ensureCompliance(currentActive.id, currentRendered, true);
      }
    },
  });

  // ── Restore-as-new-head (undo semantics — no confirmation, ever) ──
  const restore = useCallback(
    async (version: number): Promise<void> => {
      const workspaceId = workspaceIdRef.current;
      const current = stateRef.current;
      const currentActive = activeArtifact(current);
      if (workspaceId === null || currentActive === null) {
        return;
      }
      const undoTarget = current.detail?.headVersion ?? version;
      dispatch({ type: "restore_started" });
      const result = await api.restoreVersion(
        workspaceId,
        currentActive.id,
        version,
      );
      if (result.ok) {
        dispatch({
          type: "restore_succeeded",
          restoredAs: result.value.number,
          undoTarget,
        });
        // The filmstrip also appends via artifact.version_created; the
        // reducer de-duplicates whichever arrives second.
        dispatch({
          type: "version_created",
          artifactId: currentActive.id,
          version: result.value,
        });
      } else {
        dispatch({ type: "restore_failed", error: result.error });
      }
    },
    [api],
  );

  // ── Viewport over the framed stage ──
  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const sideBySide =
    state.platformMode === "side-by-side" &&
    sibling !== null &&
    siblingHead !== null;
  const contentSize = useMemo(() => {
    if (active === null) {
      return null;
    }
    if (sideBySide) {
      const mobile = PLATFORM_DIMENSIONS.mobile;
      const desktop = PLATFORM_DIMENSIONS.desktop;
      return {
        width: mobile.width + FRAME_GAP + desktop.width,
        height: Math.max(mobile.height, desktop.height) + FRAME_LABEL_HEIGHT,
      };
    }
    const dimensions = PLATFORM_DIMENSIONS[active.platform];
    return {
      width: dimensions.width,
      height: dimensions.height + FRAME_LABEL_HEIGHT,
    };
  }, [active, sideBySide]);

  const memoryKey =
    activeWorkspaceId !== null && activeId !== null
      ? `${activeWorkspaceId}/${activeId}/${state.platformMode}`
      : null;
  const viewport = useViewport({
    containerRef: stageContainerRef,
    contentSize,
    memoryKey,
    memory: viewportMemory.current,
  });

  // ── Inspect + highlight need the live SVG host of the active frame ──
  const [stageHost, setStageHost] = useState<HTMLDivElement | null>(null);

  const specState =
    activeId !== null && rendered !== null
      ? (caches.current.spec.get(keyFor(activeId, rendered) ?? "") ?? null)
      : null;
  const inspectTargets = useMemo((): ReadonlyMap<string, InspectTarget> => {
    if (specState !== null && specState.status === "ready") {
      return buildInspectTargets(specState.value);
    }
    return new Map<string, InspectTarget>();
  }, [specState]);
  const inspectDisabledReason =
    specState !== null && specState.status === "error"
      ? "Component metadata is unavailable for this version."
      : null;

  const resolveNodeIds = useCallback(
    (nodeIds: string[]): string[] => {
      if (stageHost === null) {
        return [];
      }
      return nodeIds.filter((nodeId) => elementById(stageHost, nodeId) !== null);
    },
    [stageHost],
  );

  const highlightRule = useCallback(
    (rule: ComplianceRuleModel, presentNodeIds: string[]): void => {
      if (presentNodeIds.length === 0) {
        return;
      }
      dispatch({
        type: "set_highlight",
        highlight: { ruleId: rule.ruleId, nodeIds: presentNodeIds },
      });
      const firstNodeId = presentNodeIds[0];
      if (stageHost !== null && firstNodeId !== undefined) {
        const element = elementById(stageHost, firstNodeId);
        if (element !== null) {
          viewport.panIntoView(
            contentRectIn(element, stageHost, viewport.zoom),
          );
        }
      }
    },
    [stageHost, viewport],
  );

  const clearHighlight = useCallback((): void => {
    dispatch({ type: "set_highlight", highlight: null });
  }, []);

  // Escape anywhere in the panel clears an active violation highlight.
  const onPanelKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>): void => {
      if (event.key === "Escape" && stateRef.current.highlight !== null) {
        clearHighlight();
        event.preventDefault();
      }
    },
    [clearHighlight],
  );

  // ── Filmstrip wiring ──
  const filmstripEntries = useMemo(
    () =>
      state.detail !== null
        ? buildFilmstrip(state.detail.versions, state.detail.headVersion)
        : [],
    [state.detail],
  );
  const getThumbSvg = useCallback(
    (version: number): string | null => {
      if (activeId === null) {
        return null;
      }
      const cached = caches.current.svg.get(keyFor(activeId, version) ?? "");
      return cached !== undefined && cached.status === "ready"
        ? cached.value
        : null;
    },
    [activeId, keyFor],
  );
  const requestThumbSvg = useCallback(
    (version: number): void => {
      if (activeId !== null) {
        ensureSvg(activeId, version);
      }
    },
    [activeId, ensureSvg],
  );

  // ── Platform mode switching ──
  const selectMode = useCallback(
    (mode: PlatformMode): void => {
      const current = stateRef.current;
      const currentActive = activeArtifact(current);
      if (mode === "side-by-side" || currentActive?.platform === mode) {
        dispatch({ type: "set_platform_mode", mode });
        return;
      }
      const currentSibling = siblingArtifact(current);
      if (currentSibling !== null) {
        dispatch({ type: "select_artifact", artifactId: currentSibling.id });
      }
    },
    [],
  );

  // ── Progressive loading bookkeeping ──
  const renderedKey =
    activeId !== null && rendered !== null
      ? keyFor(activeId, rendered)
      : null;
  const renderedSvg =
    renderedKey !== null ? (caches.current.svg.get(renderedKey) ?? null) : null;
  useEffect(() => {
    if (
      activeId !== null &&
      rendered !== null &&
      renderedSvg !== null &&
      renderedSvg.status === "ready"
    ) {
      lastGood.current.set(activeId, {
        version: rendered,
        svgText: renderedSvg.value,
      });
    }
  }, [activeId, rendered, renderedSvg]);

  // ── Early surfaces: no workspace / loading / list failure / empty ──
  if (activeWorkspaceId === null) {
    return (
      <section className="canvas-panel" data-testid="canvas-panel">
        <div className="canvas-empty">
          <p className="canvas-empty-title">No workspace selected</p>
          <p className="canvas-empty-hint">
            Pick or create a workspace to put an artifact on the canvas.
          </p>
        </div>
      </section>
    );
  }
  if (state.artifactsError !== null) {
    return (
      <section className="canvas-panel" data-testid="canvas-panel">
        <div className="canvas-stage-error" role="alert">
          <p>
            <strong>The artifact list could not be loaded.</strong>
          </p>
          <p>
            {state.artifactsError.message} {state.artifactsError.fix}
          </p>
          <button
            type="button"
            onClick={() => setArtifactsNonce((nonce) => nonce + 1)}
          >
            Retry
          </button>
        </div>
      </section>
    );
  }
  if (state.artifacts === null) {
    return (
      <section className="canvas-panel" data-testid="canvas-panel">
        <p className="canvas-loading" role="status">
          Loading artifacts…
        </p>
      </section>
    );
  }
  if (active === null || state.artifacts.length === 0) {
    return (
      <section className="canvas-panel" data-testid="canvas-panel">
        <EmptyState />
      </section>
    );
  }

  // ── Frames ──
  interface FrameSpec {
    artifactId: string;
    platform: Platform;
    version: number;
    isActive: boolean;
  }
  const frames: FrameSpec[] = [];
  if (rendered !== null) {
    frames.push({
      artifactId: active.id,
      platform: active.platform,
      version: rendered,
      isActive: true,
    });
  }
  if (sideBySide && sibling !== null && siblingHead !== null) {
    frames.push({
      artifactId: sibling.id,
      platform: sibling.platform,
      version: siblingHead,
      isActive: false,
    });
    frames.sort((a, b) => (a.platform === "mobile" ? -1 : b.platform === "mobile" ? 1 : 0));
  }

  const renderFrameBody = (frame: FrameSpec): ReactElement => {
    const frameKey = keyFor(frame.artifactId, frame.version);
    const loadable =
      frameKey !== null ? (caches.current.svg.get(frameKey) ?? null) : null;
    const dimensions = PLATFORM_DIMENSIONS[frame.platform];
    const previous = frame.isActive
      ? (lastGood.current.get(frame.artifactId) ?? null)
      : null;

    if (loadable !== null && loadable.status === "ready") {
      return (
        <>
          <SvgStage
            svgText={loadable.value}
            versionNumber={frame.version}
            width={dimensions.width}
            height={dimensions.height}
            onHostChange={frame.isActive ? setStageHost : undefined}
          />
          {frame.isActive && state.inspectEnabled ? (
            <InspectOverlay
              stageHost={stageHost}
              targets={inspectTargets}
              zoom={viewport.zoom}
            />
          ) : null}
          {frame.isActive && state.highlight !== null && stageHost !== null ? (
            <div className="canvas-highlight-layer" data-testid="highlight-layer">
              {state.highlight.nodeIds.map((nodeId) => {
                const element = elementById(stageHost, nodeId);
                if (element === null) {
                  return null;
                }
                const rect = contentRectIn(element, stageHost, viewport.zoom);
                return (
                  <div
                    key={nodeId}
                    className="canvas-highlight-outline"
                    data-testid={`highlight-${nodeId}`}
                    style={{
                      left: rect.x,
                      top: rect.y,
                      width: rect.width,
                      height: rect.height,
                    }}
                  />
                );
              })}
            </div>
          ) : null}
        </>
      );
    }

    if (loadable !== null && loadable.status === "error") {
      return (
        <div className="canvas-stage-error" role="alert">
          <p>
            <strong>Version {frame.version} could not be loaded.</strong>
          </p>
          <p>
            {loadable.error.message} {loadable.error.fix}
          </p>
          <button
            type="button"
            onClick={() => ensureSvg(frame.artifactId, frame.version)}
          >
            Retry
          </button>
          {previous !== null ? (
            <p className="canvas-stage-error-note">
              Showing v{previous.version} until this resolves.
            </p>
          ) : null}
        </div>
      );
    }

    // Loading: keep the previous version visible (progressive, non-blocking).
    if (previous !== null) {
      return (
        <>
          <SvgStage
            svgText={previous.svgText}
            versionNumber={previous.version}
            width={dimensions.width}
            height={dimensions.height}
            onHostChange={frame.isActive ? setStageHost : undefined}
          />
          <p className="canvas-stage-loading" role="status">
            Loading v{frame.version}…
          </p>
        </>
      );
    }
    return (
      <p className="canvas-stage-loading" role="status">
        Loading v{frame.version}…
      </p>
    );
  };

  const modeDisabledReason = (mode: PlatformMode): string | null => {
    if (mode === active.platform) {
      return null;
    }
    if (sibling !== null) {
      return null;
    }
    const missing = mode === "side-by-side" ? (active.platform === "mobile" ? "desktop" : "mobile") : mode;
    return `No ${missing} variant of this artifact exists yet — generate one from chat.`;
  };

  const complianceState =
    renderedKey !== null
      ? (caches.current.compliance.get(renderedKey) ?? null)
      : null;

  return (
    <section
      className="canvas-panel"
      data-testid="canvas-panel"
      onKeyDown={onPanelKeyDown}
    >
      <div className="canvas-toolbar">
        {state.artifacts.length > 1 ? (
          <select
            className="canvas-artifact-picker"
            aria-label="Artifact"
            value={active.id}
            onChange={(event) =>
              dispatch({ type: "select_artifact", artifactId: event.target.value })
            }
          >
            {state.artifacts.map((artifact) => (
              <option key={artifact.id} value={artifact.id}>
                {artifact.name} ({artifact.platform})
              </option>
            ))}
          </select>
        ) : (
          <span className="canvas-artifact-name">{active.name}</span>
        )}
        <div
          className="canvas-mode-switcher"
          role="group"
          aria-label="Platform mode"
        >
          {(["mobile", "desktop", "side-by-side"] as const).map((mode) => {
            const reason = modeDisabledReason(mode);
            const pressed =
              mode === "side-by-side"
                ? state.platformMode === "side-by-side"
                : state.platformMode === mode;
            return (
              <button
                key={mode}
                type="button"
                className="canvas-mode-button"
                aria-pressed={pressed}
                disabled={reason !== null}
                title={reason ?? `Show the ${mode} view`}
                onClick={() => selectMode(mode)}
              >
                {mode}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="canvas-inspect-toggle"
          aria-pressed={state.inspectEnabled}
          disabled={inspectDisabledReason !== null}
          title={
            inspectDisabledReason ??
            "Inspect components on hover (overlay; the artifact is never modified)"
          }
          onClick={() =>
            dispatch({ type: "set_inspect", enabled: !state.inspectEnabled })
          }
        >
          Inspect
        </button>
        <span className="canvas-toolbar-spacer" />
        <div className="canvas-zoom-controls" role="group" aria-label="Zoom">
          <button type="button" onClick={viewport.zoomOut} aria-label="Zoom out">
            −
          </button>
          <button
            type="button"
            className="canvas-zoom-level"
            data-testid="zoom-level"
            title="Reset to fit"
            onClick={viewport.zoomToFit}
          >
            {Math.round(viewport.zoom * 100)}%
          </button>
          <button type="button" onClick={viewport.zoomIn} aria-label="Zoom in">
            +
          </button>
          <button type="button" onClick={viewport.zoomActual} title="Actual size (100%)">
            1:1
          </button>
        </div>
      </div>

      {state.detailError !== null ? (
        <div className="canvas-stage-error" role="alert">
          <p>
            <strong>The version history could not be loaded.</strong>
          </p>
          <p>
            {state.detailError.message} {state.detailError.fix}
          </p>
          <button type="button" onClick={() => setDetailNonce((nonce) => nonce + 1)}>
            Retry
          </button>
        </div>
      ) : null}

      <div
        className="canvas-stage"
        data-testid="canvas-stage"
        ref={stageContainerRef}
        tabIndex={0}
        role="region"
        aria-label={
          rendered !== null
            ? `Artifact stage — ${active.name} v${rendered}. Use plus and minus to zoom, 0 to fit, 1 for actual size, arrows to pan.`
            : `Artifact stage — ${active.name}`
        }
        onKeyDown={(event) => {
          viewport.handleKeyDown(event);
        }}
        onPointerDown={viewport.handlePointerDown}
        onPointerMove={viewport.handlePointerMove}
        onPointerUp={viewport.handlePointerUp}
        onPointerCancel={viewport.handlePointerUp}
      >
        <div
          className="canvas-stage-content"
          data-animate={!reducedMotion && !viewport.dragging ? "true" : "false"}
          style={viewport.contentStyle}
        >
          {rendered === null && state.detail !== null ? (
            <EmptyState />
          ) : (
            frames.map((frame) => (
              <DeviceFrame key={frame.artifactId} platform={frame.platform}>
                {renderFrameBody(frame)}
              </DeviceFrame>
            ))
          )}
        </div>
        {state.generation.inProgress ? (
          <p className="canvas-generation" role="status" data-testid="generation-status">
            Generating — {state.generation.summary ?? "working"}…
          </p>
        ) : null}
        {state.scrubVersion !== null ? (
          <p className="canvas-scrub-indicator" role="status">
            Previewing v{state.scrubVersion} — head is v
            {state.detail?.headVersion ?? "?"}
          </p>
        ) : null}
      </div>

      {state.detail !== null && filmstripEntries.length > 0 ? (
        <HistoryFilmstrip
          entries={filmstripEntries}
          headVersion={state.detail.headVersion}
          scrubVersion={state.scrubVersion}
          restorePending={state.restorePending}
          restoreError={state.restoreError}
          undo={state.undo}
          onScrub={(version) => dispatch({ type: "scrub", version })}
          onRestore={(version) => void restore(version)}
          getSvg={getThumbSvg}
          requestSvg={requestThumbSvg}
        />
      ) : null}

      <ComplianceBar
        version={rendered}
        state={complianceState}
        highlightedRuleId={state.highlight?.ruleId ?? null}
        resolveNodeIds={resolveNodeIds}
        onHighlight={highlightRule}
        onClearHighlight={clearHighlight}
        onRetry={() => {
          if (activeId !== null && rendered !== null) {
            ensureCompliance(activeId, rendered, true);
          }
        }}
      />
    </section>
  );
}
