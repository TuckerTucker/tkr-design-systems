/**
 * Boundary projection of the raw wf_get_tokens authoring export into the
 * token-browser view models — lenient per section: a missing or malformed
 * section renders as absent without blanking the others. Fixtures are the
 * REAL swiss payload and the borders_only (wireframe/neutral) shape.
 */
import { describe, expect, it } from "vitest";

import { parseTokenSet } from "../../../src/panels/library/model/types.js";
import { bordersOnlyTokens, swissTokens } from "./helpers/fixtures.js";

describe("swiss payload (typographic elevation, radius 0)", () => {
  const view = parseTokenSet(swissTokens());

  it("projects all seven palette entries with roles and constraints", () => {
    expect(view.palette).toHaveLength(7);
    const red = view.palette.find((entry) => entry.name === "red");
    expect(red?.value).toBe("#E3000B");
    expect(red?.role).toBe("the system's only accent");
    expect(red?.usageConstraint).toContain("exactly 4 uses");
    const hairline = view.palette.find(
      (entry) => entry.name === "rule_hairline",
    );
    expect(hairline?.usageConstraint).toBe("");
  });

  it("projects the full type scale with real px values", () => {
    expect(view.typography?.scale.map((entry) => entry.px)).toEqual([
      9, 11, 13, 14, 22, 32, 40,
    ]);
    expect(view.typography?.fontStackStructural).toContain("Inter");
    expect(view.typography?.fontStackMono).toBe("");
  });

  it("projects case and tracking rules keyed by role", () => {
    expect(view.typography?.caseRules["metadata"]).toBe("uppercase");
    expect(view.typography?.tracking["metadata"]).toBe(0.16);
  });

  it("projects drawing rules: radius 0 everywhere, no strokes, note set", () => {
    expect(view.drawingRules?.radiusDefault).toBe(0);
    expect(view.drawingRules?.radiusInputs).toBe(0);
    expect(view.drawingRules?.radiusChrome).toBe(0);
    expect(view.drawingRules?.strokeBorder).toBeNull();
    expect(view.drawingRules?.strokeBorderStrong).toBeNull();
    expect(view.drawingRules?.elevationNote).toContain("typographic");
  });

  it("projects layout tokens with the allowed steps", () => {
    expect(view.layout?.gridUnit).toBe(8);
    expect(view.layout?.allowedSteps).toEqual([8, 16, 24, 32, 40, 48, 64]);
    expect(view.layout?.pageMarginDesktop).toBe(32);
  });
});

describe("borders_only payload (wireframe/neutral shape)", () => {
  const view = parseTokenSet(bordersOnlyTokens());

  it("carries the stroke rules for drawn border examples", () => {
    expect(view.drawingRules?.strokeBorder).toBe(
      "stroke='#E0E0E0' stroke-width='1'",
    );
    expect(view.drawingRules?.strokeBorderStrong).toBe(
      "stroke='#E0E0E0' stroke-width='1.5'",
    );
    expect(view.drawingRules?.radiusDefault).toBe(6);
  });
});

describe("lenient parsing", () => {
  it("renders what exists when sections are missing", () => {
    const view = parseTokenSet({ systemId: "sparse", tokens: {} });
    expect(view.palette).toEqual([]);
    expect(view.typography).toBeNull();
    expect(view.drawingRules).toBeNull();
    expect(view.layout).toBeNull();
  });

  it("skips malformed palette entries without dropping the section", () => {
    const view = parseTokenSet({
      systemId: "odd",
      tokens: {
        palette: [
          { name: "ink", value: "#000000", role: "type" },
          "garbage",
          { role: "nameless and valueless" },
        ],
      },
    });
    expect(view.palette).toHaveLength(1);
    expect(view.palette[0]?.usageConstraint).toBe("");
  });

  it("filters non-numeric spacing steps", () => {
    const view = parseTokenSet({
      systemId: "odd",
      tokens: {
        layout: { grid_unit: 4, allowed_steps: [4, "8", null, 16] },
      },
    });
    expect(view.layout?.allowedSteps).toEqual([4, 16]);
  });
});
