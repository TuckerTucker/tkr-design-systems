/**
 * Client-side SVG sanitizer against the SHARED adversarial fixture set
 * (server/test/artifact-pipeline/fixtures/adversarial/) — the same
 * fixtures that exercise artifact-pipeline's server-side sanitizer
 * (architecture.md, "SVG sanitization"). This sanitizer is the ONLY
 * sanitization layer for library content. Plus the positive contract: a
 * real library component SVG passes through visually unchanged with its
 * ids preserved.
 */
import { describe, expect, it } from "vitest";

import { sanitizeSvg } from "../../../src/panels/library/svg/sanitizeSvg.js";
import {
  EVENT_HANDLERS_SVG,
  EXTERNAL_REFERENCES_SVG,
  SCRIPT_INJECTION_SVG,
  SWISS_BUTTON_SVG,
} from "./helpers/fixtures.js";

function sanitizedTextOf(svgText: string): string {
  const result = sanitizeSvg(svgText);
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(result.reason);
  }
  return result.svgText;
}

describe("script-injection fixture", () => {
  it("strips every script element including xlink-sourced ones", () => {
    const result = sanitizeSvg(SCRIPT_INJECTION_SVG);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.svgText).not.toContain("<script");
    expect(result.svgText).not.toContain("evil.example");
    expect(result.svgText).not.toContain("document.cookie");
    expect(result.stripped.length).toBeGreaterThan(0);
  });

  it("strips foreignObject subtrees (iframe smuggling)", () => {
    const text = sanitizedTextOf(SCRIPT_INJECTION_SVG);
    expect(text).not.toContain("foreignObject");
    expect(text).not.toContain("iframe");
  });

  it("keeps the visual content and its ids", () => {
    const text = sanitizedTextOf(SCRIPT_INJECTION_SVG);
    expect(text).toContain('id="main__card_0"');
    expect(text).toContain('id="main__footer_1"');
    expect(text).toContain("Card title");
    expect(text).toContain("FOOTER");
  });
});

describe("event-handlers fixture", () => {
  it("strips every on* attribute regardless of case", () => {
    const text = sanitizedTextOf(EVENT_HANDLERS_SVG);
    expect(text).not.toMatch(/\son[a-z]+=/i);
    expect(text).not.toContain("alert(");
    expect(text).not.toContain("fetch(");
  });

  it("strips the javascript: href but keeps the link text", () => {
    const text = sanitizedTextOf(EVENT_HANDLERS_SVG);
    expect(text).not.toContain("javascript:");
    expect(text).toContain("Click me");
  });

  it("records each strip for the card's integrity note", () => {
    const result = sanitizeSvg(EVENT_HANDLERS_SVG);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    // onload, onclick, onmouseover, onfocus, ONERROR, onbegin + the href.
    expect(result.stripped.length).toBeGreaterThanOrEqual(7);
    expect(
      result.stripped.some((entry) => entry.includes("onload")),
    ).toBe(true);
  });

  it("keeps ids and visual shapes intact", () => {
    const text = sanitizedTextOf(EVENT_HANDLERS_SVG);
    expect(text).toContain('id="main__button_0"');
    expect(text).toContain("Send");
  });
});

describe("external-references fixture", () => {
  it("strips external image/use hrefs including protocol-relative", () => {
    const text = sanitizedTextOf(EXTERNAL_REFERENCES_SVG);
    expect(text).not.toContain("evil.example");
    expect(text).not.toContain("//evil");
  });

  it("scrubs @import and external url() from style blocks", () => {
    const text = sanitizedTextOf(EXTERNAL_REFERENCES_SVG);
    expect(text).not.toContain("@import");
    expect(text).not.toContain("url(https://");
    // The safe class rule survives the scrub.
    expect(text).toContain(".text-primary");
  });

  it("preserves local references: use href=#, fill=url(#), symbol ids", () => {
    const text = sanitizedTextOf(EXTERNAL_REFERENCES_SVG);
    expect(text).toContain('href="#local-symbol"');
    expect(text).toContain('fill="url(#leak-pattern)"');
    expect(text).toContain('id="local-symbol"');
    expect(text).toContain('id="main__safe_1"');
    expect(text).toContain("Safe internal refs stay");
  });
});

describe("real library SVG (swiss button-primary)", () => {
  it("passes through with zero strips", () => {
    const result = sanitizeSvg(SWISS_BUTTON_SVG);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.stripped).toEqual([]);
  });

  it("is visually unchanged: same elements, attributes, and text", () => {
    const result = sanitizeSvg(SWISS_BUTTON_SVG);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const original = new DOMParser().parseFromString(
      SWISS_BUTTON_SVG,
      "image/svg+xml",
    );
    const sanitized = new DOMParser().parseFromString(
      result.svgText,
      "image/svg+xml",
    );
    expect(
      sanitized.documentElement.isEqualNode(original.documentElement),
    ).toBe(true);
  });

  it("preserves every id in the source", () => {
    const result = sanitizeSvg(SWISS_BUTTON_SVG);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const ids = [...SWISS_BUTTON_SVG.matchAll(/id="([^"]+)"/g)].map(
      (match) => match[1],
    );
    for (const id of ids) {
      expect(result.svgText).toContain(`id="${id ?? ""}"`);
    }
  });

  it("reports the declared size for viewBox-proportional rendering", () => {
    const result = sanitizeSvg(SWISS_BUTTON_SVG);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.width).toBe(140);
    expect(result.height).toBe(48);
  });
});

describe("malformed input", () => {
  it("fails structurally-broken XML with a reason, never throws", () => {
    const result = sanitizeSvg("<svg><unclosed");
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).not.toBe("");
  });

  it("rejects non-SVG documents", () => {
    const result = sanitizeSvg("<html><body>not svg</body></html>");
    expect(result.ok).toBe(false);
  });

  it("derives the size from the viewBox when width/height are absent", () => {
    const result = sanitizeSvg('<svg viewBox="0 0 400 300"><rect/></svg>');
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.width).toBe(400);
    expect(result.height).toBe(300);
  });
});
