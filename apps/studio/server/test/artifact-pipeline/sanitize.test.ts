/**
 * SVG sanitizer — verified against the shared adversarial fixture set
 * (fixtures/adversarial/, the same set library-panel's client-side
 * sanitizer must pass in Phase 2) and the real generated fixtures for
 * id byte-stability and determinism.
 */
import { describe, expect, it } from "vitest";

import {
  parseSvgDocument,
  sanitizeSvg,
} from "../../src/artifact-pipeline/index.js";
import {
  adversarialFixture,
  ASSEMBLED_SVG,
  fixtureText,
  SWISS_DASHBOARD_SVG,
  VIOLATING_SVG,
} from "./pipeline-helpers.js";

function idsOf(svgText: string): string[] {
  return [...svgText.matchAll(/\bid="([^"]*)"/g)].map(
    (match) => match[1] as string,
  );
}

function sanitized(svgText: string): string {
  const result = sanitizeSvg(svgText);
  if (!result.ok) {
    throw new Error(`sanitize failed: ${result.error.message}`);
  }
  return result.value;
}

describe("sanitizeSvg — shared adversarial fixture set", () => {
  it("strips script elements and their payloads (script-injection.svg)", () => {
    const output = sanitized(adversarialFixture("script-injection.svg"));
    expect(output).not.toContain("<script");
    expect(output).not.toContain("evil.example");
    expect(output).not.toContain("foreignObject");
    expect(output).not.toContain("iframe");
    // Legitimate content and ids survive.
    expect(output).toContain('id="main__card_0"');
    expect(output).toContain('id="main__footer_1"');
    expect(output).toContain("Card title");
    expect(output).toContain(".text-primary { fill: #000000;");
    // Output stays well-formed.
    expect(parseSvgDocument(output).ok).toBe(true);
  });

  it("strips every on* attribute and javascript: href (event-handlers.svg)", () => {
    const output = sanitized(adversarialFixture("event-handlers.svg"));
    expect(output).not.toMatch(/\son\w+=/i);
    expect(output).not.toContain("javascript:");
    expect(output).not.toContain("alert(");
    expect(output).toContain('id="main__button_0"');
    expect(output).toContain('id="main__link_1"');
    expect(output).toContain('fill="#E3000B"');
    expect(parseSvgDocument(output).ok).toBe(true);
  });

  it("strips external references but keeps internal ones (external-references.svg)", () => {
    const output = sanitized(adversarialFixture("external-references.svg"));
    expect(output).not.toContain("evil.example");
    expect(output).not.toContain("@import");
    expect(output).not.toContain("//evil");
    // Internal references survive byte-identical.
    expect(output).toContain('href="#local-symbol"');
    expect(output).toContain('fill="url(#leak-pattern)"');
    expect(output).toContain('id="main__safe_1"');
    expect(output).toContain('id="local-symbol"');
    expect(parseSvgDocument(output).ok).toBe(true);
  });
});

describe("sanitizeSvg — generated artifact guarantees", () => {
  it("keeps every id byte-identical on the assembled fixture", () => {
    const input = fixtureText(ASSEMBLED_SVG);
    const output = sanitized(input);
    expect(idsOf(output)).toEqual(idsOf(input));
    expect(idsOf(output)).toContain("main__banner-info_0");
    expect(idsOf(output)).toContain("header__breadcrumb-default_0");
  });

  it("passes clean generated SVG through unchanged", () => {
    const input = fixtureText(SWISS_DASHBOARD_SVG);
    expect(sanitized(input)).toBe(input);
  });

  it("is deterministic across repeated calls", () => {
    for (const fixture of [
      adversarialFixture("script-injection.svg"),
      adversarialFixture("event-handlers.svg"),
      adversarialFixture("external-references.svg"),
      fixtureText(VIOLATING_SVG),
    ]) {
      const first = sanitized(fixture);
      const second = sanitized(fixture);
      expect(second).toBe(first);
    }
  });

  it("returns a typed SVG_MALFORMED error for broken XML", () => {
    const result = sanitizeSvg("<svg><g id='open'></svg>");
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("SVG_MALFORMED");
  });

  it("flags duplicate ids while keeping the first occurrence canonical", () => {
    const doc = parseSvgDocument(
      '<svg><g id="dup"><rect id="dup" x="0"/></g></svg>',
    );
    expect(doc.ok).toBe(true);
    if (!doc.ok) {
      return;
    }
    expect(doc.document.duplicateIds).toEqual(["dup"]);
  });
});
