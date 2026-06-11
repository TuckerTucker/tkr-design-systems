/**
 * Tab strip — rendered only when 2+ expanded panels share a rail (chrome
 * appears only when it has a job). ARIA tabs pattern with roving tabindex
 * and automatic activation: arrow keys move focus AND activate, so
 * keyboard parity with clicking is exact.
 */
import type { KeyboardEvent as ReactKeyboardEvent, ReactElement } from "react";

import { useDock } from "./DockContext.jsx";
import type { DockPlacement, PanelDefinition, RailSide } from "./types.js";

export interface TabStripProps {
  rail: RailSide;
  /** Expanded placements on the rail, in stack order. */
  placements: readonly DockPlacement[];
  panels: readonly PanelDefinition[];
}

export function tabId(rail: RailSide, panelId: string): string {
  return `tab-${rail}-${panelId}`;
}

export function TabStrip(props: TabStripProps): ReactElement {
  const { rail, placements, panels } = props;
  const { state, dispatch } = useDock();
  const activeId = state.activeTab[rail];

  function activate(panelId: string, focus: boolean): void {
    dispatch({ type: "activateTab", rail, panelId });
    if (focus) {
      document.getElementById(tabId(rail, panelId))?.focus();
    }
  }

  function onKeyDown(event: ReactKeyboardEvent): void {
    const ids = placements.map((placement) => placement.panelId);
    const currentIndex = Math.max(
      0,
      ids.findIndex((id) => id === activeId),
    );
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % ids.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + ids.length) % ids.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = ids.length - 1;
    }
    if (nextIndex === null) {
      return;
    }
    event.preventDefault();
    const id = ids[nextIndex];
    if (id !== undefined) {
      activate(id, true);
    }
  }

  return (
    <div
      className="tab-strip"
      role="tablist"
      aria-label={`${rail} rail panels`}
      onKeyDown={onKeyDown}
    >
      {placements.map((placement) => {
        const definition = panels.find((p) => p.id === placement.panelId);
        if (definition === undefined) {
          return null;
        }
        const selected = placement.panelId === activeId;
        return (
          <button
            key={placement.panelId}
            id={tabId(rail, placement.panelId)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`panel-content-${placement.panelId}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => activate(placement.panelId, false)}
          >
            <definition.icon size={12} />
            {definition.title}
          </button>
        );
      })}
    </div>
  );
}
