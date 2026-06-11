/**
 * Drag layer — owns the live drag session state (ghost position, current
 * drop target, indicator rect) and translates a completed drop into a
 * dock "move". Provided by ShellFrame; PanelHost headers call
 * beginHeaderDrag from their pointerdown.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

import { useDock } from "./DockContext.jsx";
import {
  collectRailZones,
  indicatorRect,
  trackHeaderDrag,
  type DropTarget,
  type Point,
  type RectLike,
} from "./dragController.js";
import { DropIndicator } from "./DropIndicator.jsx";
import { useReducedMotion } from "./useReducedMotion.js";

export interface DragContextValue {
  /** Begin a potential drag from a panel header pointerdown. */
  beginHeaderDrag(
    panelId: string,
    title: string,
    event: { clientX: number; clientY: number },
  ): void;
  /** The panel currently being dragged, for header styling. */
  draggingPanelId: string | null;
}

const DragContext = createContext<DragContextValue | null>(null);

export function useDrag(): DragContextValue {
  const value = useContext(DragContext);
  if (value === null) {
    throw new Error("useDrag must be used inside the ShellFrame drag layer.");
  }
  return value;
}

interface DragVisual {
  panelId: string;
  title: string;
  point: Point;
  indicator: RectLike | null;
}

export function DragLayerProvider(props: { children: ReactNode }): ReactElement {
  const { state, dispatch, requestFocus } = useDock();
  const reducedMotion = useReducedMotion();
  const [visual, setVisual] = useState<DragVisual | null>(null);
  const disposeRef = useRef<(() => void) | null>(null);
  // The dock state at drag time, read inside stable callbacks.
  const stateRef = useRef(state);
  stateRef.current = state;

  const beginHeaderDrag = useCallback(
    (
      panelId: string,
      title: string,
      event: { clientX: number; clientY: number },
    ) => {
      disposeRef.current?.();
      disposeRef.current = trackHeaderDrag(event, {
        onStart(): void {
          setVisual({
            panelId,
            title,
            point: { x: event.clientX, y: event.clientY },
            indicator: null,
          });
        },
        onUpdate(target: DropTarget | null, point: Point): void {
          const zones = collectRailZones(document);
          setVisual({
            panelId,
            title,
            point,
            indicator: target === null ? null : indicatorRect(target, zones),
          });
        },
        onDrop(target: DropTarget): void {
          setVisual(null);
          disposeRef.current = null;
          const placement = stateRef.current.placements.find(
            (entry) => entry.panelId === panelId,
          );
          if (placement === undefined) {
            return;
          }
          let order = target.index;
          if (
            placement.rail === target.rail &&
            !placement.collapsed &&
            target.index > placement.order
          ) {
            // The dragged panel's own header was counted above the pointer.
            order -= 1;
          }
          dispatch({ type: "move", panelId, rail: target.rail, order });
          requestFocus(panelId, "header");
        },
        onCancel(): void {
          // Escape or release outside any target: origin placement intact.
          setVisual(null);
          disposeRef.current = null;
        },
      });
    },
    [dispatch, requestFocus],
  );

  const value = useMemo<DragContextValue>(
    () => ({
      beginHeaderDrag,
      draggingPanelId: visual?.panelId ?? null,
    }),
    [beginHeaderDrag, visual],
  );

  return (
    <DragContext.Provider value={value}>
      {props.children}
      {visual !== null && !reducedMotion ? (
        <div
          className="drag-ghost"
          data-testid="drag-ghost"
          style={{ left: visual.point.x + 12, top: visual.point.y + 12 }}
        >
          {visual.title}
        </div>
      ) : null}
      {visual?.indicator != null ? (
        <DropIndicator rect={visual.indicator} />
      ) : null}
    </DragContext.Provider>
  );
}
