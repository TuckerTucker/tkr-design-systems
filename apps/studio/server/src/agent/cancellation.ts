/**
 * Cancellation wiring — one in-flight run per workspace, an AbortController
 * per run, and the typed CancelResult semantics: cancelling an unknown or
 * already-completed requestId is a typed no-op, never an exception.
 */

export type CancelResult =
  | { ok: true; cancelled: true }
  | { ok: true; cancelled: false; reason: "not_running" | "already_completed" };

/** Bound on remembered completed requestIds (already_completed answers). */
const COMPLETED_MEMORY = 200;

export interface CancellationTracker {
  /** Register the in-flight run; returns its AbortController. */
  begin(requestId: string): AbortController;
  /** Mark the run finished (completed, failed, or cancelled). */
  finish(requestId: string): void;
  /** The active requestId, or null when idle. */
  inflight(): string | null;
  cancel(requestId: string): CancelResult;
  /** Abort whatever is in flight (session disposal). */
  abortInflight(): void;
}

export function createCancellationTracker(): CancellationTracker {
  let active: { requestId: string; controller: AbortController } | null = null;
  const completed: string[] = [];

  return {
    begin(requestId) {
      const controller = new AbortController();
      active = { requestId, controller };
      return controller;
    },
    finish(requestId) {
      if (active !== null && active.requestId === requestId) {
        active = null;
      }
      completed.push(requestId);
      if (completed.length > COMPLETED_MEMORY) {
        completed.splice(0, completed.length - COMPLETED_MEMORY);
      }
    },
    inflight: () => (active !== null ? active.requestId : null),
    cancel(requestId) {
      if (active !== null && active.requestId === requestId) {
        active.controller.abort();
        return { ok: true, cancelled: true };
      }
      if (completed.includes(requestId)) {
        return { ok: true, cancelled: false, reason: "already_completed" };
      }
      return { ok: true, cancelled: false, reason: "not_running" };
    },
    abortInflight() {
      if (active !== null) {
        active.controller.abort();
      }
    },
  };
}
