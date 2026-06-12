/**
 * Spacing visualization — the grid unit and every allowed step rendered
 * as proportional bars (real pixel widths), with page margins and gaps
 * labeled.
 */
import type { ReactElement } from "react";

import type { LayoutTokensView } from "../model/types.js";

export interface SpacingGridProps {
  layout: LayoutTokensView;
}

export function SpacingGrid(props: SpacingGridProps): ReactElement {
  const { layout } = props;
  return (
    <div className="library-spacing">
      <p className="library-spacing-unit">
        <span className="library-token-label">Grid unit</span>
        {layout.gridUnit}px
      </p>
      {layout.allowedSteps.length > 0 ? (
        <ul className="library-spacing-steps" aria-label="Allowed spacing steps">
          {layout.allowedSteps.map((step) => (
            <li key={step} className="library-spacing-step">
              <span className="library-spacing-step-label">{step}px</span>
              <span
                className="library-spacing-step-bar"
                style={{ width: `${step}px` }}
                aria-hidden="true"
              />
            </li>
          ))}
        </ul>
      ) : null}
      <dl className="library-spacing-meta">
        <div>
          <dt>Page margin (mobile)</dt>
          <dd>{layout.pageMarginMobile}px</dd>
        </div>
        <div>
          <dt>Page margin (desktop)</dt>
          <dd>{layout.pageMarginDesktop}px</dd>
        </div>
        <div>
          <dt>Component gap</dt>
          <dd>{layout.componentGap}px</dd>
        </div>
        <div>
          <dt>Section gap</dt>
          <dd>{layout.sectionGap}px</dd>
        </div>
      </dl>
    </div>
  );
}
