/**
 * InspectOverlay — devtools-style component inspection over the rendered
 * artifact. Hovering an SVG group with a stable {region}__{component}_{idx}
 * id (or any descendant) outlines it non-destructively and shows a popover
 * with the component identity resolved from spec metadata; unmapped nodes
 * fall back to the node id with a "no component metadata" note.
 *
 * Keyboard parity: the focusable cycle handle steps through inspectable
 * nodes with Tab/Shift+Tab and the arrow keys — same outline, same popover
 * — and exposes the popover content to screen readers via aria-describedby.
 * The artifact SVG is never mutated; outline and popover live in a sibling
 * layer positioned in content coordinates (they scale with the viewport
 * transform automatically).
 */
import {
  useCallback,
  useEffect,
  useId,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
} from "react";

import {
  nextInCycle,
  resolveTarget,
  unmappedTarget,
  type InspectTarget,
} from "./inspect.js";

export interface InspectOverlayProps {
  /** The frame-content element hosting the inline artifact SVG. */
  stageHost: HTMLElement | null;
  /** nodeId → metadata, built once per version from the spec endpoint. */
  targets: ReadonlyMap<string, InspectTarget>;
  /** Current viewport zoom (content-coordinate conversion). */
  zoom: number;
}

interface ContentRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** CSS.escape with a conservative fallback (jsdom lacks the CSS global). */
function cssEscape(value: string): string {
  const cssGlobal = (
    globalThis as { CSS?: { escape?: (value: string) => string } }
  ).CSS;
  if (cssGlobal?.escape !== undefined) {
    return cssGlobal.escape(value);
  }
  return value.replace(/["\\\]]/g, "\\$&");
}

/** Locate a stable-id node inside the rendered artifact host. */
export function elementById(host: HTMLElement, nodeId: string): Element | null {
  return host.querySelector(`[id="${cssEscape(nodeId)}"]`);
}

/**
 * An element's rect in CONTENT coordinates (the frame's unzoomed space) —
 * overlays positioned with it scale with the viewport transform for free.
 */
export function contentRectIn(
  element: Element,
  host: HTMLElement,
  zoom: number,
): ContentRect {
  const elementBox = element.getBoundingClientRect();
  const hostBox = host.getBoundingClientRect();
  const safeZoom = zoom > 0 ? zoom : 1;
  return {
    x: (elementBox.left - hostBox.left) / safeZoom,
    y: (elementBox.top - hostBox.top) / safeZoom,
    width: elementBox.width / safeZoom,
    height: elementBox.height / safeZoom,
  };
}

/** Edge-aware popover placement: flip above / shift left inside the host. */
function popoverPosition(
  rect: ContentRect,
  host: HTMLElement,
  zoom: number,
): { left: number; top: number } {
  const safeZoom = zoom > 0 ? zoom : 1;
  const hostWidth = host.getBoundingClientRect().width / safeZoom;
  const popoverWidth = 260;
  const popoverHeight = 96;
  let left = rect.x;
  let top = rect.y + rect.height + 8;
  if (hostWidth > 0 && left + popoverWidth > hostWidth) {
    left = Math.max(0, hostWidth - popoverWidth);
  }
  if (rect.y + rect.height + popoverHeight > (host.getBoundingClientRect().height / safeZoom) && rect.y - popoverHeight - 8 >= 0) {
    top = rect.y - popoverHeight - 8;
  }
  return { left, top };
}

export function InspectOverlay(props: InspectOverlayProps): ReactElement {
  const { stageHost, targets, zoom } = props;
  const popoverId = useId();
  const [active, setActive] = useState<InspectTarget | null>(null);

  // Hover hit-testing on the host itself — the overlay never intercepts
  // pointer events, so plain viewing keeps working underneath.
  useEffect(() => {
    if (stageHost === null) {
      return;
    }
    const onPointerMove = (event: PointerEvent): void => {
      const target = resolveTarget(
        event.target instanceof Element ? event.target : null,
        stageHost,
        targets,
      );
      setActive(target);
    };
    const onPointerLeave = (): void => {
      setActive(null);
    };
    stageHost.addEventListener("pointermove", onPointerMove);
    stageHost.addEventListener("pointerleave", onPointerLeave);
    return () => {
      stageHost.removeEventListener("pointermove", onPointerMove);
      stageHost.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [stageHost, targets]);

  const cycle = useCallback(
    (direction: 1 | -1): void => {
      setActive((current) => {
        const nextId = nextInCycle(targets, current?.nodeId ?? null, direction);
        if (nextId === null) {
          return current;
        }
        return targets.get(nextId) ?? unmappedTarget(nextId);
      });
    },
    [targets],
  );

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>): void => {
      switch (event.key) {
        case "Tab":
        case "ArrowRight":
        case "ArrowDown":
          if (event.key === "Tab" && event.shiftKey) {
            cycle(-1);
          } else {
            cycle(1);
          }
          break;
        case "ArrowLeft":
        case "ArrowUp":
          cycle(-1);
          break;
        case "Escape":
          setActive(null);
          break;
        default:
          return;
      }
      event.preventDefault();
      event.stopPropagation();
    },
    [cycle],
  );

  const activeElement =
    active !== null && stageHost !== null
      ? elementById(stageHost, active.nodeId)
      : null;
  const rect =
    activeElement !== null && stageHost !== null
      ? contentRectIn(activeElement, stageHost, zoom)
      : null;
  const popoverAt =
    rect !== null && stageHost !== null
      ? popoverPosition(rect, stageHost, zoom)
      : null;

  return (
    <div className="canvas-inspect-layer" data-testid="inspect-layer">
      <div
        tabIndex={0}
        role="group"
        aria-label="Inspect artifact components (arrow keys cycle, Escape clears)"
        aria-describedby={active !== null ? popoverId : undefined}
        className="canvas-inspect-cycle"
        data-testid="inspect-cycle"
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
      />
      {active !== null && rect !== null ? (
        <div
          className="canvas-inspect-outline"
          data-testid="inspect-outline"
          data-node-id={active.nodeId}
          style={{
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
          }}
        />
      ) : null}
      {active !== null ? (
        <div
          id={popoverId}
          className="canvas-inspect-popover"
          data-testid="inspect-popover"
          role="status"
          style={popoverAt !== null ? { left: popoverAt.left, top: popoverAt.top } : undefined}
        >
          {active.componentId !== null ? (
            <>
              <p className="canvas-inspect-component">
                <strong>{active.componentId}</strong>
                {active.variant !== null ? (
                  <span className="canvas-inspect-variant"> · {active.variant}</span>
                ) : null}
              </p>
              <p className="canvas-inspect-meta">
                {active.region !== null ? `region ${active.region}` : null}
                {active.componentType !== null
                  ? ` · ${active.componentType} component`
                  : null}
                {active.position !== null
                  ? ` · at ${active.position.x},${active.position.y}`
                  : null}
              </p>
              <p className="canvas-inspect-node">{active.nodeId}</p>
            </>
          ) : (
            <>
              <p className="canvas-inspect-component">
                <strong>{active.nodeId}</strong>
              </p>
              <p className="canvas-inspect-meta">no component metadata</p>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
