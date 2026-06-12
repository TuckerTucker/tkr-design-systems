/**
 * Transcript rendering — messages in order inside ONE polite live region
 * (role="log"), so streamed text, tool progress, and error blocks are
 * announced without focus theft and without duplicate announcements.
 *
 * Scroll pinning: the view stays glued to the latest message while the
 * reader is at the bottom; scrolling up suspends pinning and reveals an
 * unobtrusive jump-to-latest affordance. Reduced motion makes the jump
 * instant.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type UIEvent,
} from "react";

import type { ChipKind } from "@studio/contract";

import { useReducedMotion } from "../../shell/useReducedMotion.js";
import { Message } from "./Message.jsx";
import type { ArtifactRefView, ChatMessageView } from "./messageViewModel.js";

/** Distance from the bottom (px) still counting as "pinned". */
const PIN_THRESHOLD = 32;

export interface MessageListProps {
  messages: readonly ChatMessageView[];
  latestChipsMessageId: string | null;
  chipsDisabledReason: string | null;
  focusedArtifactId: string | null;
  onChipChange: (messageId: string, kind: ChipKind, value: string) => void;
  onArtifactFocus: (reference: ArtifactRefView) => void;
  onRetrySend: (messageId: string) => void;
}

function scrollToBottom(element: HTMLElement, smooth: boolean): void {
  const top = element.scrollHeight;
  if (typeof element.scrollTo === "function") {
    element.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
  } else {
    element.scrollTop = top;
  }
}

export function MessageList(props: MessageListProps): ReactElement {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [pinned, setPinned] = useState(true);
  const pinnedRef = useRef(true);
  const reducedMotion = useReducedMotion();

  const setPinnedState = useCallback((value: boolean): void => {
    pinnedRef.current = value;
    setPinned(value);
  }, []);

  const onScroll = useCallback(
    (event: UIEvent<HTMLDivElement>): void => {
      const element = event.currentTarget;
      const distance =
        element.scrollHeight - element.scrollTop - element.clientHeight;
      setPinnedState(distance <= PIN_THRESHOLD);
    },
    [setPinnedState],
  );

  // Pinned auto-scroll on every transcript change (single anchor check).
  const lastMessage = props.messages.at(-1);
  const lastText = lastMessage?.text ?? "";
  const lastId = lastMessage?.messageId ?? "";
  useEffect(() => {
    const element = listRef.current;
    if (element !== null && pinnedRef.current) {
      scrollToBottom(element, false);
    }
  }, [props.messages.length, lastText, lastId]);

  const jumpToLatest = useCallback((): void => {
    const element = listRef.current;
    if (element !== null) {
      scrollToBottom(element, !reducedMotion);
      setPinnedState(true);
    }
  }, [reducedMotion, setPinnedState]);

  return (
    <div className="chat-message-list-wrap">
      <div
        ref={listRef}
        className="chat-message-list"
        data-testid="chat-message-list"
        role="log"
        aria-label="Conversation"
        aria-live="polite"
        aria-relevant="additions text"
        onScroll={onScroll}
        tabIndex={0}
      >
        {props.messages.length === 0 ? (
          <div className="chat-empty" data-testid="chat-empty">
            <p className="chat-empty-title">Start with a brief</p>
            <p className="chat-empty-hint">
              Describe the screen you want — for example “Login screen for a
              banking app, mobile, keep it minimal”. The agent picks a design
              system and layout you can adjust afterwards.
            </p>
          </div>
        ) : (
          props.messages.map((message) => (
            <Message
              key={message.messageId}
              message={message}
              chipsEditable={
                message.messageId === props.latestChipsMessageId
              }
              chipsDisabledReason={props.chipsDisabledReason}
              focusedArtifactId={props.focusedArtifactId}
              onChipChange={props.onChipChange}
              onArtifactFocus={props.onArtifactFocus}
              onRetrySend={props.onRetrySend}
            />
          ))
        )}
      </div>
      {!pinned ? (
        <button
          type="button"
          className="chat-jump-latest"
          data-testid="jump-to-latest"
          onClick={jumpToLatest}
        >
          Jump to latest
        </button>
      ) : null}
    </div>
  );
}
