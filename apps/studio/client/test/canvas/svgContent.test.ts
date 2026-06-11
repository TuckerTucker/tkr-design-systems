/**
 * Artifact SVG content handling against the REAL fixture set — the
 * assembled/violating artifacts must parse with their stable node IDs
 * intact, the shared adversarial fixtures must be rejected whole
 * (defense in depth behind the server sanitizer), and thumbnail id
 * prefixing must never leave a duplicate stable id behind.
 */
import { describe, expect, it } from "vitest";

import { applyIdPrefix, parseArtifactSvg } from "../../src/canvas/svgContent.js";
import {
  ASSEMBLED_NODE_IDS,
  ASSEMBLED_SVG_TEXT,
  EVENT_HANDLERS_SVG_TEXT,
  EXTERNAL_REFERENCES_SVG_TEXT,
  SCRIPT_INJECTION_SVG_TEXT,
  SWISS_DASHBOARD_SVG_TEXT,
  VIOLATING_SVG_TEXT,
} from "./helpers/fixtures.js";

describe("parseArtifactSvg on real generated artifacts", () => {
  it("parses the assembled fixture with every stable node id intact", () => {
    const parsed = parseArtifactSvg(ASSEMBLED_SVG_TEXT);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.width).toBe(1280);
    expect(parsed.height).toBe(800);
    for (const nodeId of ASSEMBLED_NODE_IDS) {
      expect(parsed.element.querySelector(`[id="${nodeId}"]`)).not.toBeNull();
    }
  });

  it("parses the swiss dashboard and the violating fixture", () => {
    expect(parseArtifactSvg(SWISS_DASHBOARD_SVG_TEXT).ok).toBe(true);
    const violating = parseArtifactSvg(VIOLATING_SVG_TEXT);
    expect(violating.ok).toBe(true);
    if (violating.ok) {
      expect(
        violating.element.querySelector('[id="main__banner-info_0"]'),
      ).not.toBeNull();
    }
  });

  it("rejects malformed content whole, never half-rendered", () => {
    const result = parseArtifactSvg("<svg><unclosed");
    expect(result.ok).toBe(false);
    const notSvg = parseArtifactSvg("<html><body>nope</body></html>");
    expect(notSvg.ok).toBe(false);
  });
});

describe("defense in depth against the shared adversarial fixtures", () => {
  it("rejects script injection", () => {
    const result = parseArtifactSvg(SCRIPT_INJECTION_SVG_TEXT);
    expect(result.ok).toBe(false);
  });

  it("rejects event-handler attributes", () => {
    const result = parseArtifactSvg(EVENT_HANDLERS_SVG_TEXT);
    expect(result.ok).toBe(false);
  });

  it("rejects external references", () => {
    const result = parseArtifactSvg(EXTERNAL_REFERENCES_SVG_TEXT);
    expect(result.ok).toBe(false);
  });
});

describe("applyIdPrefix (thumbnail copies)", () => {
  it("prefixes every id and internal #id reference so stage ids never collide", () => {
    const parsed = parseArtifactSvg(ASSEMBLED_SVG_TEXT);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const copy = parsed.element.cloneNode(true) as Element;
    applyIdPrefix(copy, "thumb-v1-");
    for (const nodeId of ASSEMBLED_NODE_IDS) {
      expect(copy.querySelector(`[id="${nodeId}"]`)).toBeNull();
      expect(copy.querySelector(`[id="thumb-v1-${nodeId}"]`)).not.toBeNull();
    }
  });

  it("rewrites url(#...) and href references to the prefixed ids", () => {
    const parsed = parseArtifactSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
        <defs><linearGradient id="grad"/></defs>
        <rect id="main__card-default_0" fill="url(#grad)"/>
        <use href="#main__card-default_0"/>
      </svg>`,
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const copy = parsed.element.cloneNode(true) as Element;
    applyIdPrefix(copy, "p-");
    expect(copy.querySelector("rect")?.getAttribute("fill")).toBe("url(#p-grad)");
    expect(copy.querySelector("use")?.getAttribute("href")).toBe(
      "#p-main__card-default_0",
    );
  });
});
