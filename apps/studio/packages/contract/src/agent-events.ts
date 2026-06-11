/**
 * Agent orchestration contract — the typed event stream the conversational
 * core emits, the routing/decision models behind it, and the domain chip
 * shapes shared with studio-api.
 *
 * Owned by agent-orchestration. Consumers (studio-api, the client) import
 * these types from `@studio/contract`; no capability redeclares them.
 *
 * ArtifactSource is imported from artifact.ts (owned by artifact-pipeline) —
 * never redeclared here (architecture.md, Contract package ownership).
 */
import type { ArtifactSource } from "./artifact.js";

// ── Intent routing ──

/** The four conversational routes; chosen by agent judgment per turn. */
export type Intent = "generate" | "substitute" | "compose" | "converse";

/**
 * The routing decision recorded for every turn — persisted as a
 * TranscriptRecord of kind "routing_result" and carried on
 * message_completed.
 */
export interface RoutingResult {
  intent: Intent;
  /** Why this route was taken. */
  rationale: string;
  /** Existing artifact targeted; null for new artifacts and converse. */
  artifactId: string | null;
  /** Populated for tool-bearing intents; null for converse. */
  defaults: DecisionDefaults | null;
}

/** The agent's default selections, surfaced as editable decision chips. */
export interface DecisionDefaults {
  /** Registered system id (e.g. "swiss"). */
  system: string;
  /** Pattern id; null while the compose flow assembles. */
  layoutId: string | null;
  platform: "mobile" | "desktop";
}

// ── Decision chips ──

export type ChipKind = "system" | "layout" | "platform";

export interface DecisionChip {
  kind: ChipKind;
  value: string;
  /**
   * Real vocabularies: registry systems, routing_request patterns,
   * ["mobile","desktop"].
   */
  options: string[];
  /** Which step a change to this chip re-runs. */
  rerunStep: "generate" | "substitute" | "compose";
}

export interface ChipSet {
  artifactId: string;
  /** The agent turn that produced these chips. */
  messageId: string;
  chips: DecisionChip[];
}

/**
 * Domain chip-update shape. The wire payload is ChipUpdatePayload
 * { messageId, kind, value } (studio-api, ws-messages.ts); the studio-api
 * relay resolves artifactId by looking up the ChipSet previously emitted
 * for that messageId, then hands the session this domain ChipUpdate.
 */
export interface ChipUpdate {
  requestId: string;
  artifactId: string;
  kind: ChipKind;
  /** Must be one of the chip's options (validated at the boundary). */
  value: string;
}

// ── Tools and provenance ──

/** The five tools the agent drives over its own MCP connection. */
export type AgentToolName =
  | "wf_generate"
  | "wf_select_layout"
  | "wf_build_substitution_request"
  | "wf_apply_substitutions"
  | "wf_assemble_from_blueprint";

/** Provenance carried on artifact_produced, consumed by artifact-pipeline. */
export interface Provenance {
  brief: string;
  tool: AgentToolName;
  /** layout_id, system, platform, substitutions or blueprint — no secrets. */
  parameters: Record<string, unknown>;
  /** null for a brand-new artifact. */
  parentArtifactVersion: number | null;
}

// ── Errors ──

export type AgentErrorCode =
  | "auth_missing"
  | "auth_invalid"
  | "session_busy"
  | "cancelled"
  | "mcp_unavailable"
  | "tool_failed"
  | "blueprint_invalid"
  /** chip.update rejected at the boundary (value outside the chip's options). */
  | "chip_invalid"
  | "agent_failed";

// ── The emitted event stream ──

/**
 * The typed event stream one turn emits. Ordering guarantee: a turn begins
 * with message_started and ends with exactly one of message_completed or
 * error; deltas and tool events are strictly ordered between. The only
 * exception is a turn refused before it starts (busy, keyless): it is a
 * single error event. studio-api maps these onto the WS envelope.
 */
export type AgentEvent =
  | { type: "message_started"; requestId: string; messageId: string }
  | {
      type: "assistant_delta";
      requestId: string;
      messageId: string;
      text: string;
    }
  | {
      type: "tool_started";
      requestId: string;
      toolUseId: string;
      toolName: AgentToolName;
      summary: string;
    }
  | {
      type: "tool_finished";
      requestId: string;
      toolUseId: string;
      ok: boolean;
      summary: string;
    }
  | { type: "chips_updated"; requestId: string; chipSet: ChipSet }
  | {
      type: "artifact_produced";
      requestId: string;
      artifactId: string;
      source: ArtifactSource;
      provenance: Provenance;
    }
  | {
      type: "message_completed";
      requestId: string;
      messageId: string;
      routing: RoutingResult;
    }
  | {
      type: "error";
      requestId: string;
      code: AgentErrorCode;
      message: string;
      /** How to fix it, surfaceable in place. */
      fix: string;
    };
