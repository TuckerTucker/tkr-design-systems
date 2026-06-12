/**
 * Client-side library cache — fetched-at stamping, the bridge-down stale
 * flip, and per-system retention (instant switch-back).
 */
import { describe, expect, it } from "vitest";

import { createLibraryCache } from "../../../src/panels/library/model/libraryCache.js";

describe("library cache", () => {
  it("stamps entries with the injected clock and serves them back", () => {
    const cache = createLibraryCache(() => "2026-06-10T12:00:00.000Z");
    cache.set("tokens:swiss", { palette: [] });
    const entry = cache.get<{ palette: never[] }>("tokens:swiss");
    expect(entry?.fetchedAt).toBe("2026-06-10T12:00:00.000Z");
    expect(entry?.stale).toBe(false);
    expect(entry?.data).toEqual({ palette: [] });
  });

  it("returns undefined for a cold key", () => {
    const cache = createLibraryCache();
    expect(cache.get("missing")).toBeUndefined();
    expect(cache.has("missing")).toBe(false);
  });

  it("flips every entry stale when the bridge goes down", () => {
    const cache = createLibraryCache();
    cache.set("tokens:swiss", 1);
    cache.set("components:terminal", 2);
    cache.markAllStale();
    expect(cache.get("tokens:swiss")?.stale).toBe(true);
    expect(cache.get("components:terminal")?.stale).toBe(true);
  });

  it("clears staleness when a refetch lands (set overwrites)", () => {
    const cache = createLibraryCache();
    cache.set("tokens:swiss", 1);
    cache.markAllStale();
    cache.set("tokens:swiss", 2);
    expect(cache.get("tokens:swiss")?.stale).toBe(false);
    expect(cache.get("tokens:swiss")?.data).toBe(2);
  });

  it("retains entries per system for instant switch-back", () => {
    const cache = createLibraryCache();
    cache.set("tokens:swiss", "swiss-data");
    cache.set("tokens:terminal", "terminal-data");
    expect(cache.size()).toBe(2);
    expect(cache.get("tokens:swiss")?.data).toBe("swiss-data");
  });

  it("clear() empties the cache", () => {
    const cache = createLibraryCache();
    cache.set("a", 1);
    cache.clear();
    expect(cache.size()).toBe(0);
  });
});
