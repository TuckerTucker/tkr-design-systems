/**
 * Palette swatches — one swatch per palette entry: color chip, name, hex,
 * role, and usage constraint. Clicking copies the hex with confirmation
 * inline on the swatch itself (never a toast); copy failure surfaces the
 * same way. Each swatch carries a send-to-chat reference action and a
 * drag source.
 */
import { useRef, useState, type ReactElement } from "react";

import type { LibraryReference } from "@studio/contract";

import type { PaletteEntryView } from "../model/types.js";
import {
  encodeReferenceDrag,
  paletteReference,
} from "../reference/referencePayload.js";
import { SendToChatAction } from "../reference/SendToChatAction.jsx";

export interface PaletteSwatchesProps {
  systemId: string;
  entries: readonly PaletteEntryView[];
  onReference(reference: LibraryReference): void;
}

type CopyState = "idle" | "copied" | "failed";

const COPY_RESET_MS = 1600;

export function PaletteSwatches(props: PaletteSwatchesProps): ReactElement {
  const [copyStates, setCopyStates] = useState<Record<string, CopyState>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  function setCopyState(name: string, state: CopyState): void {
    setCopyStates((current) => ({ ...current, [name]: state }));
    const existing = timers.current.get(name);
    if (existing !== undefined) {
      clearTimeout(existing);
    }
    if (state !== "idle") {
      timers.current.set(
        name,
        setTimeout(() => setCopyState(name, "idle"), COPY_RESET_MS),
      );
    }
  }

  async function copyHex(entry: PaletteEntryView): Promise<void> {
    try {
      await navigator.clipboard.writeText(entry.value);
      setCopyState(entry.name, "copied");
    } catch {
      setCopyState(entry.name, "failed");
    }
  }

  if (props.entries.length === 0) {
    return (
      <p className="library-empty" role="status">
        This system declares no palette entries.
      </p>
    );
  }

  return (
    <ul className="library-palette">
      {props.entries.map((entry) => {
        const copyState = copyStates[entry.name] ?? "idle";
        const reference = paletteReference(props.systemId, entry);
        return (
          <li
            key={entry.name}
            className="library-swatch"
            draggable
            onDragStart={(event) =>
              encodeReferenceDrag(event.dataTransfer, reference)
            }
          >
            <button
              type="button"
              className="library-swatch-copy"
              aria-label={`Copy ${entry.name} hex ${entry.value}`}
              onClick={() => void copyHex(entry)}
            >
              <span
                className="library-swatch-chip"
                style={{ backgroundColor: entry.value }}
                aria-hidden="true"
              />
              <span className="library-swatch-name">{entry.name}</span>
              <code className="library-swatch-hex">{entry.value}</code>
              <span className="library-swatch-feedback" role="status">
                {copyState === "copied"
                  ? "Copied"
                  : copyState === "failed"
                    ? "Copy failed — select the hex manually"
                    : ""}
              </span>
            </button>
            <span className="library-swatch-role">{entry.role}</span>
            {entry.usageConstraint !== "" ? (
              <span className="library-swatch-constraint">
                {entry.usageConstraint}
              </span>
            ) : null}
            <SendToChatAction reference={reference} onSend={props.onReference} />
          </li>
        );
      })}
    </ul>
  );
}
