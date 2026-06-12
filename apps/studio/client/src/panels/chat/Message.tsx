/**
 * One conversation turn — role-styled text, inline tool progress markers,
 * the decision chip row, artifact references, and the structured error
 * block, all contextual to this message. Assistant text renders as text
 * (never injected HTML).
 */
import type { ReactElement } from "react";

import type { ChipKind } from "@studio/contract";

import { ArtifactReference } from "./ArtifactReference.jsx";
import { DecisionChips } from "./DecisionChips.jsx";
import { StructuredError } from "./StructuredError.jsx";
import { ToolProgress } from "./ToolProgress.jsx";
import type { ArtifactRefView, ChatMessageView } from "./messageViewModel.js";

export interface MessageProps {
  message: ChatMessageView;
  /** This message owns the latest (editable) decision set. */
  chipsEditable: boolean;
  /** A turn is in flight — chip selects disable with this reason. */
  chipsDisabledReason: string | null;
  /** Artifact currently focused on the canvas (active indication). */
  focusedArtifactId: string | null;
  onChipChange: (messageId: string, kind: ChipKind, value: string) => void;
  onArtifactFocus: (reference: ArtifactRefView) => void;
  onRetrySend: (messageId: string) => void;
}

export function Message(props: MessageProps): ReactElement {
  const { message } = props;
  const roleLabel = message.role === "user" ? "You" : "Assistant";

  return (
    <article
      className="chat-message"
      data-role={message.role}
      data-streaming={message.streaming}
      data-testid={`message-${message.messageId}`}
      aria-label={`${roleLabel} message`}
    >
      <header className="chat-message-meta">
        <span className="chat-message-role">{roleLabel}</span>
        {message.streaming ? (
          <span className="chat-streaming-indicator" data-testid="streaming-indicator">
            <span className="chat-streaming-dot" aria-hidden="true" />
            responding…
          </span>
        ) : null}
        {message.cancelled ? (
          <span className="chat-message-stopped" data-testid="stopped-badge">
            stopped
          </span>
        ) : null}
        {message.interrupted ? (
          <span className="chat-message-interrupted">
            connection interrupted — resuming
          </span>
        ) : null}
      </header>

      {message.text !== "" ? (
        <p className="chat-message-text">{message.text}</p>
      ) : null}

      {message.tools.length > 0 ? (
        <div className="chat-message-tools">
          {message.tools.map((tool) => (
            <ToolProgress key={tool.toolCallId} progress={tool} />
          ))}
        </div>
      ) : null}

      {message.chipRow !== null ? (
        <DecisionChips
          messageId={message.messageId}
          chipRow={message.chipRow}
          editable={props.chipsEditable}
          disabledReason={props.chipsDisabledReason}
          onChange={props.onChipChange}
        />
      ) : null}

      {message.artifactRefs.length > 0 ? (
        <div className="chat-message-refs">
          {message.artifactRefs.map((reference) => (
            <ArtifactReference
              key={`${reference.artifactId}/${reference.version}`}
              reference={reference}
              active={props.focusedArtifactId === reference.artifactId}
              onFocus={props.onArtifactFocus}
            />
          ))}
        </div>
      ) : null}

      {message.error !== null ? <StructuredError error={message.error} /> : null}

      {message.sendFailed ? (
        <div className="chat-send-failed" data-testid="send-failed">
          <p>This message could not be sent — the connection was down.</p>
          <button
            type="button"
            onClick={() => props.onRetrySend(message.messageId)}
          >
            Retry send
          </button>
        </div>
      ) : null}
    </article>
  );
}
