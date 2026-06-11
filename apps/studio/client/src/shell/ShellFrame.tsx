/**
 * ShellFrame — the docking layout: center stage always present, two rails
 * flanking it. Panel contents portal in through the PanelContentLayer;
 * the drag layer renders the ghost and drop indicators above everything.
 */
import type { ReactElement, ReactNode } from "react";

import { DragLayerProvider } from "./DragContext.jsx";
import { PanelContentLayer } from "./PanelContentLayer.jsx";
import { Rail } from "./Rail.jsx";

export interface ShellFrameProps {
  /** The always-center slot (canvas arrives in Wave 6). */
  center: ReactNode;
}

export function ShellFrame(props: ShellFrameProps): ReactElement {
  return (
    <DragLayerProvider>
      <div className="shell-frame" data-testid="shell-frame">
        <Rail rail="left" />
        <main className="center-stage" aria-label="Center stage">
          {props.center}
        </main>
        <Rail rail="right" />
      </div>
      <PanelContentLayer />
    </DragLayerProvider>
  );
}
