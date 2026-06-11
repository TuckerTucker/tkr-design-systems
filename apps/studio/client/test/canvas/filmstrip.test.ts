/**
 * Filmstrip model — lineage projection (oldest → newest, head marked,
 * brief excerpting) and the scrub-move targets shared by hover and the
 * keyboard path (Left/Right/Home/End semantics, head → null).
 */
import { describe, expect, it } from "vitest";

import {
  buildFilmstrip,
  excerptBrief,
  scrubMoveTarget,
} from "../../src/canvas/filmstrip.js";
import { versionSummary } from "./helpers/fixtures.js";

describe("buildFilmstrip", () => {
  it("orders entries oldest → newest and marks the head", () => {
    const entries = buildFilmstrip(
      [versionSummary(3), versionSummary(1), versionSummary(2)],
      3,
    );
    expect(entries.map((entry) => entry.version)).toEqual([1, 2, 3]);
    expect(entries.map((entry) => entry.isHead)).toEqual([false, false, true]);
    expect(entries[0]?.parentVersion).toBeNull();
    expect(entries[2]?.parentVersion).toBe(2);
    expect(entries[0]?.tool).toBe("wf_generate");
  });

  it("excerpts long briefs for display", () => {
    const long = "x".repeat(200);
    expect(excerptBrief(long).length).toBeLessThanOrEqual(80);
    expect(excerptBrief(long).endsWith("…")).toBe(true);
    expect(excerptBrief("short brief")).toBe("short brief");
  });
});

describe("scrubMoveTarget", () => {
  const entries = buildFilmstrip(
    [versionSummary(1), versionSummary(2), versionSummary(3), versionSummary(4)],
    4,
  );

  it("steps left and right from the head", () => {
    expect(scrubMoveTarget(entries, 4, null, "previous")).toBe(3);
    expect(scrubMoveTarget(entries, 4, 3, "previous")).toBe(2);
    expect(scrubMoveTarget(entries, 4, 2, "next")).toBe(3);
  });

  it("returns null (head) when the move lands on the head", () => {
    expect(scrubMoveTarget(entries, 4, 3, "next")).toBeNull();
    expect(scrubMoveTarget(entries, 4, null, "head")).toBeNull();
  });

  it("Home jumps to the first version, End to head", () => {
    expect(scrubMoveTarget(entries, 4, null, "first")).toBe(1);
    expect(scrubMoveTarget(entries, 4, 2, "head")).toBeNull();
  });

  it("clamps at the first version", () => {
    expect(scrubMoveTarget(entries, 4, 1, "previous")).toBe(1);
  });

  it("is a no-op vocabulary on an empty strip", () => {
    expect(scrubMoveTarget([], null, null, "next")).toBeNull();
  });
});
