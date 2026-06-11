/**
 * Canvas capability — the always-center stage of the docking shell.
 * Named exports only; CanvasPanel is what the shell's center slot mounts
 * (src/app/CenterStage.tsx).
 */
export { CanvasPanel, type CanvasPanelProps } from "./CanvasPanel.jsx";
export { createCanvasApi, parseSpecResponse, type CanvasApi, type CanvasApiOptions, type CanvasResult, type ComplianceFetchResult } from "./api.js";
export { SvgStage, type SvgStageProps } from "./SvgStage.jsx";
export { DeviceFrame, type DeviceFrameProps } from "./DeviceFrame.jsx";
export { EmptyState } from "./EmptyState.jsx";
export { InspectOverlay, contentRectIn, elementById, type InspectOverlayProps } from "./InspectOverlay.jsx";
export { HistoryFilmstrip, type HistoryFilmstripProps } from "./HistoryFilmstrip.jsx";
export { ComplianceBar, type ComplianceBarProps } from "./ComplianceBar.jsx";
export {
  activeArtifact,
  canvasReducer,
  initialCanvasState,
  PLATFORM_DIMENSIONS,
  renderedVersion,
  siblingArtifact,
  type CanvasAction,
  type CanvasState,
  type HighlightState,
  type PlatformMode,
  type UndoState,
} from "./state.js";
export { buildFilmstrip, excerptBrief, scrubMoveTarget, type FilmstripEntry, type ScrubMove } from "./filmstrip.js";
export {
  statusGlyph,
  statusLabel,
  toComplianceBarModel,
  type ComplianceBarModel,
  type ComplianceBarState,
  type ComplianceRuleModel,
} from "./compliance.js";
export {
  buildInspectTargets,
  cycleOrder,
  nextInCycle,
  nodeIdFor,
  resolveTarget,
  unmappedTarget,
  type InspectTarget,
} from "./inspect.js";
export { applyIdPrefix, parseArtifactSvg, type SvgParseResult } from "./svgContent.js";
export { useViewport, clampZoom, ZOOM_MAX, ZOOM_MIN, type Viewport, type ViewportOptions, type ViewportSnapshot } from "./useViewport.js";
export { useArtifactEvents, type ArtifactEventHandlers } from "./useArtifactEvents.js";
