/**
 * Violation-to-SVG-node mapping — rule detail carries offending VALUES
 * (font sizes, colors, radii, filter refs — see
 * design-systems/tooling/rulebook_check.py), never node references. The
 * mapper scans the SANITIZED document (the one the client actually
 * renders, so highlight targets always resolve) for elements matching
 * that evidence and resolves stable element ids — assembled artifacts
 * carry {region}__{component}_{idx} group ids that survive sanitization.
 *
 * Rules whose evidence matches nothing degrade to matchedBy "document"
 * with empty nodeIds (the canvas highlights the artifact frame) — never
 * an error.
 */
import type { RuleResult, ViolationNodeMapping } from "@studio/contract";

import type { Logger } from "../logging/create-logger.js";
import {
  attributeValue,
  parseSvgDocument,
  resolveNodeId,
  type SvgDocument,
  type SvgElement,
} from "./svg-document.js";

type MatchedBy = ViolationNodeMapping["matchedBy"];

interface MatchOutcome {
  elements: SvgElement[];
  matchedBy: Exclude<MatchedBy, "document">;
  evidence: Record<string, unknown>;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is string | number =>
          typeof entry === "string" || typeof entry === "number",
      ).map((entry) => String(entry))
    : [];
}

function numberSet(value: unknown): Set<number> {
  const numbers = new Set<number>();
  if (Array.isArray(value)) {
    for (const entry of value) {
      const parsed =
        typeof entry === "number" ? entry : Number.parseFloat(String(entry));
      if (Number.isFinite(parsed)) {
        numbers.add(parsed);
      }
    }
  }
  return numbers;
}

function matchAttribute(
  document: SvgDocument,
  attributeNames: string[],
  predicate: (value: string) => boolean,
  tagName?: string,
): SvgElement[] {
  const matches: SvgElement[] = [];
  for (const element of document.elements) {
    if (tagName !== undefined && element.tagName !== tagName) {
      continue;
    }
    for (const name of attributeNames) {
      const value = attributeValue(element, name);
      if (value !== null && predicate(value)) {
        matches.push(element);
        break;
      }
    }
  }
  return matches;
}

/** font-size evidence: detail.violations lists the off-scale sizes. */
function matchTypeScale(
  document: SvgDocument,
  detail: Record<string, unknown>,
): MatchOutcome | null {
  const sizes = numberSet(detail["violations"]);
  if (sizes.size === 0) {
    return null;
  }
  const elements = matchAttribute(
    document,
    ["font-size"],
    (value) => sizes.has(Number.parseInt(String(Number.parseFloat(value)), 10)),
    "text",
  );
  return {
    elements,
    matchedBy: "attribute-value",
    evidence: { violations: [...sizes].sort((a, b) => a - b) },
  };
}

/** Color evidence: detail.violations lists off-palette hex values. */
function matchColors(
  document: SvgDocument,
  detail: Record<string, unknown>,
): MatchOutcome | null {
  const colors = new Set(
    stringArray(detail["violations"]).map((color) => color.toUpperCase()),
  );
  if (colors.size === 0) {
    return null;
  }
  const elements = matchAttribute(document, ["fill", "stroke"], (value) =>
    colors.has(value.toUpperCase()),
  );
  return {
    elements,
    matchedBy: "attribute-value",
    evidence: { violations: [...colors].sort() },
  };
}

/** Radius evidence: detail.actual lists the non-zero rx/ry values. */
function matchRadii(
  document: SvgDocument,
  detail: Record<string, unknown>,
): MatchOutcome | null {
  const radii = new Set(stringArray(detail["actual"]));
  if (radii.size === 0) {
    return null;
  }
  const elements = matchAttribute(document, ["rx", "ry"], (value) =>
    radii.has(value),
  );
  return {
    elements,
    matchedBy: "attribute-value",
    evidence: { actual: [...radii].sort() },
  };
}

/** Typeface evidence: detail.violations lists non-permitted font stacks. */
function matchTypefaces(
  document: SvgDocument,
  detail: Record<string, unknown>,
): MatchOutcome | null {
  const families = new Set(stringArray(detail["violations"]));
  if (families.size === 0) {
    return null;
  }
  const elements = matchAttribute(
    document,
    ["font-family"],
    (value) => families.has(value),
    "text",
  );
  return {
    elements,
    matchedBy: "attribute-value",
    evidence: { violations: [...families].sort() },
  };
}

/** Shadow evidence: filter definitions/references are structural. */
function matchShadows(
  document: SvgDocument,
  detail: Record<string, unknown>,
): MatchOutcome {
  const elements: SvgElement[] = [];
  for (const element of document.elements) {
    if (element.tagName === "filter" || element.tagName === "feDropShadow") {
      elements.push(element);
      continue;
    }
    const filterRef = attributeValue(element, "filter");
    if (filterRef !== null && filterRef !== "none") {
      elements.push(element);
    }
  }
  return {
    elements,
    matchedBy: "element-name",
    evidence: { actual: detail["actual"] ?? {} },
  };
}

/** Grid evidence: off_grid_values entries are "tag.attr=value" strings. */
function matchGrid(
  document: SvgDocument,
  detail: Record<string, unknown>,
): MatchOutcome | null {
  const entries = stringArray(detail["off_grid_values"]);
  if (entries.length === 0) {
    return null;
  }
  const elements: SvgElement[] = [];
  const seen = new Set<SvgElement>();
  for (const entry of entries) {
    const match = /^(\w+)\.([\w-]+)=(.+)$/.exec(entry);
    if (match === null) {
      continue;
    }
    const [, tag, attr, raw] = match as unknown as [
      string,
      string,
      string,
      string,
    ];
    const target = Number.parseFloat(raw);
    for (const element of document.elements) {
      if (element.tagName !== tag || seen.has(element)) {
        continue;
      }
      const value = attributeValue(element, attr);
      if (value !== null && Number.parseFloat(value) === target) {
        seen.add(element);
        elements.push(element);
      }
    }
  }
  return {
    elements,
    matchedBy: "attribute-value",
    evidence: { off_grid_values: entries },
  };
}

