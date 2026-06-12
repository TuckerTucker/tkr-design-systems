/**
 * Bridge contract — canonical home for the MCP bridge's typed result model
 * and status surface.
 *
 * Owned by mcp-bridge. Consumers (artifact-pipeline, studio-api, the client)
 * import these types from `@studio/contract`; no capability redeclares them.
 * `BridgeState` is canonical here — consumers handle all five states.
 *
 * Errors never cross the bridge seam as thrown exceptions: every bridge call
 * resolves to a `BridgeResult`.
 */

/**
 * Failure classification for a bridge call.
 *
 * - `protocol` — transport/JSON-RPC failure, an `isError` tool response, or
 *   unparseable tool content
 * - `tool` — the tool executed and reported `ok: false` (skill-level failure)
 * - `timeout` — the per-call timeout expired before the tool responded
 * - `cancelled` — the caller aborted the call via its `AbortSignal`
 * - `bridge_down` — the bridge is failed/stopped, or its restart budget is
 *   exhausted; the call was never (or can no longer be) dispatched
 */
export type BridgeErrorKind =
  | "protocol"
  | "tool"
  | "timeout"
  | "cancelled"
  | "bridge_down";

export interface BridgeError {
  kind: BridgeErrorKind;
  /** Human-readable description, suitable for in-place display. */
  message: string;
  /**
   * Stable skill error code when `kind === "tool"`, e.g. SYSTEM_NOT_FOUND,
   * SPEC_FILE_MISSING, SPEC_PARSE_FAILED, SCHEMA_VALIDATION_FAILED,
   * REFERENCED_FILE_MISSING, INVALID_PATH, RULESET_UNKNOWN, INTERNAL.
   * Absent for flat-shape string errors and for non-tool kinds.
   */
  code?: string;
  /** Skill error detail passthrough plus bridge diagnostic context. */
  detail?: Record<string, unknown>;
}

/** Non-fatal warning attached to a successful skill result. */
export interface BridgeWarning {
  code: string;
  message: string;
  detail: Record<string, unknown>;
}

/**
 * The bridge seam result: success carries the typed payload plus any skill
 * warnings; failure carries exactly one classified BridgeError.
 */
export type BridgeResult<T> =
  | { ok: true; value: T; warnings: BridgeWarning[] }
  | { ok: false; error: BridgeError };

/**
 * Bridge lifecycle state (canonical five-state machine):
 *
 * - `starting` — start() in progress: spawning the subprocess and handshaking
 * - `up` — connected; calls dispatch
 * - `restarting` — subprocess died; supervised respawn with backoff underway
 * - `failed` — spawn/handshake failed or the restart budget is exhausted;
 *   terminal until an explicit start()
 * - `stopped` — not started yet, or stop() completed
 */
export type BridgeState =
  | "starting"
  | "up"
  | "restarting"
  | "failed"
  | "stopped";

/**
 * Bridge status snapshot — reported on GET /api/health (`bridge` field) and
 * pushed to clients as the payload of the `bridge.status` WS event:
 * `{ type: "bridge.status", payload: BridgeStatus }`.
 */
export interface BridgeStatus {
  state: BridgeState;
  /** Restart attempts since process start (never resets). */
  restartCount: number;
  /** Most recent crash/spawn/handshake failure summary. */
  lastError?: string;
  /** ISO 8601 timestamp of the current state's start. */
  since: string;
}
