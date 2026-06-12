/**
 * Message-to-canvas version link — the reference chip an artifact-producing
 * turn renders. Activation (click or Enter — a native button) focuses the
 * artifact on the canvas through shared shell state; no navigation, the
 * conversation stays exactly where it is.
 */
import type { ReactElement } from "react";

import type { ArtifactRefView } from "./messageViewModel.js";

export interface ArtifactReferenceProps {
  reference: ArtifactRefView;
  /** The referenced artifact is currently focused on the canvas. */
  active: boolean;
  onFocus: (reference: ArtifactRefView) => void;
}

export function ArtifactReference(props: ArtifactReferenceProps): ReactElement {
  const { reference, active, onFocus } = props;
  const label = `${reference.artifactId} v${reference.version}`;
  return (
    <button
      type="button"
      className="chat-artifact-ref"
      data-active={active}
      aria-label={`Show ${reference.artifactId} version ${reference.version} on the canvas`}
      aria-pressed={active}
      onClick={() => onFocus(reference)}
    >
      <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
        <rect
          x="2"
          y="3"
          width="12"
          height="10"
          rx="1.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path d="M2 6h12" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <span>{label}</span>
      {active ? (
        <span className="chat-artifact-ref-active">on canvas</span>
      ) : null}
    </button>
  );
}
