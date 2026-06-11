/**
 * Silent layout persistence — no save button anywhere.
 *
 * - schedule() debounces a burst of arrangement changes into one PUT
 * - PUT failure: local state stays authoritative; retries continue in the
 *   background with capped backoff; the sync status is observable so the
 *   panel settings menu can show it inline (never a toast, never blocking)
 * - latest-wins: a newer layout scheduled mid-retry replaces the payload
 *
 * Timers are injected for deterministic tests.
 */
import type { LayoutPreference } from "@studio/contract";

import type { ApiClient } from "../api/apiClient.js";

export type SyncStatus = "synced" | "saving" | "retrying";

export interface LayoutPersistence {
  /** Debounce this layout into the next PUT. */
  schedule(preference: LayoutPreference): void;
  /** Send any pending layout now (used on pagehide). */
  flush(): Promise<void>;
  status(): SyncStatus;
  onStatus(handler: (status: SyncStatus) => void): () => void;
  dispose(): void;
}

export interface LayoutPersistenceOptions {
  api: Pick<ApiClient, "putPreferences">;
  debounceMs?: number;
  retryInitialMs?: number;
  retryMaxMs?: number;
  setTimeoutImpl?: typeof setTimeout;
  clearTimeoutImpl?: typeof clearTimeout;
}

export function createLayoutPersistence(
  options: LayoutPersistenceOptions,
): LayoutPersistence {
  const debounceMs = options.debounceMs ?? 400;
  const retryInitialMs = options.retryInitialMs ?? 1_000;
  const retryMaxMs = options.retryMaxMs ?? 15_000;
  const setT = options.setTimeoutImpl ?? setTimeout;
  const clearT = options.clearTimeoutImpl ?? clearTimeout;

  let pending: LayoutPreference | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlightPromise: Promise<void> | null = null;
  let retryDelay = retryInitialMs;
  let currentStatus: SyncStatus = "synced";
  let disposed = false;
  const handlers = new Set<(status: SyncStatus) => void>();

  function setStatus(status: SyncStatus): void {
    if (status === currentStatus) {
      return;
    }
    currentStatus = status;
    for (const handler of handlers) {
      handler(status);
    }
  }

  function clearTimer(): void {
    if (timer !== null) {
      clearT(timer);
      timer = null;
    }
  }

  function send(): Promise<void> {
    if (disposed || pending === null) {
      return inFlightPromise ?? Promise.resolve();
    }
    if (inFlightPromise !== null) {
      return inFlightPromise;
    }
    const payload = pending;
    pending = null;
    setStatus("saving");
    inFlightPromise = (async (): Promise<void> => {
      const result = await options.api.putPreferences(payload);
      inFlightPromise = null;
      if (disposed) {
        return;
      }
      if (result.ok) {
        retryDelay = retryInitialMs;
        if (pending !== null) {
          // A newer layout arrived while saving — keep going.
          await send();
          return;
        }
        setStatus("synced");
        return;
      }
      // Local state stays authoritative; retry the freshest layout.
      if (pending === null) {
        pending = payload;
      }
      setStatus("retrying");
      clearTimer();
      timer = setT(() => {
        timer = null;
        void send();
      }, retryDelay);
      retryDelay = Math.min(retryMaxMs, retryDelay * 2);
    })();
    return inFlightPromise;
  }

  return {
    schedule(preference: LayoutPreference): void {
      if (disposed) {
        return;
      }
      pending = preference;
      clearTimer();
      timer = setT(() => {
        timer = null;
        void send();
      }, debounceMs);
    },
    async flush(): Promise<void> {
      clearTimer();
      // Let any in-flight write settle, then write whatever is pending.
      if (inFlightPromise !== null) {
        await inFlightPromise;
      }
      if (pending !== null) {
        clearTimer();
        await send();
      }
    },
    status: () => currentStatus,
    onStatus(handler: (status: SyncStatus) => void): () => void {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    dispose(): void {
      disposed = true;
      clearTimer();
      handlers.clear();
    },
  };
}
