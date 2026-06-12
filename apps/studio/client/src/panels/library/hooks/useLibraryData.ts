/**
 * Data fetching + cache + staleness hook — one instance per library
 * endpoint per section. Behavior (story: designer-browses-with-bridge-down):
 *
 * - cache hit → renders immediately from cache (instant switch-back)
 * - cache miss → fetches; success populates the cache
 * - fetch failure with a cached entry → keeps serving the cache, stale
 * - bridge down (panel marks the cache stale) → cached data stays
 *   browsable with staleness surfaced; no refetch until recovery
 * - bridge recovery → stale entries refetch automatically and the
 *   indicator clears without user action
 * - in-flight fetches abort when the key changes (rapid system switching
 *   never lands a stale response — guarded by key + cancellation)
 */
import { useCallback, useEffect, useState } from "react";

import type { ApiError } from "@studio/contract";

import type { LibraryResult } from "../model/libraryApi.js";
import type { LibraryCache } from "../model/libraryCache.js";

export type LibraryDataState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; value: T; stale: boolean; fetchedAt: string }
  | { status: "error"; error: ApiError };

export interface UseLibraryDataOptions<T> {
  cache: LibraryCache;
  /** null = nothing to load (no active system yet). */
  cacheKey: string | null;
  /** Stable identity (useCallback) — effect dependency. */
  fetcher: (signal: AbortSignal) => Promise<LibraryResult<T>>;
  /** True while bridge.status reports restarting/failed/stopped. */
  bridgeDown: boolean;
}

export interface LibraryData<T> {
  state: LibraryDataState<T>;
  /** Manual refetch (inline retry affordance on error states). */
  retry(): void;
}

export function useLibraryData<T>(
  options: UseLibraryDataOptions<T>,
): LibraryData<T> {
  const { cache, cacheKey, fetcher, bridgeDown } = options;
  const [state, setState] = useState<LibraryDataState<T>>({ status: "idle" });
  const [nonce, setNonce] = useState(0);

  const retry = useCallback((): void => {
    setNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    if (cacheKey === null) {
      setState({ status: "idle" });
      return;
    }
    const cached = cache.get<T>(cacheKey);
    if (cached !== undefined) {
      // Display staleness derives from bridgeDown directly (not only the
      // cache flag): the panel's markAllStale effect runs AFTER child
      // effects in the same commit, so reading cached.stale alone would
      // miss the outage that triggered this very re-run.
      setState({
        status: "ready",
        value: cached.data,
        stale: cached.stale || bridgeDown,
        fetchedAt: cached.fetchedAt,
      });
      // Fresh, or stale while the bridge is still down: keep serving the
      // cache. Stale with the bridge back up: refetch below.
      if (!cached.stale || bridgeDown) {
        return;
      }
    } else {
      setState({ status: "loading" });
    }

    const controller = new AbortController();
    let cancelled = false;
    void fetcher(controller.signal).then((result) => {
      if (cancelled) {
        return;
      }
      if (result.ok) {
        cache.set(cacheKey, result.value);
        const entry = cache.get<T>(cacheKey);
        setState({
          status: "ready",
          value: result.value,
          stale: false,
          fetchedAt: entry?.fetchedAt ?? new Date().toISOString(),
        });
        return;
      }
      if (result.aborted === true) {
        return;
      }
      const fallback = cache.get<T>(cacheKey);
      if (fallback !== undefined) {
        setState({
          status: "ready",
          value: fallback.data,
          stale: true,
          fetchedAt: fallback.fetchedAt,
        });
      } else {
        setState({ status: "error", error: result.error });
      }
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [cache, cacheKey, fetcher, bridgeDown, nonce]);

  return { state, retry };
}
