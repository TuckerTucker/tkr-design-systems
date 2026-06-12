/**
 * Composer — multiline auto-grow input (Enter sends, Shift+Enter inserts a
 * newline), disabled-with-reason rendered adjacent to the input (agent
 * busy, auth missing/invalid), a cancel control replacing send during an
 * in-flight turn, and the library-reference intake: pending
 * LibraryReferences render as removable chips on the draft and ride
 * chat.send. The drop target decodes only the library panel's dedicated
 * drag MIME (foreign drags ignored).
 *
 * Focus management: when the composer re-enables (turn completed, auth
 * recovered) focus returns to the textarea; the draft survives every
 * busy/disabled transition.
 */
import {
  useEffect,
  useRef,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
} from "react";

import type { LibraryReference } from "@studio/contract";

import { decodeReferenceDrag } from "../library/reference/referencePayload.js";

export type ComposerDisabledKind =
  | "agent_busy"
  | "auth_missing"
  | "auth_invalid"
  | "no_workspace";

export interface ComposerDisabledReason {
  kind: ComposerDisabledKind;
  message: string;
}

export interface ComposerProps {
  draft: string;
  onDraftChange: (text: string) => void;
  /** Pending library references attached to the draft (shell channel). */
  references: readonly LibraryReference[];
  onReferenceAdd: (reference: LibraryReference) => void;
  onReferenceRemove: (index: number) => void;
  /** Reason rendered adjacent, in place — null when sending is possible. */
  disabled: ComposerDisabledReason | null;
  /** An in-flight turn exists — the cancel control replaces send. */
  cancelAvailable: boolean;
  /** Inline degradation note (bridge down) — informational, not blocking. */
  inlineNote: string | null;
  onSend: (text: string) => void;
  onCancel: () => void;
}

export function Composer(props: ComposerProps): ReactElement {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const wasDisabled = useRef(props.disabled !== null);
  const mounted = useRef(false);
  const inputDisabled = props.disabled !== null;

  // Focus lands in the composer when it first mounts enabled (empty
  // workspace and transcript restore: zero clicks before typing) and
  // whenever it re-enables (send/cancel round-trips, auth recovery).
  // Never steals focus while disabled.
  useEffect(() => {
    const becameEnabled = !mounted.current || wasDisabled.current;
    mounted.current = true;
    if (becameEnabled && !inputDisabled) {
      textareaRef.current?.focus();
    }
    wasDisabled.current = inputDisabled;
  }, [inputDisabled]);

  // Auto-grow with the content (capped by CSS max-height).
  useEffect(() => {
    const element = textareaRef.current;
    if (element !== null) {
      element.style.height = "auto";
      element.style.height = `${element.scrollHeight}px`;
    }
  }, [props.draft]);

  const sendable = props.draft.trim() !== "" && !inputDisabled;

  function submit(): void {
    if (!sendable) {
      return;
    }
    props.onSend(props.draft);
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>): void {
    const reference = decodeReferenceDrag(event.dataTransfer);
    if (reference !== null) {
      event.preventDefault();
      props.onReferenceAdd(reference);
    }
  }

  function onDragOver(event: DragEvent<HTMLDivElement>): void {
    if (event.dataTransfer.types.length > 0) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }
  }

  return (
    <div
      className="chat-composer"
      data-testid="chat-composer"
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      {props.references.length > 0 ? (
        <ul className="chat-reference-chips" aria-label="References attached to this message">
          {props.references.map((reference, index) => (
            <li
              key={`${reference.systemId}-${reference.label}-${index}`}
              className="chat-reference-chip"
            >
              <span className="chat-reference-chip-label">{reference.label}</span>
              <button
                type="button"
                className="chat-reference-chip-remove"
                aria-label={`Remove reference ${reference.label}`}
                onClick={() => props.onReferenceRemove(index)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="chat-composer-row">
        <textarea
          ref={textareaRef}
          className="chat-composer-input"
          data-testid="composer-input"
          rows={1}
          value={props.draft}
          placeholder="Describe a screen, or refine the current one…"
          aria-label="Message the agent"
          aria-describedby={
            props.disabled !== null ? "chat-composer-reason" : undefined
          }
          disabled={inputDisabled}
          onChange={(event) => props.onDraftChange(event.target.value)}
          onKeyDown={onKeyDown}
        />
        {props.cancelAvailable ? (
          <button
            type="button"
            className="chat-composer-cancel"
            data-testid="composer-cancel"
            aria-label="Stop the current generation"
            onClick={props.onCancel}
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            className="chat-composer-send"
            data-testid="composer-send"
            aria-label="Send message"
            disabled={!sendable}
            title={
              props.disabled !== null
                ? props.disabled.message
                : props.draft.trim() === ""
                  ? "Type a message to send"
                  : "Send (Enter)"
            }
            onClick={submit}
          >
            Send
          </button>
        )}
      </div>

      {props.disabled !== null ? (
        <p
          id="chat-composer-reason"
          className="chat-composer-reason"
          data-kind={props.disabled.kind}
          role="status"
        >
          {props.disabled.message}
        </p>
      ) : null}
      {props.inlineNote !== null ? (
        <p className="chat-composer-note" role="status">
          {props.inlineNote}
        </p>
      ) : null}
      <p className="chat-composer-hint" aria-hidden="true">
        Enter to send · Shift+Enter for a new line
      </p>
    </div>
  );
}
