/**
 * Pointer-driven panel drag — no drag library. Pure geometry (zone
 * collection, hit-testing, indicator placement) is separated from the
 * stateful pointer tracking so the logic is unit-testable; the pointer
 * tracker only wires window listeners and applies a small start threshold.
 *
 * Escape cancels with no state change; releasing the pointer outside any
 * drop target also cancels (spec: error_handling).
 */
import { isRailSide, type RailSide } from "./types.js";

export interface Point {
  x: number;
  y: number;
}

export interface RectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** One rail's drop geometry: its bounds and the stack slot boundaries. */
export interface RailZone {
  rail: RailSide;
  rect: RectLike;
  /**
   * Y midpoints of the expanded panel headers on the rail, in stack
   * order. The insertion index is the count of midpoints above the
   * pointer — 0 inserts at the top, length appends at the bottom.
   */
  headerMidYs: number[];
}

export interface DropTarget {
  rail: RailSide;
  index: number;
}

/** Horizontal slack so near-misses next to a rail still register. */
const RAIL_SLACK_PX = 24;

export function resolveDropTarget(
  point: Point,
  zones: readonly RailZone[],
): DropTarget | null {
  for (const zone of zones) {
    const { rect } = zone;
    const within =
      point.x >= rect.left - RAIL_SLACK_PX &&
      point.x <= rect.right + RAIL_SLACK_PX &&
      point.y >= rect.top &&
      point.y <= rect.bottom;
    if (!within) {
      continue;
    }
    const index = zone.headerMidYs.filter((midY) => point.y > midY).length;
    return { rail: zone.rail, index };
  }
  return null;
}

/** Fixed-position rect for the drop indicator at a target slot. */
export function indicatorRect(
  target: DropTarget,
  zones: readonly RailZone[],
): RectLike | null {
  const zone = zones.find((candidate) => candidate.rail === target.rail);
  if (zone === undefined) {
    return null;
  }
  const { rect } = zone;
  if (zone.headerMidYs.length === 0) {
    // Empty rail: highlight the whole rail strip.
    return { ...rect };
  }
  const ys = [rect.top, ...zone.headerMidYs, rect.bottom];
  const boundedIndex = Math.max(0, Math.min(target.index, ys.length - 2));
  // Indicator line sits at the boundary the panel would be inserted at.
  const y =
    target.index >= zone.headerMidYs.length
      ? rect.bottom - 2
      : (ys[boundedIndex] ?? rect.top);
  return {
    left: rect.left,
    top: y,
    right: rect.right,
    bottom: y + 3,
    width: rect.width,
    height: 3,
  };
}

/** Collect live drop geometry from the rendered shell DOM. */
export function collectRailZones(root: ParentNode): RailZone[] {
  const zones: RailZone[] = [];
  const rails = root.querySelectorAll<HTMLElement>("[data-rail]");
  for (const railEl of rails) {
    const rail = railEl.dataset["rail"];
    if (!isRailSide(rail)) {
      continue;
    }
    const rect = railEl.getBoundingClientRect();
    const headers = railEl.querySelectorAll<HTMLElement>(
      "[data-panel-header]",
    );
    const headerMidYs = [...headers].map((header) => {
      const headerRect = header.getBoundingClientRect();
      return headerRect.top + headerRect.height / 2;
    });
    zones.push({ rail, rect, headerMidYs });
  }
  return zones;
}

// ── Stateful pointer tracking ──

export interface DragSessionCallbacks {
  /** Fired when the pointer travels past the start threshold. */
  onStart(): void;
  /** Current target (null over no rail) and ghost position, every move. */
  onUpdate(target: DropTarget | null, point: Point): void;
  /** Pointer released over a valid target. */
  onDrop(target: DropTarget): void;
  /** Escape, pointer release outside any target, or pointercancel. */
  onCancel(): void;
}

export interface DragSessionOptions {
  /** px of travel before a press becomes a drag (clicks stay clicks). */
  thresholdPx?: number;
  /** Injected for tests; defaults to live DOM geometry. */
  zones?: () => readonly RailZone[];
  /** Event target for window-level listeners (injected in tests). */
  listenerTarget?: Pick<Window, "addEventListener" | "removeEventListener">;
}

/**
 * Begin tracking a potential drag from a pointerdown on a panel header.
 * Returns a dispose function (used on unmount mid-drag).
 */
export function trackHeaderDrag(
  downEvent: { clientX: number; clientY: number },
  callbacks: DragSessionCallbacks,
  options: DragSessionOptions = {},
): () => void {
  const threshold = options.thresholdPx ?? 4;
  const zones = options.zones ?? (() => collectRailZones(document));
  const target = options.listenerTarget ?? window;
  const origin: Point = { x: downEvent.clientX, y: downEvent.clientY };
  let started = false;
  let lastTarget: DropTarget | null = null;
  let disposed = false;

  function dispose(): void {
    if (disposed) {
      return;
    }
    disposed = true;
    target.removeEventListener("pointermove", onPointerMove);
    target.removeEventListener("pointerup", onPointerUp);
    target.removeEventListener("pointercancel", onPointerCancel);
    target.removeEventListener("keydown", onKeyDown, true);
  }

  function onPointerMove(event: Event): void {
    const move = event as PointerEvent;
    const point: Point = { x: move.clientX, y: move.clientY };
    if (!started) {
      const travelled =
        Math.abs(point.x - origin.x) + Math.abs(point.y - origin.y);
      if (travelled < threshold) {
        return;
      }
      started = true;
      callbacks.onStart();
    }
    lastTarget = resolveDropTarget(point, zones());
    callbacks.onUpdate(lastTarget, point);
  }

  function onPointerUp(): void {
    dispose();
    if (!started) {
      return;
    }
    if (lastTarget !== null) {
      callbacks.onDrop(lastTarget);
    } else {
      callbacks.onCancel();
    }
  }

  function onPointerCancel(): void {
    dispose();
    if (started) {
      callbacks.onCancel();
    }
  }

  function onKeyDown(event: Event): void {
    if ((event as KeyboardEvent).key === "Escape") {
      dispose();
      if (started) {
        callbacks.onCancel();
      }
    }
  }

  target.addEventListener("pointermove", onPointerMove);
  target.addEventListener("pointerup", onPointerUp);
  target.addEventListener("pointercancel", onPointerCancel);
  target.addEventListener("keydown", onKeyDown, true);

  return dispose;
}
