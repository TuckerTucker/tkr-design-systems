/**
 * Pure search matchers over the cached index — slice 5's client-side
 * filtering (zero network per keystroke). Fixtures are the real swiss
 * projections.
 */
import { describe, expect, it } from "vitest";

import { parseTokenSet } from "../../../src/panels/library/model/types.js";
import {
  matchComponents,
  matchPalette,
  matchScale,
  normalizeQuery,
} from "../../../src/panels/library/search/matchers.js";
import { swissComponents, swissTokens } from "./helpers/fixtures.js";

const tokens = parseTokenSet(swissTokens());

describe("normalizeQuery", () => {
  it("trims and lowercases", () => {
    expect(normalizeQuery("  CaRd ")).toBe("card");
  });

  it("maps whitespace-only to the empty query", () => {
    expect(normalizeQuery("   ")).toBe("");
  });
});

describe("matchComponents", () => {
  const components = swissComponents();

  it("returns everything for an empty query", () => {
    expect(matchComponents(components, "")).toHaveLength(components.length);
  });

  it("matches by component id", () => {
    const matched = matchComponents(components, "card");
    expect(matched.map((entry) => entry.id)).toEqual(["card"]);
  });

  it("matches by display name case-insensitively", () => {
    const matched = matchComponents(components, "LIST IT");
    expect(matched.map((entry) => entry.id)).toEqual(["list_item"]);
  });

  it("matches by variant id (gray_surface finds card)", () => {
    const matched = matchComponents(components, "gray_surface");
    expect(matched.map((entry) => entry.id)).toEqual(["card"]);
  });

  it("returns empty for a query matching nothing", () => {
    expect(matchComponents(components, "zzz-nothing")).toEqual([]);
  });
});

describe("matchPalette", () => {
  it("matches by name", () => {
    const matched = matchPalette(tokens.palette, "red");
    expect(matched.map((entry) => entry.name)).toEqual(["red"]);
  });

  it("matches by hex value (designer pastes #E3000B)", () => {
    const matched = matchPalette(tokens.palette, "#E3000B");
    expect(matched.map((entry) => entry.name)).toEqual(["red"]);
  });

  it("matches by role text", () => {
    const matched = matchPalette(tokens.palette, "only accent");
    expect(matched.map((entry) => entry.name)).toEqual(["red"]);
  });

  it("returns all entries for the empty query", () => {
    expect(matchPalette(tokens.palette, "")).toHaveLength(7);
  });
});

describe("matchScale", () => {
  const scale = tokens.typography?.scale ?? [];

  it("matches by role", () => {
    const matched = matchScale(scale, "display");
    expect(matched.map((entry) => entry.px)).toEqual([22, 32, 40]);
  });

  it('matches by pixel size ("22" matches 22px)', () => {
    const matched = matchScale(scale, "22");
    expect(matched.map((entry) => entry.px)).toEqual([22]);
  });

  it("returns empty when nothing matches", () => {
    expect(matchScale(scale, "999")).toEqual([]);
  });
});
