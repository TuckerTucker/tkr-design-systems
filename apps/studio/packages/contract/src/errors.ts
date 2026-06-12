/**
 * Structured error contract — one shape shared by HTTP error bodies and the
 * chat.error WS event. Owned by studio-api.
 *
 * Every error names what failed and how to fix it, in place — never stack
 * traces, internal paths, or dependency internals (architecture contract:
 * "Logging and errors").
 */

/**
 * The complete error vocabulary of the studio API. Codes produced at the
 * protocol boundary (validation, sessions, routing) and codes projected
 * from domain seams (agent-orchestration, artifact-pipeline, mcp-bridge,
 * workspace-store) live in one literal union so clients can switch
 * exhaustively.
 */
export type ApiErrorCode =
  // ── Boundary validation ──
  /** Malformed JSON, unknown WS message type, or an invalid WS payload. */
  | "invalid_message"
  /** An HTTP body, query, or route param failed validation. */
  | "invalid_field"
  /** Request or message body exceeds the accepted size. */
  | "payload_too_large"
  // ── WS session ──
  /** chat.send / chat.cancel / chip.update before any workspace.attach. */
  | "not_attached"
  /** A turn is already in flight on this workspace. */
  | "turn_in_progress"
  /** chat.cancel named a turn that is not in flight. */
  | "turn_not_active"
  /** chip.update named a messageId with no recorded chips. */
  | "chips_not_found"
  // ── Addressing ──
  | "workspace_not_found"
  | "artifact_not_found"
  | "version_not_found"
  /** Compliance has not completed for the addressed version yet. */
  | "compliance_pending"
  /** Compliance could not run (bridge outage); re-runnable. */
  | "compliance_unavailable"
  | "system_not_found"
  | "component_not_found"
  // ── Agent seam (agent-orchestration's AgentErrorCode projection) ──
  | "auth_missing"
  | "auth_invalid"
  | "cancelled"
  | "mcp_unavailable"
  | "tool_failed"
  | "blueprint_invalid"
  | "chip_invalid"
  | "agent_failed"
  // ── Infrastructure ──
  /** Library request with the bridge down and no cached entry. */
  | "bridge_unavailable"
  /** workspace-store failure (disk error, corruption). */
  | "store_failure"
  /** Unexpected server failure; internals logged, never sent. */
  | "internal_error";

/** The structured error shape — HTTP `ErrorResponse` body and `chat.error`. */
export interface ApiError {
  /** Machine-readable code, e.g. "workspace_not_found". */
  code: ApiErrorCode;
  /** What failed. */
  message: string;
  /** How to fix it, in place. */
  fix: string;
  /** Offending input field when applicable. */
  field?: string;
}

/** Body of every non-2xx JSON response. */
export interface ErrorResponse {
  error: ApiError;
}
