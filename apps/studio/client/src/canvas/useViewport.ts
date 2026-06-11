/**
 * Viewport — zoom/pan over the framed stage as a single CSS transform
 * (artifact nodes never re-render per frame). Fit-to-frame is the default
 * on load, mode change, and panel resize; zoom clamps to 10%–400%; pan is
 * bounded so the artifact can never be lost off-screen.
 *
 * Input parity: wheel/pinch (ctrl/meta+wheel) zoom, plain wheel and drag
 * pan, and full keyboard control (+/- zoom, 0 fit, 1 actual size, arrows
 * pan). The wheel listener is attached natively (non-passive) because
 * React's delegated wheel events cannot preventDefault.
 *
 * Per-artifact viewport memory lives in the caller-owned Map (session
 * scope); reduced-motion is honored by the caller's CSS (transform
 * transitions collapse under prefers-reduced-motion).
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 4;
const ZOOM_STEP = 1.25;
const PAN_STEP = 48;
/** Pan bound: at least this much of the artifact stays in view. */
const EDGE_MARGIN = 40;
const FIT_PADDING = 32;

export interface ViewportSnapshot {
  zoom: number;
  pan: { x: number; y: number };
  fitToFrame: boolean;
}

export interface Viewport {
  zoom: number;
  pan: { x: number; y: number };
  fitToFrame: boolean;
  /** Transform for the stage content wrapper. */
  contentStyle: CSSProperties;
  /** True while a pointer drag is panning (disables transitions). */
  dragging: boolean;
  zoomIn(): void;
  zoomOut(): void;
  zoomToFit(): void;
  zoomActual(): void;
  panBy(dx: number, dy: number): void;
  /** Pan so the given content-space rect is centered in the viewport. */
  panIntoView(rect: { x: number; y: number; width: number; height: number }): void;
  /** Keyboard controls: +/- zoom, 0 fit, 1 actual size, arrows pan. */
  handleKeyDown(event: ReactKeyboardEvent): boolean;
  handlePointerDown(event: ReactPointerEvent<HTMLElement>): void;
  handlePointerMove(event: ReactPointerEvent<HTMLElement>): void;
  handlePointerUp(event: ReactPointerEvent<HTMLElement>): void;
}

export interface ViewportOptions {
  containerRef: RefObject<HTMLElement | null>;
  /** Natural (unzoomed) size of the framed content; null until known. */
  contentSize: { width: number; height: number } | null;
  /** Session memory key (artifact id + platform mode); null → no memory. */
  memoryKey: string | null;
  memory: Map<string, ViewportSnapshot>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampRange(value: number, min: number, max: number): number {
  if (min > max) {
    return (min + max) / 2;
  }
  return clamp(value, min, max);
}

export function clampZoom(zoom: number): number {
  return clamp(zoom, ZOOM_MIN, ZOOM_MAX);
}

interface InternalState {
  zoom: number;
  pan: { x: number; y: number };
  fitToFrame: boolean;
}

export function useViewport(options: ViewportOptions): Viewport {
  const { containerRef, contentSize, memoryKey, memory } = options;
  const [state, setState] = useState<InternalState>(() => {
    const remembered = memoryKey === null ? undefined : memory.get(memoryKey);
    return remembered ?? { zoom: 1, pan: { x: 0, y: 0 }, fitToFrame: true };
  });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ pointerId: number; lastX: number; lastY: number } | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const containerSize = useCallback((): { width: number; height: number } => {
    const element = containerRef.current;
    if (element === null) {
      return { width: 0, height: 0 };
    }
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }, [containerRef]);

  const boundPan = useCallback(
    (pan: { x: number; y: number }, zoom: number): { x: number; y: number } => {
      if (contentSize === null) {
        return pan;
      }
      const container = containerSize();
      const scaledWidth = contentSize.width * zoom;
      const scaledHeight = contentSize.height * zoom;
      return {
        x: clampRange(
          pan.x,
          EDGE_MARGIN - scaledWidth,
          Math.max(container.width - EDGE_MARGIN, EDGE_MARGIN - scaledWidth),
        ),
        y: clampRange(
          pan.y,
          EDGE_MARGIN - scaledHeight,
          Math.max(container.height - EDGE_MARGIN, EDGE_MARGIN - scaledHeight),
        ),
      };
    },
    [contentSize, containerSize],
  );

  const fitSnapshot = useCallback((): InternalState => {
    const container = containerSize();
    if (
      contentSize === null ||
      contentSize.width <= 0 ||
      contentSize.height <= 0 ||
      container.width <= 0 ||
      container.height <= 0
    ) {
      return { zoom: 1, pan: { x: 0, y: 0 }, fitToFrame: true };
    }
    const zoom = clampZoom(
      Math.min(
        (container.width - FIT_PADDING * 2) / contentSize.width,
        (container.height - FIT_PADDING * 2) / contentSize.height,
      ),
    );
    return {
      zoom,
      pan: {
        x: (container.width - contentSize.width * zoom) / 2,
        y: (container.height - contentSize.height * zoom) / 2,
      },
      fitToFrame: true,
    };
  }, [contentSize, containerSize]);

  // Remember the viewport per artifact within the session.
  useEffect(() => {
    if (memoryKey !== null) {
      memory.set(memoryKey, { ...state, pan: { ...state.pan } });
    }
  }, [state, memoryKey, memory]);

