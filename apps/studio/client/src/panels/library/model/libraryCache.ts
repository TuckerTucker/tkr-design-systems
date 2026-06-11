/**
 * Client-side library cache — payloads keyed by endpoint+system, stamped
 * with fetched-at metadata. Staleness is flipped on bridge.status events
 * (the panel keeps browsing cached data through an outage, indicated in
 * place) and cleared when a refetch lands after recovery.
 */

export interface CachedLibraryData<T> {
  data: T;
  /** ISO 8601 fetch timestamp. */
  fetchedAt: string;
  /** True when the bridge went down after this entry was fetched. */
  stale: boolean;
}

export interface LibraryCache {
  get<T>(key: string): CachedLibraryData<T> | undefined;
  set<T>(key: string, data: T): void;
  /** Flip every entry stale (bridge went down). */
  markAllStale(): void;
  has(key: string): boolean;
  size(): number;
  clear(): void;
}

export function createLibraryCache(
  now: () => string = () => new Date().toISOString(),
): LibraryCache {
  const entries = new Map<string, CachedLibraryData<unknown>>();
  return {
    get<T>(key: string): CachedLibraryData<T> | undefined {
      return entries.get(key) as CachedLibraryData<T> | undefined;
    },
    set<T>(key: string, data: T): void {
      entries.set(key, { data, fetchedAt: now(), stale: false });
    },
    markAllStale(): void {
      for (const entry of entries.values()) {
        entry.stale = true;
      }
    },
    has(key: string): boolean {
      return entries.has(key);
    },
    size(): number {
      return entries.size;
    },
    clear(): void {
      entries.clear();
    },
  };
}
