/**
 * Inline tool-progress marker — contextual to the owning message, never a
 * toast. Running state shows a pulse the reduced-motion preference turns
 * static (CSS); resolved states show the outcome in place.
 */
import type { ReactElement } from "react";

import type { ToolProgressView } from "./messageViewModel.js";

export interface ToolProgressProps {
  progress: ToolProgressView;
}

export function ToolProgress(props: ToolProgressProps): ReactElement {
  const { progress } = props;
  return (
    <div
      className="chat-tool-progress"
      data-state={progress.state}
      data-testid={`tool-${progress.toolCallId}`}
    >
      <span className="chat-tool-progress-icon" aria-hidden="true">
        {progress.state === "running"
          ? "…"
          : progress.state === "ok"
            ? "✓"
            : "✕"}
      </span>
      <span className="chat-tool-progress-label">
        {progress.state === "running" ? `${progress.label}…` : progress.label}
      </span>
      {progress.state !== "running" &&
      progress.detail !== null &&
      progress.detail !== progress.label ? (
        <span className="chat-tool-progress-detail">{progress.detail}</span>
      ) : null}
    </div>
  );
}