/**
 * Generic fallback: any primitive evidence value found verbatim in an
 * attribute value, then in text content. Covers rules without a dedicated
 * matcher (forward compatibility with new rulesets).
 */
function matchGeneric(
  document: SvgDocument,
  detail: Record<string, unknown>,
): MatchOutcome | null {
  const candidates: string[] = [];
  for (const key of ["violations", "actual", "detail", "actual_failures"]) {
    candidates.push(...stringArray(detail[key]));
  }
  const values = [...new Set(candidates)];
  if (values.length === 0) {
    return null;
  }

  const byAttribute: SvgElement[] = [];
  const seen = new Set<SvgElement>();
  for (const element of document.elements) {
    for (const attribute of element.attributes) {
      if (values.includes(attribute.value) && !seen.has(element)) {
        seen.add(element);
        byAttribute.push(element);
        break;
      }
    }
  }
  if (byAttribute.length > 0) {
    return {
      elements: byAttribute,
      matchedBy: "attribute-value",
      evidence: { matched_values: values },
    };
  }

  const byText: SvgElement[] = [];
  const textValues = values.filter((value) => value.length >= 3);
  for (const element of document.elements) {
    if (element.text.trim() === "") {
      continue;
    }
    if (textValues.some((value) => element.text.includes(value))) {
      byText.push(element);
    }
  }
  if (byText.length > 0) {
    return {
      elements: byText,
      matchedBy: "text-content",
      evidence: { matched_values: textValues },
    };
  }
  return null;
}

function documentScope(rule: RuleResult): ViolationNodeMapping {
  return {
    ruleId: rule.rule_id,
    nodeIds: [],
    matchedBy: "document",
    evidence: rule.detail,
  };
}

function mapRule(
  rule: RuleResult,
  document: SvgDocument,
): ViolationNodeMapping {
  const ruleId = rule.rule_id;
  let outcome: MatchOutcome | null = null;

  if (ruleId === "xml-well-formed") {
    return documentScope(rule);
  }
  if (ruleId.includes("type-scale")) {
    outcome = matchTypeScale(document, rule.detail);
  } else if (ruleId.includes("palette") || ruleId.includes("color")) {
    outcome = matchColors(document, rule.detail);
  } else if (ruleId.includes("radius")) {
    outcome = matchRadii(document, rule.detail);
  } else if (ruleId.includes("typeface")) {
    outcome = matchTypefaces(document, rule.detail);
  } else if (ruleId.includes("shadow")) {
    outcome = matchShadows(document, rule.detail);
  } else if (ruleId.includes("grid")) {
    outcome = matchGrid(document, rule.detail);
  } else if (ruleId.includes("red-finite")) {
    outcome = {
      elements: matchAttribute(document, ["fill", "stroke"], (value) =>
        value.toUpperCase() === "#E3000B",
      ),
      matchedBy: "attribute-value",
      evidence: { detail: rule.detail["detail"] ?? [] },
    };
  }
  outcome = outcome ?? matchGeneric(document, rule.detail);

  if (outcome === null || outcome.elements.length === 0) {
    // Evidence matched nothing (value normalized away) → artifact-level.
    return documentScope(rule);
  }

  const nodeIds: string[] = [];
  for (const element of outcome.elements) {
    const nodeId = resolveNodeId(element);
    if (nodeId !== null && !nodeIds.includes(nodeId)) {
      nodeIds.push(nodeId);
    }
  }
  if (nodeIds.length === 0) {
    return documentScope(rule);
  }
  return {
    ruleId,
    nodeIds,
    matchedBy: outcome.matchedBy,
    evidence: outcome.evidence,
  };
}

/**
 * Map every FAILED rule's detail evidence onto sanitized-document node
 * ids. `sanitizedSvg` is the output of sanitizeSvg for the same version;
 * pass null when sanitization failed — every failed rule then maps to
 * document scope.
 */
export function mapViolations(
  results: RuleResult[],
  sanitizedSvg: string | null,
  logger: Logger,
): ViolationNodeMapping[] {
  const log = logger.child({ component: "violation-mapping" });
  const failed = results.filter((rule) => rule.status === "fail");
  if (failed.length === 0) {
    return [];
  }

  let document: SvgDocument | null = null;
  if (sanitizedSvg !== null) {
    const parsed = parseSvgDocument(sanitizedSvg);
    if (parsed.ok) {
      document = parsed.document;
      if (parsed.document.duplicateIds.length > 0) {
        log.warn(
          { duplicateIds: parsed.document.duplicateIds },
          "duplicate ids in sanitized SVG; first occurrence treated as canonical",
        );
      }
    } else {
      log.warn(
        { reason: parsed.reason },
        "sanitized SVG unparseable; violations map to document scope",
      );
    }
  }

  return failed.map((rule) => {
    if (document === null) {
      return documentScope(rule);
    }
    const mapping = mapRule(rule, document);
    log.debug(
      { ruleId: mapping.ruleId, matchedBy: mapping.matchedBy, nodeIds: mapping.nodeIds },
      "violation mapped",
    );
    return mapping;
  });
}