  // Restore memory (or refit) when the subject changes.
  useEffect(() => {
    const remembered = memoryKey === null ? undefined : memory.get(memoryKey);
    if (remembered !== undefined && !remembered.fitToFrame) {
      setState({ ...remembered, pan: { ...remembered.pan } });
    } else {
      setState(fitSnapshot());
    }
    // fitSnapshot changes identity with contentSize — exactly the refit
    // trigger fit-to-frame wants (load and mode change).
  }, [memoryKey, memory, fitSnapshot]);

  // Panel resize: refit while fitToFrame; re-bound the pan otherwise.
  useEffect(() => {
    const element = containerRef.current;
    if (element === null || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => {
      setState((current) =>
        current.fitToFrame
          ? fitSnapshot()
          : { ...current, pan: boundPan(current.pan, current.zoom) },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [containerRef, fitSnapshot, boundPan]);

  const applyZoom = useCallback(
    (factor: number, originParam?: { x: number; y: number }): void => {
      setState((current) => {
        const zoom = clampZoom(current.zoom * factor);
        if (zoom === current.zoom) {
          return current;
        }
        const container = containerSize();
        const origin = originParam ?? {
          x: container.width / 2,
          y: container.height / 2,
        };
        const ratio = zoom / current.zoom;
        const pan = {
          x: origin.x - (origin.x - current.pan.x) * ratio,
          y: origin.y - (origin.y - current.pan.y) * ratio,
        };
        return { zoom, pan: boundPan(pan, zoom), fitToFrame: false };
      });
    },
    [containerSize, boundPan],
  );

  const panBy = useCallback(
    (dx: number, dy: number): void => {
      setState((current) => ({
        ...current,
        fitToFrame: false,
        pan: boundPan(
          { x: current.pan.x + dx, y: current.pan.y + dy },
          current.zoom,
        ),
      }));
    },
    [boundPan],
  );

  const zoomToFit = useCallback((): void => {
    setState(fitSnapshot());
  }, [fitSnapshot]);

  const zoomActual = useCallback((): void => {
    setState((current) => ({
      zoom: 1,
      pan: boundPan(current.pan, 1),
      fitToFrame: false,
    }));
  }, [boundPan]);

  const panIntoView = useCallback(
    (rect: { x: number; y: number; width: number; height: number }): void => {
      setState((current) => {
        const container = containerSize();
        const centerX = (rect.x + rect.width / 2) * current.zoom;
        const centerY = (rect.y + rect.height / 2) * current.zoom;
        const pan = {
          x: container.width / 2 - centerX,
          y: container.height / 2 - centerY,
        };
        return {
          ...current,
          fitToFrame: false,
          pan: boundPan(pan, current.zoom),
        };
      });
    },
    [containerSize, boundPan],
  );

  // Native non-passive wheel: ctrl/meta+wheel (and trackpad pinch, which
  // browsers deliver as ctrl+wheel) zooms at the cursor; plain wheel pans.
  useEffect(() => {
    const element = containerRef.current;
    if (element === null) {
      return;
    }
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const rect = element.getBoundingClientRect();
        applyZoom(Math.exp(-event.deltaY * 0.01), {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        });
      } else {
        panBy(-event.deltaX, -event.deltaY);
      }
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [containerRef, applyZoom, panBy]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent): boolean => {
      switch (event.key) {
        case "+":
        case "=":
          applyZoom(ZOOM_STEP);
          break;
        case "-":
        case "_":
          applyZoom(1 / ZOOM_STEP);
          break;
        case "0":
          zoomToFit();
          break;
        case "1":
          zoomActual();
          break;
        case "ArrowUp":
          panBy(0, PAN_STEP);
          break;
        case "ArrowDown":
          panBy(0, -PAN_STEP);
          break;
        case "ArrowLeft":
          panBy(PAN_STEP, 0);
          break;
        case "ArrowRight":
          panBy(-PAN_STEP, 0);
          break;
        default:
          return false;
      }
      event.preventDefault();
      return true;
    },
    [applyZoom, zoomToFit, zoomActual, panBy],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => {
      if (event.button !== 0) {
        return;
      }
      const target = event.target as HTMLElement;
      if (target.closest("button, a, [data-no-pan]") !== null) {
        return;
      }
      dragRef.current = {
        pointerId: event.pointerId,
        lastX: event.clientX,
        lastY: event.clientY,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => {
      const drag = dragRef.current;
      if (drag === null || drag.pointerId !== event.pointerId) {
        return;
      }
      const dx = event.clientX - drag.lastX;
      const dy = event.clientY - drag.lastY;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      panBy(dx, dy);
    },
    [panBy],
  );

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => {
      const drag = dragRef.current;
      if (drag === null || drag.pointerId !== event.pointerId) {
        return;
      }
      dragRef.current = null;
      setDragging(false);
    },
    [],
  );

  return {
    zoom: state.zoom,
    pan: state.pan,
    fitToFrame: state.fitToFrame,
    dragging,
    contentStyle: {
      transform: `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom})`,
      transformOrigin: "0 0",
    },
    zoomIn: () => applyZoom(ZOOM_STEP),
    zoomOut: () => applyZoom(1 / ZOOM_STEP),
    zoomToFit,
    zoomActual,
    panBy,
    panIntoView,
    handleKeyDown,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
