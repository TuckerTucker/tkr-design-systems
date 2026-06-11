/**
 * Panel content layer — renders every panel's lazy content exactly once,
 * each into its stable per-panel host element (DockContext.contentHost).
 * PanelHost adopts that element into whichever slot currently hosts the
 * panel, so contents are never remounted by moves, tab switches, or
 * collapse/restore (spec: performance) — state inside panels survives.
 *
 * Each panel is wrapped in its own error boundary: a panel render failure
 * is contained and shown in place while the shell keeps working.
 */
import { Suspense, type ReactElement } from "react";
import { createPortal } from "react-dom";

import { useDock } from "./DockContext.jsx";
import { PanelErrorBoundary } from "./ErrorBoundary.jsx";

export function PanelContentLayer(): ReactElement {
  const { panels, contentHost } = useDock();
  return (
    <>
      {panels.map((panel) =>
        createPortal(
          <PanelErrorBoundary label={`The ${panel.title} panel`}>
            <Suspense
              fallback={<div className="panel-loading">Loading {panel.title}…</div>}
            >
              <panel.component />
            </Suspense>
          </PanelErrorBoundary>,
          contentHost(panel.id),
          panel.id,
        ),
      )}
    </>
  );
}
