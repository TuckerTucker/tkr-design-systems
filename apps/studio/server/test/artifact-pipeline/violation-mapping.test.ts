/**
 * Violation-to-node mapping — rule detail shapes mirror
 * design-systems/tooling/rulebook_check.py exactly (the wire truth);
 * the real-seam end-to-end run (real bridge → real checker → mapping)
 * lives in compliance.test.ts.
 */
import { describe, expect, it } from "vitest";

import type { RuleResult } from "@studio/contract";

import {
  mapViolations,
  sanitizeSvg,
} from "../../src/artifact-pipeline/index.js";
import { captureLogger } from "../helpers.js";
import { fixtureText, VIOLATING_SVG } from "./pipeline-helpers.js";

const logger = captureLogger().logger;

function sanitizedViolating(): string {
  const result = sanitizeSvg(fixtureText(VIOLATING_SVG));
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

describe("mapViolations", () => {
  it("resolves an off-scale font size to the carrying group id", () => {
    // detail shape per check_fixed_type_scale in rulebook_check.py.
    const rule: RuleResult = {
      rule_id: "swiss-fixed-type-scale",
      status: "fail",
      detail: {
        actual: { "13": 4, "17": 1 },
        violations: [17],
        expected: [9, 11, 13, 14, 22, 32, 40],
      },
    };
    const mappings = mapViolations([rule], sanitizedViolating(), logger);
    expect(mappings).toHaveLength(1);
    expect(mappings[0]).toMatchObject({
      ruleId: "swiss-fixed-type-scale",
      matchedBy: "attribute-value",
      nodeIds: ["main__banner-info_0"],
    });
    expect(mappings[0]?.evidence).toEqual({ violations: [17] });
  });

  it("resolves off-palette colors across fill and stroke attributes", () => {
    const svg = [
      '<svg viewBox="0 0 100 100">',
      '<g id="main__a_0"><rect fill="#123456" x="0"/></g>',
      '<g id="main__b_1"><line stroke="#123456" x1="0"/></g>',
      '<rect id="main__c_2" fill="#FFFFFF" x="0"/>',
      "</svg>",
    ].join("");
    const rule: RuleResult = {
      rule_id: "swiss-color-palette",
      status: "fail",
      detail: { actual: ["#123456", "#FFFFFF"], violations: ["#123456"] },
    };
    const mappings = mapViolations([rule], svg, logger);
    expect(mappings[0]?.nodeIds).toEqual(["main__a_0", "main__b_1"]);
  });

  it("maps document-scope rules (xml-well-formed) with empty nodeIds", () => {
    const rule: RuleResult = {
      rule_id: "xml-well-formed",
      status: "fail",
      detail: { parse_error: "mismatched tag" },
    };
    const mappings = mapViolations([rule], sanitizedViolating(), logger);
    expect(mappings[0]).toMatchObject({
      ruleId: "xml-well-formed",
      matchedBy: "document",
      nodeIds: [],
    });
  });

  it("falls back to document scope when evidence matches nothing", () => {
    const rule: RuleResult = {
      rule_id: "swiss-fixed-type-scale",
      status: "fail",
      detail: { violations: [99] },
    };
    const mappings = mapViolations([rule], sanitizedViolating(), logger);
    expect(mappings[0]).toMatchObject({ matchedBy: "document", nodeIds: [] });
  });

  it("lists every matching id when the offending value is used widely", () => {
    const svg = [
      '<svg viewBox="0 0 100 100">',
      '<rect id="r1" rx="4" x="0"/>',
      '<rect id="r2" ry="4" x="0"/>',
      "</svg>",
    ].join("");
    const rule: RuleResult = {
      rule_id: "swiss-zero-radius",
      status: "fail",
      detail: { actual: ["4", "4"], expected: "no rx/ry attributes (or all 0)" },
    };
    const mappings = mapViolations([rule], svg, logger);
    expect(mappings[0]?.nodeIds).toEqual(["r1", "r2"]);
  });

  it("matches shadow violations structurally (filter elements and refs)", () => {
    const svg = [
      '<svg viewBox="0 0 100 100">',
      '<defs><filter id="shadow-def"><feDropShadow dx="1"/></filter></defs>',
      '<rect id="main__card_0" filter="url(#shadow-def)" x="0"/>',
      "</svg>",
    ].join("");
    const rule: RuleResult = {
      rule_id: "swiss-no-shadows",
      status: "fail",
      detail: {
        actual: { filter_def: true, filter_ref: true, drop_shadow: true },
        expected: "no filter elements or shadow references",
      },
    };
    const mappings = mapViolations([rule], svg, logger);
    expect(mappings[0]?.matchedBy).toBe("element-name");
    expect(mappings[0]?.nodeIds).toContain("shadow-def");
    expect(mappings[0]?.nodeIds).toContain("main__card_0");
  });

  it("only maps failed rules; passes and advisories produce no mapping", () => {
    const rules: RuleResult[] = [
      { rule_id: "swiss-zero-radius", status: "pass", detail: {} },
      { rule_id: "swiss-grid-alignment", status: "advisory", detail: {} },
    ];
    expect(mapViolations(rules, sanitizedViolating(), logger)).toEqual([]);
  });

  it("maps everything to document scope when the SVG is unavailable", () => {
    const rule: RuleResult = {
      rule_id: "swiss-fixed-type-scale",
      status: "fail",
      detail: { violations: [17] },
    };
    const mappings = mapViolations([rule], null, logger);
    expect(mappings[0]).toMatchObject({ matchedBy: "document", nodeIds: [] });
  });
});
