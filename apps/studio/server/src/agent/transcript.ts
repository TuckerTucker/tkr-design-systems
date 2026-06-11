/**
 * Transcript persistence adapter — the typed payloads agent-orchestration
 * writes through the injected TranscriptRepository (workspace-store treats
 * payloads as opaque; their semantics live here), plus the degradation
 * policy: a persistence failure never blocks the turn — it logs structured
 * and the events still reach the client.
 *
 * Secrets are excluded by construction: tool inputs are sanitized and the
 * API key never appears on any payload object.
 */
import { randomUUID } from "node:crypto";

import type {
  ChipSet,
  RoutingResult,
  TranscriptRecord,
  TranscriptRecordKind,
  TranscriptRepository,
} from "@studio/contract";

import type { Logger } from "../logging/create-logger.js";
import type { ObservedToolCall } from "./events.js";

export type TurnStatus = "ok" | "cancelled" | "refused" | "failed";

/** Payload of kind "message". */
export interface MessagePayload {
  role: "user" | "assistant";
  text: string;
  requestId: string;
  messageId: string;
  artifactId: string | null;
  status: TurnStatus;
}

/** Payload of kind "tool_call" (secrets excluded). */
export interface ToolCallPayload {
  toolUseId: string;
  toolName: string;
  input: Record<string, unknown>;
  ok: boolean;
  summary: string;
  errors: string[];
  warnings: string[];
  artifactId: string | null;
  requestId: string;
}

/** Payload of kind "decision_chips". */
export interface ChipsPayload {
  requestId: string;
  chipSet: ChipSet;
}

/** Payload of kind "routing_result". */
export interface RoutingPayload extends RoutingResult {
  requestId: string;
  messageId: string;
  /** The user text behind this turn (the brief for producing turns). */
  brief: string | null;
  /** Version number this turn landed; null for converse/failed turns. */
  producedVersion: number | null;
  /** Substitutions applied this turn (substitute flow / replays). */
  substitutions: Array<{ find: string; replace: string }>;
}

const SECRET_KEY_PATTERN = /key|token|secret|password|authorization|credential/i;

/** Drop secret-shaped keys from a tool input before persistence. */
export function sanitizeToolInput(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      continue;
    }
    sanitized[key] =
      typeof value === "object" && value !== null && !Array.isArray(value)
        ? sanitizeToolInput(value as Record<string, unknown>)
        : value;
  }
  return sanitized;
}

export interface TranscriptWriter {
  message(payload: MessagePayload): Promise<void>;
  toolCall(args: {
    requestId: string;
    artifactId: string | null;
    call: ObservedToolCall;
  }): Promise<void>;
  chips(payload: ChipsPayload): Promise<void>;
  routing(payload: RoutingPayload): Promise<void>;
}

export function createTranscriptWriter(
  transcripts: TranscriptRepository,
  workspaceId: string,
  logger: Logger,
): TranscriptWriter {
  const log = logger.child({ component: "agent-transcript", workspaceId });

  async function append(
    kind: TranscriptRecordKind,
    payload: unknown,
  ): Promise<void> {
    const record: TranscriptRecord = {
      id: randomUUID(),
      kind,
      timestamp: new Date().toISOString(),
      payload,
    };
    const result = await transcripts.append(workspaceId, record);
    if (!result.ok) {
      // Degraded persistence never blocks the turn (architecture contract).
      log.error(
        { kind, error: result.error },
        "transcript append failed; turn continues degraded",
      );
    }
  }

  return {
    message: (payload) => append("message", payload),
    toolCall: ({ requestId, artifactId, call }) =>
      append("tool_call", {
        toolUseId: call.toolUseId,
        toolName: call.toolName,
        input: sanitizeToolInput(call.input),
        ok: call.ok,
        summary: call.summary,
        errors: call.errors,
        warnings: call.warnings,
        artifactId,
        requestId,
      } satisfies ToolCallPayload),
    chips: (payload) => append("decision_chips", payload),
    routing: (payload) => append("routing_result", payload),
  };
}
