/**
 * Explicit send-to-chat action — keyboard-reachable parity for drag on
 * every referenceable item (gallery card, palette swatch, layout card).
 * Emits the typed LibraryReference through the shell seam
 * (addReference); confirmation renders inline on the button itself, in
 * place — never a toast.
 */
import { useEffect, useRef, useState, type ReactElement } from "react";

import type { LibraryReference } from "@studio/contract";

export interface SendToChatActionProps {
  reference: LibraryReference;
  onSend(reference: LibraryReference): void;
}

const CONFIRM_MS = 1600;

export function SendToChatAction(props: SendToChatActionProps): ReactElement {
  const [confirmed, setConfirmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  return (
    <button
      type="button"
      className="library-send-to-chat"
      aria-label={`Send ${props.reference.label} to chat`}
      onClick={() => {
        props.onSend(props.reference);
        setConfirmed(true);
        if (timer.current !== null) {
          clearTimeout(timer.current);
        }
        timer.current = setTimeout(() => setConfirmed(false), CONFIRM_MS);
      }}
    >
      {confirmed ? "Added to chat" : "Send to chat"}
    </button>
  );
}
