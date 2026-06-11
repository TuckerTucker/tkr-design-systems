/**
 * Icon strip — collapsed panels live here as icons with accessible names.
 * One click (or keyboard activation) restores a panel to its prior rail,
 * order, and tab state; focus then moves into the restored panel.
 */
import type { ReactElement } from "react";

import { focusElementId, useDock } from "./DockContext.jsx";
import type { DockPlacement, PanelDefinition, RailSide } from "./types.js";

export interface IconStripProps {
  rail: RailSide;
  /** Collapsed placements on the rail, in stack order. */
  placements: readonly DockPlacement[];
  panels: readonly PanelDefinition[];
}

export function IconStrip(props: IconStripProps): ReactElement {
  const { rail, placements, panels } = props;
  const { dispatch, requestFocus } = useDock();

  return (
    <div
      className="icon-strip"
      role="toolbar"
      aria-orientation="vertical"
      aria-label={`${rail} rail collapsed panels`}
    >
      {placements.map((placement) => {
        const definition = panels.find((p) => p.id === placement.panelId);
        if (definition === undefined) {
          return null;
        }
        return (
          <button
            key={placement.panelId}
            id={focusElementId(placement.panelId, "icon")}
            type="button"
            className="icon-strip-button"
            aria-label={`Restore ${definition.title} panel`}
            title={`Restore ${definition.title}`}
            onClick={() => {
              dispatch({ type: "restore", panelId: placement.panelId });
              requestFocus(placement.panelId, "content");
            }}
          >
            <definition.icon size={16} />
          </button>
        );
      })}
    </div>
  );
}
