/**
 * Decision chips — the agent's system/layout/platform choices rendered as
 * editable selects on the latest decision set (chips.updated payload), with
 * the rerunStep hint naming what a change re-runs. Historical turns render
 * the same values read-only. While any turn is in flight the selects
 * disable with the reason in place (no double-fire; the relay also rejects
 * busy turns).
 */
import type { ReactElement } from "react";

import type { ChipKind, DecisionChip } from "@studio/contract";

import { StructuredError } from "./StructuredError.jsx";
import type { ChipRowView } from "./messageViewModel.js";

const CHIP_LABELS: Readonly<Record<ChipKind, string>> = {
  system: "Design system",
  layout: "Layout",
  platform: "Platform",
};

const RERUN_LABELS: Readonly<Record<DecisionChip["rerunStep"], string>> = {
  generate: "re-runs generation",
  substitute: "re-runs the content pass",
  compose: "re-runs composition",
};

export interface DecisionChipsProps {
  messageId: string;
  chipRow: ChipRowView;
  /** This row is the latest decision set (editable). */
  editable: boolean;
  /** A turn is in flight — selects disable with this reason. */
  disabledReason: string | null;
  onChange: (messageId: string, kind: ChipKind, value: string) => void;
}

export function DecisionChips(props: DecisionChipsProps): ReactElement {
  const { messageId, chipRow, editable, disabledReason, onChange } = props;

  if (!editable) {
    return (
      <div
        className="chat-chips chat-chips-readonly"
        role="group"
        aria-label="Decisions for this turn (read-only — only the latest set is editable)"
      >
        {chipRow.chips.map((chip) => (
          <span key={chip.kind} className="chat-chip-readonly">
            <span className="chat-chip-label">{CHIP_LABELS[chip.kind]}</span>
            <span className="chat-chip-value">{chip.value}</span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="chat-chips" role="group" aria-label="Decisions — change one to re-run">
      {chipRow.chips.map((chip) => {
        const selectId = `chip-${messageId}-${chip.kind}`;
        return (
          <span key={chip.kind} className="chat-chip">
            <label className="chat-chip-label" htmlFor={selectId}>
              {CHIP_LABELS[chip.kind]}
            </label>
            <select
              id={selectId}
              className="chat-chip-select"
              value={chip.value}
              disabled={disabledReason !== null}
              aria-label={CHIP_LABELS[chip.kind]}
              title={
                disabledReason ??
                `${CHIP_LABELS[chip.kind]} — changing it ${RERUN_LABELS[chip.rerunStep]}`
              }
              onChange={(event) =>
                onChange(messageId, chip.kind, event.target.value)
              }
            >
              {chip.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
              {!chip.options.includes(chip.value) ? (
                <option value={chip.value}>{chip.value}</option>
              ) : null}
            </select>
            <span className="chat-chip-rerun-hint">
              {RERUN_LABELS[chip.rerunStep]}
            </span>
          </span>
        );
      })}
      {disabledReason !== null ? (
        <span className="chat-chips-disabled-reason" role="status">
          {disabledReason}
        </span>
      ) : null}
      {chipRow.error !== null ? <StructuredError error={chipRow.error} /> : null}
    </div>
  );
}
