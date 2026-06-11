/**
 * Canvas empty state — a workspace with no artifacts renders a pointer at
 * the chat panel instead of dead chrome (no filmstrip, no compliance bar).
 */
import type { ReactElement } from "react";

export function EmptyState(): ReactElement {
  return (
    <div className="canvas-empty" data-testid="canvas-empty">
      <p className="canvas-empty-title">Nothing on the canvas yet</p>
      <p className="canvas-empty-hint">
        Describe a screen in chat to put an artifact here.
      </p>
    </div>
  );
}
