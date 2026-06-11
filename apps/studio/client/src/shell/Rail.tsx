/**
 * Rail — one side of the shell. Hosts the icon strip (collapsed panels),
 * the tab strip (2+ expanded panels), the panel hosts, and the resize
 * handle. A rail with nothing on it collapses to zero width and the
 * center stage absorbs the space.
 */
import {
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from "react";

import { useDock } from "./DockContext.jsx";
import { railPlacements, MAX_RAIL_WIDTH, MIN_RAIL_WIDTH } from "./dockReducer.js";
import { IconStrip } from "./IconStrip.jsx";
import { PanelHost } from "./PanelHost.jsx";
import { TabStrip } from "./TabStrip.jsx";
import type { RailSide } from "./types.js";

const RESIZE_STEP_PX = 16;

export interface RailProps {
  rail: RailSide;
}

export function Rail(props: RailProps): ReactElement {
  const { rail } = props;
  const { state, panels } = useDock();
  const placements = railPlacements(state, rail);
  const expanded = placements.filter((placement) => !placement.collapsed);
  const collapsed = placements.filter((placement) => placement.collapsed);
  const empty = placements.length === 0;
  const hasBody = expanded.length > 0;

  const width = !hasBody
    ? collapsed.length > 0
      ? undefined // icon strip's natural width
      : 0
    : state.railWidths[rail];

  return (
    <div
      className={`rail${empty ? " rail-empty" : ""}`}
      data-rail={rail}
      style={width !== undefined ? { width } : undefined}
    >
      <div className="rail-inner">
        {rail === "right" && hasBody ? <RailResizeHandle rail={rail} /> : null}
        {collapsed.length > 0 ? (
          <IconStrip rail={rail} placements={collapsed} panels={panels} />
        ) : null}
        {hasBody ? (
          <div className="rail-body">
            {expanded.length >= 2 ? (
              <TabStrip rail={rail} placements={expanded} panels={panels} />
            ) : null}
            {expanded.map((placement) => {
              const definition = panels.find(
                (panel) => panel.id === placement.panelId,
              );
              if (definition === undefined) {
                return null;
              }
              return (
                <PanelHost
                  key={placement.panelId}
                  definition={definition}
                  placement={placement}
                  visible={state.activeTab[rail] === placement.panelId}
                />
              );
            })}
          </div>
        ) : null}
        {rail === "left" && hasBody ? <RailResizeHandle rail={rail} /> : null}
      </div>
    </div>
  );
}

/**
 * Rail resize — pointer drag and keyboard arrows, clamped by the reducer
 * to the widest hosted panel minWidth (constraint, not error).
 */
function RailResizeHandle(props: { rail: RailSide }): ReactElement {
  const { rail } = props;
  const { state, dispatch } = useDock();
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  function onPointerDown(event: ReactPointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    dragRef.current = {
      startX: event.clientX,
      startWidth: state.railWidths[rail],
    };
    function onMove(moveEvent: PointerEvent): void {
      const session = dragRef.current;
      if (session === null) {
        return;
      }
      const dx = moveEvent.clientX - session.startX;
      const width =
        rail === "left" ? session.startWidth + dx : session.startWidth - dx;
      dispatch({ type: "resizeRail", rail, width });
    }
    function onUp(): void {
      dragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function onKeyDown(event: ReactKeyboardEvent): void {
    const grow = rail === "left" ? "ArrowRight" : "ArrowLeft";
    const shrink = rail === "left" ? "ArrowLeft" : "ArrowRight";
    if (event.key === grow) {
      event.preventDefault();
      dispatch({
        type: "resizeRail",
        rail,
        width: state.railWidths[rail] + RESIZE_STEP_PX,
      });
    } else if (event.key === shrink) {
      event.preventDefault();
      dispatch({
        type: "resizeRail",
        rail,
        width: state.railWidths[rail] - RESIZE_STEP_PX,
      });
    }
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${rail} rail`}
      aria-valuenow={state.railWidths[rail]}
      aria-valuemin={MIN_RAIL_WIDTH}
      aria-valuemax={MAX_RAIL_WIDTH}
      tabIndex={0}
      style={{ width: 4, cursor: "col-resize", flex: "none" }}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    />
  );
}
