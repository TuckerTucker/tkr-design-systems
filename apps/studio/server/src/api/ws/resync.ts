/**
 * Full state re-sync — replays current workspace state to one connection
 * using ONLY the existing contract event vocabulary (no invented message
 * names): bridge.status and auth.status first (the attach acknowledgement
 * — the first envelope echoes the attach requestId), then the transcript
 * as completed chat events, decision chips, and the artifact heads via
 * artifact.version_created / artifact.compliance_completed.
 *
 * Re-sync envelopes are snapshots: head-seq stamped and not journaled
 * (journal.ts documents the arithmetic). The client treats the re-synced
 * state as an authoritative replacement.
 */
import type {
  ArtifactRepository,
  ChipSet,
  ComplianceState,
  TranscriptRecord,
  TranscriptRepository,
  VersionSummary,
} from "@studio/contract";

import type { ArtifactPipeline } from "../../artifact-pipeline/index.js";
import type { Logger } from "../../logging/create-logger.js";
import type { WsConnection } from "../../ws/connection-gateway.js";
import type { WorkspaceHub } from "./journal.js";

// Transcript record payloads are opaque to the store; their semantics are
// owned by agent-orchestration (src/agent/transcript.ts). The relevant
// fields are re-derived structurally here rather than importing another
// capability's internals.

interface ChipsRecordPayload {
  chipSet: ChipSet;
}

interface MessageRecordPayload {
  role: "user" | "assistant";
  text: string;
  messageId: string;
  artifactId: string | null;
  status: "ok" | "cancelled" | "refused" | "failed";
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asMessagePayload(payload: unknown): MessageRecordPayload | null {
  if (!isRecordObject(payload)) {
    return null;
  }
  if (
    (payload["role"] !== "user" && payload["role"] !== "assistant") ||
    typeof payload["text"] !== "string" ||
    typeof payload["messageId"] !== "string"
  ) {
    return null;
  }
  return payload as unknown as MessageRecordPayload;
}

function asChipsPayload(payload: unknown): ChipsRecordPayload | null {
  if (!isRecordObject(payload) || !isRecordObject(payload["chipSet"])) {
    return null;
  }
  const chipSet = payload["chipSet"];
  if (
    typeof chipSet["artifactId"] !== "string" ||
    typeof chipSet["messageId"] !== "string" ||
    !Array.isArray(chipSet["chips"])
  ) {
    return null;
  }
  return payload as unknown as ChipsRecordPayload;
}

export interface ResyncDeps {
  transcripts: TranscriptRepository;
  artifacts: ArtifactRepository;
  pipeline: ArtifactPipeline;
  logger: Logger;
}

function complianceCounts(
  state: ComplianceState,
): { passed?: number; failed?: number; advisory?: number; reason?: string } {
  if (state.status === "completed") {
    return {
      passed: state.report.passed,
      failed: state.report.failed,
      advisory: state.report.advisory,
    };
  }
  if (state.status === "unavailable") {
    return { reason: state.reason };
  }
  return {};
}

/**
 * Emit the workspace's current state to `connection`. bridge/auth status
 * snapshots are the caller's responsibility (they precede this and carry
 * the attach requestId echo).
 */
export async function resyncWorkspaceState(
  deps: ResyncDeps,
  hub: WorkspaceHub,
  connection: WsConnection,
): Promise<void> {
  const { workspaceId } = hub;
  const log = deps.logger.child({
    component: "ws-resync",
    workspaceId,
    connectionId: connection.connectionId,
  });

  // ── Transcript as completed chat events ──
  const transcript = await deps.transcripts.read(workspaceId);
  if (transcript.ok) {
    emitTranscript(hub, connection, transcript.value);
  } else {
    log.warn(
      { error: transcript.error },
      "transcript unreadable during re-sync; chat history omitted",
    );
  }

  // ── Artifact heads ──
  const artifacts = await deps.artifacts.list(workspaceId);
  if (!artifacts.ok) {
    log.warn(
      { error: artifacts.error },
      "artifact listing failed during re-sync; artifact state omitted",
    );
    return;
  }
  for (const artifact of artifacts.value) {
    if (artifact.headVersion === null) {
      continue;
    }
    const versions = await deps.pipeline.listVersions(workspaceId, artifact.id);
    if (!versions.ok) {
      log.warn(
        { artifactId: artifact.id, error: versions.error },
        "version listing failed during re-sync; artifact omitted",
      );
      continue;
    }
    const head: VersionSummary | undefined = versions.value.find(
      (entry) => entry.number === artifact.headVersion,
    );
    if (head === undefined) {
      continue;
    }
    hub.sendSnapshot(connection, {
      type: "artifact.version_created",
      payload: { artifactId: artifact.id, version: head },
    });
    if (head.compliance.status !== "pending") {
      const compliance = await deps.pipeline.getCompliance(
        workspaceId,
        artifact.id,
        head.number,
      );
      hub.sendSnapshot(connection, {
        type: "artifact.compliance_completed",
        payload: {
          artifactId: artifact.id,
          version: head.number,
          status:
            head.compliance.status === "completed" ? "completed" : "unavailable",
          ...(compliance.ok ? complianceCounts(compliance.value) : {}),
        },
      });
    }
  }
}

function emitTranscript(
  hub: WorkspaceHub,
  connection: WsConnection,
  records: TranscriptRecord[],
): void {
  for (const record of records) {
    if (record.kind === "message") {
      const message = asMessagePayload(record.payload);
      if (message === null || message.role !== "assistant") {
        continue;
      }
      hub.sendSnapshot(connection, {
        type: "chat.message_started",
        payload: {
          messageId: message.messageId,
          workspaceId: hub.workspaceId,
          ...(message.artifactId !== null
            ? { artifactId: message.artifactId }
            : {}),
        },
      });
      if (message.text !== "") {
        hub.sendSnapshot(connection, {
          type: "chat.assistant_delta",
          payload: { messageId: message.messageId, delta: message.text },
        });
      }
      hub.sendSnapshot(connection, {
        type: "chat.message_completed",
        payload: {
          messageId: message.messageId,
          artifactRefs: [],
          cancelled: message.status === "cancelled",
        },
      });
    } else if (record.kind === "decision_chips") {
      const chips = asChipsPayload(record.payload);
      if (chips === null) {
        continue;
      }
      hub.sendSnapshot(connection, {
        type: "chips.updated",
        payload: {
          messageId: chips.chipSet.messageId,
          artifactId: chips.chipSet.artifactId,
          chips: chips.chipSet.chips,
        },
      });
    }
  }
}
