/**
 * Live artifact events — THE canvas's WebSocket seam. Subscribes to
 * artifact.version_created and artifact.compliance_completed through the
 * shell's StudioSocket (typed contract payloads, no stringly-typed
 * messages), watches the chat tool stream for the progressive generation
 * indicator, and fires a resync callback when the connection resumes so
 * the canvas re-fetches head and compliance after missed events.
 */
import { useEffect, useRef } from "react";

import type {
  ComplianceCompletedPayload,
  VersionCreatedPayload,
} from "@studio/contract";

import type { ConnectionState, StudioSocket } from "../ws/studioSocket.js";

export interface ArtifactEventHandlers {
  onVersionCreated(payload: VersionCreatedPayload): void;
  onComplianceCompleted(payload: ComplianceCompletedPayload): void;
  /** A generation tool started (e.g. wf_generate) — show progress. */
  onGenerationStarted(summary: string): void;
  /** The chat turn settled (completed or errored) — clear progress. */
  onGenerationSettled(): void;
  /** Connection resumed after a drop — re-sync head and compliance. */
  onReconnected(): void;
}

const GENERATION_TOOL_PREFIX = "wf_";

export function useArtifactEvents(
  socket: StudioSocket,
  handlers: ArtifactEventHandlers,
): void {
  // Latest-handler ref so subscriptions live for the socket's lifetime
  // while callbacks stay current (no re-subscribe churn per render).
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const offVersion = socket.on("artifact.version_created", (message) => {
      handlersRef.current.onVersionCreated(message.payload);
    });
    const offCompliance = socket.on(
      "artifact.compliance_completed",
      (message) => {
        handlersRef.current.onComplianceCompleted(message.payload);
      },
    );
    const offToolStarted = socket.on("chat.tool_started", (message) => {
      if (message.payload.tool.startsWith(GENERATION_TOOL_PREFIX)) {
        handlersRef.current.onGenerationStarted(message.payload.summary);
      }
    });
    const offCompleted = socket.on("chat.message_completed", () => {
      handlersRef.current.onGenerationSettled();
    });
    const offError = socket.on("chat.error", () => {
      handlersRef.current.onGenerationSettled();
    });

    let previousState: ConnectionState = socket.state();
    const offConnection = socket.onConnectionState((state) => {
      if (
        state === "open" &&
        (previousState === "reconnecting" || previousState === "offline")
      ) {
        handlersRef.current.onReconnected();
      }
      previousState = state;
    });

    return () => {
      offVersion();
      offCompliance();
      offToolStarted();
      offCompleted();
      offError();
      offConnection();
    };
  }, [socket]);
}
