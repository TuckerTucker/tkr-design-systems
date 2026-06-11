/**
 * Silent persistence units — debounce coalescing, latest-wins, failure →
 * local-state-authoritative retry with backoff, status transitions for
 * the inline sync indicator.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LayoutPreference } from "@studio/contract";

import { createLayoutPersistence } from "../../src/preferences/layoutPersistence.js";

function layout(width: number): LayoutPreference {
  return {
    schemaVersion: 1,
    placements: [],
    activeTab: "",
    railWidths: { left: width, right: 360 },
    lastWorkspaceId: null,
  };
}

describe("createLayoutPersistence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("coalesces a burst of changes into a single PUT (latest wins)", async () => {
    const puts: LayoutPreference[] = [];
    const persistence = createLayoutPersistence({
      api: {
        putPreferences: async (preference) => {
          puts.push(preference);
          return { ok: true, value: preference };
        },
      },
      debounceMs: 100,
    });

    persistence.schedule(layout(300));
    persistence.schedule(layout(310));
    persistence.schedule(layout(320));
    await vi.advanceTimersByTimeAsync(99);
    expect(puts).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(puts).toHaveLength(1);
    expect(puts[0]?.railWidths.left).toBe(320);
    expect(persistence.status()).toBe("synced");
  });

  it("retries with backoff after a failed PUT, keeping local state authoritative", async () => {
    let failuresLeft = 2;
    const puts: LayoutPreference[] = [];
    const statuses: string[] = [];
    const persistence = createLayoutPersistence({
      api: {
        putPreferences: async (preference) => {
          puts.push(preference);
          if (failuresLeft > 0) {
            failuresLeft -= 1;
            return {
              ok: false,
              error: {
                code: "store_failure",
                message: "disk hiccup",
                fix: "retry",
              },
            };
          }
          return { ok: true, value: preference };
        },
      },
      debounceMs: 10,
      retryInitialMs: 100,
      retryMaxMs: 1_000,
    });
    persistence.onStatus((status) => statuses.push(status));

    persistence.schedule(layout(305));
    await vi.advanceTimersByTimeAsync(10);
    expect(puts).toHaveLength(1);
    expect(persistence.status()).toBe("retrying");

    await vi.advanceTimersByTimeAsync(100);
    expect(puts).toHaveLength(2);
    expect(persistence.status()).toBe("retrying");

    await vi.advanceTimersByTimeAsync(200);
    expect(puts).toHaveLength(3);
    expect(persistence.status()).toBe("synced");
    expect(statuses).toContain("saving");
    expect(statuses).toContain("retrying");
    expect(statuses.at(-1)).toBe("synced");
  });

  it("a newer layout scheduled mid-retry replaces the payload", async () => {
    let fail = true;
    const puts: LayoutPreference[] = [];
    const persistence = createLayoutPersistence({
      api: {
        putPreferences: async (preference) => {
          puts.push(preference);
          if (fail) {
            fail = false;
            return {
              ok: false,
              error: { code: "store_failure", message: "x", fix: "y" },
            };
          }
          return { ok: true, value: preference };
        },
      },
      debounceMs: 10,
      retryInitialMs: 100,
    });

    persistence.schedule(layout(300));
    await vi.advanceTimersByTimeAsync(10);
    expect(puts).toHaveLength(1);
    persistence.schedule(layout(444));
    await vi.advanceTimersByTimeAsync(200);
    expect(puts.at(-1)?.railWidths.left).toBe(444);
    expect(persistence.status()).toBe("synced");
  });

  it("flush sends the pending layout immediately", async () => {
    const puts: LayoutPreference[] = [];
    const persistence = createLayoutPersistence({
      api: {
        putPreferences: async (preference) => {
          puts.push(preference);
          return { ok: true, value: preference };
        },
      },
      debounceMs: 10_000,
    });
    persistence.schedule(layout(333));
    await persistence.flush();
    expect(puts).toHaveLength(1);
  });
});
