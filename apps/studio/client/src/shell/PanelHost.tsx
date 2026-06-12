/**
 * Panel chrome — header (title, drag handle, collapse control, settings
 * menu) and the content slot the PanelContentLayer portals into. The host
 * stays mounted (hidden) when its panel is the inactive tab or collapsed,
 * so panel-internal state survives tab switches and collapse.
 *
 * The header is the drag handle and the keyboard focus target for panel
 * operations (keyboardMap bindings).
 */
import {
  useCallback,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from "react";

import { focusElementId, useDock } from "./DockContext.jsx";
import { useDrag } from "./DragContext.jsx";
import { railPlacements } from "./dockReducer.js";
import { panelHeaderKeyAction } from "./keyboardMap.js";
import { PanelSettingsMenu } from "./PanelSettingsMenu.jsx";
import type { DockPlacement, PanelDefinition } from "./types.js";

export interface PanelHostProps {
  definition: PanelDefinition;
  placement: DockPlacement;
  /** Visible: expanded and the rail's active tab. */
  visible: boolean;
}

export function PanelHost(props: PanelHostProps): ReactElement {
  const { definition, placement, visible } = props;
  const { state, dispatch, contentHost, requestFocus } = useDock();
  const { beginHeaderDrag, draggingPanelId } = useDrag();

  // Adopt the panel's stable content element into this host's slot. The
  // element moves between slots natively (appendChild), so the React
  // subtree rendered into it is never remounted by docking operations.
  const slotRef = useCallback(
    (element: HTMLElement | null) => {
      if (element !== null) {
        element.appendChild(contentHost(definition.id));
      }
    },
    [contentHost, definition.id],
  );

  function onHeaderPointerDown(event: ReactPointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    beginHeaderDrag(definition.id, definition.title, {
      clientX: event.clientX,
      clientY: event.clientY,
    });
  }

  function onHeaderKeyDown(event: ReactKeyboardEvent): void {
    const expandedOnRail = railPlacements(state, placement.rail).filter(
      (entry) => !entry.collapsed,
    );
    const result = panelHeaderKeyAction(
      { key: event.key, altKey: event.altKey },
      {
        panelId: definition.id,
        rail: placement.rail,
        order: expandedOnRail.findIndex(
          (entry) => entry.panelId === definition.id,
        ),
        railSize: expandedOnRail.length,
      },
    );
    if (result === null) {
      return;
    }
    event.preventDefault();
    if (result.kind === "dock") {
      dispatch(result.action);
      requestFocus(definition.id, "header");
      return;
    }
    // F6: cycle focus across visible panel headers.
    const headers = [
      ...document.querySelectorAll<HTMLElement>("[data-panel-header]"),
    ].filter((element) => element.closest("[hidden]") === null);
    const index = headers.findIndex(
      (element) => element.id === focusElementId(definition.id, "header"),
    );
    headers[(index + 1) % headers.length]?.focus();
  }

  function collapse(): void {
    dispatch({ type: "collapse", panelId: definition.id });
    requestFocus(definition.id, "icon");
  }

  return (
    <section
      className="panel-host"
      aria-label={`${definition.title} panel`}
      hidden={!visible}
      data-panel-id={definition.id}
    >
      <div
        id={focusElementId(definition.id, "header")}
        className="panel-header"
        data-panel-header={definition.id}
        data-dragging={draggingPanelId === definition.id}
        role="group"
        aria-roledescription="panel header"
        aria-label={`${definition.title} — drag or use Alt+Arrow keys to move`}
        tabIndex={0}
        onPointerDown={onHeaderPointerDown}
        onKeyDown={onHeaderKeyDown}
      >
        <definition.icon size={14} />
        <span className="panel-header-title">{definition.title}</span>
        <button
          type="button"
          className="panel-header-button"
          aria-label={`Collapse ${definition.title} panel`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={collapse}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M3 6l5 5 5-5"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
          </svg>
        </button>
        <PanelSettingsMenu placement={placement} panelTitle={definition.title} />
      </div>
      <div
        id={focusElementId(definition.id, "content")}
        className="panel-content"
        ref={slotRef}
        tabIndex={-1}
        role="region"
        aria-label={`${definition.title} content`}
      />
    </section>
  );
}
