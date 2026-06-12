/**
 * Canvas empty state — a workspace with no artifacts renders a pointer at
 * the chat panel instead of dead chrome (no filmstrip, no compliance bar).
 * While the agent's first generation is in flight the empty state carries
 * the live generation status instead — a first artifact lands only when
 * the turn completes, and "nothing yet" with tools visibly running in
 * chat reads as broken.
 */
import type { ReactElement } from "react";

export interface EmptyStateProps {
  /** Live generation summary while a producing turn is in flight. */
  generationSummary?: string | null;
}

export function EmptyState(props: EmptyStateProps): ReactElement {
  if (
    props.generationSummary !== undefined &&
    props.generationSummary !== null
  ) {
    return (
      <div className="canvas-empty" data-testid="canvas-empty" role="status">
        <p className="canvas-empty-title">
          Generating — {props.generationSummary}…
        </p>
        <p className="canvas-empty-hint">
          The first version lands here when the agent finishes this step —
          follow its progress in the chat.
        </p>
      </div>
    );
  }
  return (
    <div className="canvas-empty" data-testid="canvas-empty">
      <p className="canvas-empty-title">Nothing on the canvas yet</p>
      <p className="canvas-empty-hint">
        Describe a screen in chat to put an artifact here.
      </p>
    </div>
  );
}
