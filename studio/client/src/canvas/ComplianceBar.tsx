/**
 * ComplianceBar — the persistent bar under the stage: overall status plus
 * per-rule pass/warn/fail chips for the RENDERED version (head or scrub
 * preview). Each status carries a non-color glyph alongside its WCAG AA
 * color; expanding a rule lists its violation inline (no modal); a
 * violation with resolvable nodeIds highlights the offending SVG nodes on
 * the stage (Escape clears); node-less violations show the highlight
 * action disabled with the reason. Pending / unavailable / error states
 * render in place and never block the stage.
 */
import { useState, type ReactElement } from "react";

import {
  statusGlyph,
  statusLabel,
  type ComplianceBarState,
  type ComplianceRuleModel,
} from "./compliance.js";

export interface ComplianceBarProps {
  /** The version the bar describes; null → no version on stage. */
  version: number | null;
  state: ComplianceBarState | null;
  highlightedRuleId: string | null;
  /** nodeIds from the rule that exist in the rendered SVG. */
  resolveNodeIds(nodeIds: string[]): string[];
  onHighlight(rule: ComplianceRuleModel, presentNodeIds: string[]): void;
  onClearHighlight(): void;
  onRetry(): void;
}

export function ComplianceBar(props: ComplianceBarProps): ReactElement | null {
  const {
    version,
    state,
    highlightedRuleId,
    resolveNodeIds,
    onHighlight,
    onClearHighlight,
    onRetry,
  } = props;
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);

  if (version === null) {
    return null;
  }

  const body = ((): ReactElement => {
    if (state === null || state.kind === "pending") {
      return (
        <p className="canvas-compliance-pending" role="status">
          Checking compliance for v{version}…
        </p>
      );
    }
    if (state.kind === "unavailable") {
      return (
        <p className="canvas-compliance-unavailable" role="status">
          Compliance unavailable for v{version}: {state.reason}
        </p>
      );
    }
    if (state.kind === "error") {
      return (
        <p className="canvas-compliance-error" role="alert">
          {state.error.message} {state.error.fix}
          <button type="button" className="canvas-compliance-retry" onClick={onRetry}>
            Retry
          </button>
        </p>
      );
    }
    const { model } = state;
    return (
      <>
        <span
          className="canvas-compliance-overall"
          data-status={model.overall}
          data-testid="compliance-overall"
        >
          <span aria-hidden="true" className="canvas-status-glyph">
            {statusGlyph(model.overall)}
          </span>
          {statusLabel(model.overall)} · {model.passed} passed · {model.failed}{" "}
          failed · {model.advisory} advisory
        </span>
        <ul className="canvas-compliance-rules">
          {model.rules.map((rule) => {
            const expanded = expandedRuleId === rule.ruleId;
            const presentNodeIds = resolveNodeIds(rule.nodeIds);
            const highlightDisabledReason =
              rule.status === "pass"
                ? "This rule passed — nothing to highlight."
                : rule.nodeIds.length === 0
                  ? "This violation applies to the whole document — no single node to highlight."
                  : presentNodeIds.length === 0
                    ? "The offending nodes are not present in the rendered version."
                    : null;
            return (
              <li key={rule.ruleId} className="canvas-compliance-rule">
                <button
                  type="button"
                  className="canvas-compliance-chip"
                  data-status={rule.status}
                  data-testid={`compliance-chip-${rule.ruleId}`}
                  aria-expanded={expanded}
                  onClick={() =>
                    setExpandedRuleId(expanded ? null : rule.ruleId)
                  }
                >
                  <span aria-hidden="true" className="canvas-status-glyph">
                    {statusGlyph(rule.status)}
                  </span>
                  <span className="canvas-compliance-rule-id">{rule.ruleId}</span>
                  <span className="canvas-visually-hidden">
                    {statusLabel(rule.status)}
                  </span>
                </button>
                {expanded ? (
                  <div className="canvas-compliance-detail" data-testid={`compliance-detail-${rule.ruleId}`}>
                    <p className="canvas-compliance-message">
                      <span className="canvas-compliance-severity" data-status={rule.status}>
                        {statusLabel(rule.status)}
                      </span>{" "}
                      {rule.message}
                    </p>
                    {highlightedRuleId === rule.ruleId ? (
                      <button
                        type="button"
                        className="canvas-compliance-highlight"
                        onClick={onClearHighlight}
                      >
                        Clear highlight
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="canvas-compliance-highlight"
                        disabled={highlightDisabledReason !== null}
                        title={
                          highlightDisabledReason ??
                          "Outline the offending nodes on the stage"
                        }
                        onClick={() => onHighlight(rule, presentNodeIds)}
                      >
                        Highlight on canvas
                      </button>
                    )}
                    {highlightDisabledReason !== null && rule.status !== "pass" ? (
                      <p className="canvas-compliance-disabled-reason">
                        {highlightDisabledReason}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </>
    );
  })();

  return (
    <div
      className="canvas-compliance-bar"
      data-testid="canvas-compliance-bar"
      data-version={version}
    >
      {body}
    </div>
  );
}
