/**
 * Inline connection state in the shell chrome — never a toast. Shows what
 * the client is doing (connected / reconnecting / offline-with-retries)
 * and degrades gracefully: the shell, persisted layout, and routing keep
 * working while the socket recovers.
 */
import type { ReactElement } from "react";

import { useShellState } from "../app/shellState.jsx";
import type { ConnectionState } from "./studioSocket.js";

export function connectionLabel(state: ConnectionState): string {
  switch (state) {
    case "connecting":
      return "Connecting…";
    case "open":
      return "Connected";
    case "reconnecting":
      return "Connection lost — reconnecting…";
    case "offline":
      return "Server unreachable — retrying in the background";
  }
}

export function ConnectionStatus(): ReactElement {
  const { connectionState } = useShellState();
  return (
    <div
      className="connection-status"
      data-state={connectionState}
      role="status"
      aria-live="polite"
    >
      <span className="connection-status-dot" aria-hidden="true" />
      <span>{connectionLabel(connectionState)}</span>
    </div>
  );
}
