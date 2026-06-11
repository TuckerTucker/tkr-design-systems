/**
 * Drop indicator — drawn during a header drag at the exact slot the panel
 * would take. Indicators are information, not motion: they render even
 * under prefers-reduced-motion.
 */
import type { ReactElement } from "react";

import type { RectLike } from "./dragController.js";

export interface DropIndicatorProps {
  rect: RectLike;
}

export function DropIndicator(props: DropIndicatorProps): ReactElement {
  const { rect } = props;
  const kind = rect.height > 6 ? "rail" : "slot";
  return (
    <div
      className="drop-indicator"
      data-kind={kind}
      data-testid="drop-indicator"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      }}
    />
  );
}
