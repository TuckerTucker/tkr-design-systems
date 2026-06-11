/**
 * WebSocket envelope contract — the two envelope shapes from
 * _planning/architecture.md ("WebSocket envelope", binding).
 *
 * Owned by studio-api. `seq` exists on the server envelope only: a
 * monotonic per-workspace sequence number backing reconnect-with-resume.
 * Client code cannot emit a sequence number by construction.
 */

/** Client → server envelope; no sequence number by construction. */
export interface ClientEnvelope<TType extends string, TPayload> {
  type: TType;
  /** uuid — echoed back on the server's responses when applicable. */
  requestId?: string;
  payload: TPayload;
}

/** Server → client envelope; `seq` backs reconnect-with-resume. */
export interface ServerEnvelope<TType extends string, TPayload> {
  type: TType;
  /** uuid — echoes the client request when applicable. */
  requestId?: string;
  /** Monotonic per-workspace sequence for reconnect-with-resume. */
  seq: number;
  payload: TPayload;
}
