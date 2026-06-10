/**
 * WebSocket message contract — every client→server and server→client
 * message type from _planning/architecture.md, declared once. Owned by
 * studio-api.
 *
 * Imported, never redeclared (contract ownership table):
 * - ChipKind / DecisionChip — agent-events.ts (agent-orchestration)
 * - BridgeStatus — bridge.ts (mcp-bridge); the bridge.status payload IS
 *   BridgeStatus
 * - VersionSummary — artifact.ts (artifact-pipeline)
 *
 * No WS type string appears anywhere outside this module — server and
 * client construct messages through these unions, so a typo is a compile
 * error, not a runtime mystery.
 */
import type { ChipKind, DecisionChip } from "./agent-events.js";
import type { VersionSummary } from "./artifact.js";
import type { BridgeStatus } from "./bridge.js";
import type { ClientEnvelope, ServerEnvelope } from "./envelope.js";
import type { ApiError } from "./errors.js";

// ── Message type vocabularies (the architecture.md lists, verbatim) ──

export const CLIENT_MESSAGE_TYPES = [
  "workspace.attach",
  "chat.send",
  "chat.cancel",
  "chip.update",
] as const;

export type ClientMessageType = (typeof CLIENT_MESSAGE_TYPES)[number];

export const SERVER_MESSAGE_TYPES = [
  "chat.message_started",
  "chat.assistant_delta",
  "chat.tool_started",
  "chat.tool_finished",
  "chat.message_completed",
  "chat.error",
  "chips.updated",
  "artifact.version_created",
  "artifact.compliance_completed",
  "bridge.status",
  "auth.status",
] as const;

export type ServerMessageType = (typeof SERVER_MESSAGE_TYPES)[number];

// ── Client → server payloads ──

export interface WorkspaceAttachPayload {
  workspaceId: string;
  /** Last seq the client saw; omit for first attach / full re-sync. */
  lastEventSeq?: number;
}

export interface ChatSendPayload {
  text: string;
  /** Scope the turn to an artifact's conversation context. */
  artifactId?: string;
  /**
   * Library references attached by the composer; the agent receives them
   * as grounding. Forward-compatible opaque entries: library-panel
   * (Phase 2) declares the LibraryReference shape in library.ts — until
   * then the relay passes entries through verbatim and never interprets
   * them.
   */
  references?: readonly unknown[];
}

export interface ChatCancelPayload {
  /** The in-flight turn to abort (from chat.message_started). */
  messageId: string;
}

/**
 * chip.update carries no artifactId on the wire: the studio-api relay
 * resolves it by looking up the ChipSet previously emitted for this
 * messageId (every ChipSet carries { artifactId, messageId }), then hands
 * agent-orchestration its domain ChipUpdate { requestId, artifactId, kind,
 * value }. The field is named `kind` on both sides (architecture.md).
 */
export interface ChipUpdatePayload {
  messageId: string;
  kind: ChipKind;
  value: string;
}

export type ClientMessage =
  | ClientEnvelope<"workspace.attach", WorkspaceAttachPayload>
  | ClientEnvelope<"chat.send", ChatSendPayload>
  | ClientEnvelope<"chat.cancel", ChatCancelPayload>
  | ClientEnvelope<"chip.update", ChipUpdatePayload>;

// ── Server → client payloads ──

export interface MessageStartedPayload {
  messageId: string;
  workspaceId: string;
  /** The artifact framing this turn's context, when one exists. */
  artifactId?: string;
}

export interface AssistantDeltaPayload {
  messageId: string;
  delta: string;
}

export interface ToolStartedPayload {
  messageId: string;
  toolCallId: string;
  /** e.g. "wf_generate". */
  tool: string;
  /** Human-readable, e.g. "Generating … with layout dashboard". */
  summary: string;
}

export interface ToolFinishedPayload {
  messageId: string;
  toolCallId: string;
  tool: string;
  status: "ok" | "error";
  detail?: string;
}

export interface ArtifactRef {
  artifactId: string;
  version: number;
}

export interface MessageCompletedPayload {
  messageId: string;
  /** Versions this turn landed (empty for plain conversation). */
  artifactRefs: ArtifactRef[];
  cancelled: boolean;
}

export interface ChatErrorPayload {
  /** Absent for protocol-level rejections (no turn was started). */
  messageId?: string;
  error: ApiError;
}

export interface ChipsUpdatedPayload {
  messageId: string;
  artifactId: string;
  chips: DecisionChip[];
}

export interface VersionCreatedPayload {
  artifactId: string;
  /** The landed version's summary (compliance reads pending at creation). */
  version: VersionSummary;
}

/**
 * Emitted when the per-version compliance run settles. Counts arrive on
 * the event (emitted synchronously by the pipeline, so stream ordering
 * holds); the full ComplianceResponse with rule results and nodeIds is the
 * GET …/versions/:n/compliance projection.
 */
export interface ComplianceCompletedPayload {
  artifactId: string;
  version: number;
  status: "completed" | "unavailable";
  passed?: number;
  failed?: number;
  advisory?: number;
  /** Present when status is "unavailable". */
  reason?: string;
}

/** bridge.status carries mcp-bridge's BridgeStatus verbatim (bridge.ts). */
export type BridgeStatusPayload = BridgeStatus;

export type AuthState = "configured" | "missing" | "invalid";

export interface AuthStatusPayload {
  state: AuthState;
  /** How to fix, e.g. "set ANTHROPIC_API_KEY in studio/.env". */
  fix?: string;
}

export type ServerMessage =
  | ServerEnvelope<"chat.message_started", MessageStartedPayload>
  | ServerEnvelope<"chat.assistant_delta", AssistantDeltaPayload>
  | ServerEnvelope<"chat.tool_started", ToolStartedPayload>
  | ServerEnvelope<"chat.tool_finished", ToolFinishedPayload>
  | ServerEnvelope<"chat.message_completed", MessageCompletedPayload>
  | ServerEnvelope<"chat.error", ChatErrorPayload>
  | ServerEnvelope<"chips.updated", ChipsUpdatedPayload>
  | ServerEnvelope<"artifact.version_created", VersionCreatedPayload>
  | ServerEnvelope<"artifact.compliance_completed", ComplianceCompletedPayload>
  | ServerEnvelope<"bridge.status", BridgeStatusPayload>
  | ServerEnvelope<"auth.status", AuthStatusPayload>;
