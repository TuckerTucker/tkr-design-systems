/**
 * Serving-side SVG sanitizer for artifact versions — strips script
 * elements, foreignObject subtrees, on* event-handler attributes, and
 * external resource references while leaving every other byte (crucially,
 * every id attribute) identical to the stored file. The stored file is
 * never touched; sanitization happens on the serving path.
 *
 * Scope (architecture contract "SVG sanitization"): this guarantee covers
 * artifact version SVGs. Library component/layout SVGs are sanitized
 * client-side by library-panel against the same shared adversarial
 * fixture set (test/artifact-pipeline/fixtures/adversarial/).
 *
 * Deterministic: identical input → identical output (client-cacheable;
 * violation mappings computed against this output always resolve).
 */
import { fail, ok, svgMalformed, type PipelineResult } from "./errors.js";
import { parseSvgDocument, type SvgElement } from "./svg-document.js";

/** Element subtrees removed entirely (case-insensitive match). */
const REMOVED_ELEMENTS = new Set(["script", "foreignobject"]);

/** Reference-carrying attributes restricted to internal (#) targets. */
const REFERENCE_ATTRIBUTES = new Set(["href", "xlink:href", "src"]);

/** url(...) with anything but an internal #fragment target. */
const EXTERNAL_CSS_URL = /url\(\s*(?!["']?#)[^)]*\)/g;
const CSS_IMPORT = /@import[^;]*;?/g;

interface Splice {
  start: number;
  end: number;
  replacement: string;
}

function isExternalReference(value: string): boolean {
  return !value.trim().startsWith("#");
}

function hasRemovedAncestor(
  element: SvgElement,
  removed: Set<SvgElement>,
): boolean {
  let current = element.parent;
  while (current !== null) {
    if (removed.has(current)) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

/** Neutralize external references inside CSS text; internal refs survive. */
function sanitizeCssText(css: string): string {
  return css
    .replace(CSS_IMPORT, "")
    .replace(EXTERNAL_CSS_URL, "url(#external-ref-removed)");
}

/**
 * Sanitize a stored artifact version SVG for serving.
 *
 * Returns SVG_MALFORMED (typed, never a broken document) when the input
 * fails well-formedness verification.
 */
export function sanitizeSvg(svgText: string): PipelineResult<string> {
  const parsed = parseSvgDocument(svgText);
  if (!parsed.ok) {
    return fail(
      svgMalformed(`Stored SVG is not well-formed: ${parsed.reason}`),
    );
  }

  const splices: Splice[] = [];
  const removedElements = new Set<SvgElement>();

  for (const element of parsed.document.elements) {
    if (REMOVED_ELEMENTS.has(element.tagName.toLowerCase())) {
      removedElements.add(element);
    }
  }

  for (const element of parsed.document.elements) {
    if (removedElements.has(element)) {
      if (!hasRemovedAncestor(element, removedElements)) {
        splices.push({
          start: element.openStart,
          end: element.closeEnd,
          replacement: "",
        });
      }
      continue;
    }
    if (hasRemovedAncestor(element, removedElements)) {
      continue; // Whole subtree already removed.
    }

    for (const attribute of element.attributes) {
      const lowered = attribute.name.toLowerCase();
      if (lowered.startsWith("on")) {
        splices.push({
          start: attribute.start,
          end: attribute.end,
          replacement: "",
        });
        continue;
      }
      if (
        REFERENCE_ATTRIBUTES.has(lowered) &&
        isExternalReference(attribute.value)
      ) {
        splices.push({
          start: attribute.start,
          end: attribute.end,
          replacement: "",
        });
        continue;
      }
      if (lowered === "style" && EXTERNAL_CSS_URL.test(attribute.value)) {
        EXTERNAL_CSS_URL.lastIndex = 0;
        splices.push({
          start: attribute.start,
          end: attribute.end,
          replacement: "",
        });
      }
      EXTERNAL_CSS_URL.lastIndex = 0;
    }

    if (
      element.tagName.toLowerCase() === "style" &&
      !element.selfClosing &&
      element.closeStart > element.openEnd
    ) {
      const css = svgText.slice(element.openEnd, element.closeStart);
      const cleaned = sanitizeCssText(css);
      if (cleaned !== css) {
        splices.push({
          start: element.openEnd,
          end: element.closeStart,
          replacement: cleaned,
        });
      }
    }
  }

  if (splices.length === 0) {
    return ok(svgText);
  }

  splices.sort((a, b) => a.start - b.start);
  const parts: string[] = [];
  let cursor = 0;
  for (const splice of splices) {
    if (splice.start < cursor) {
      continue; // Contained in an earlier removal.
    }
    parts.push(svgText.slice(cursor, splice.start), splice.replacement);
    cursor = splice.end;
  }
  parts.push(svgText.slice(cursor));
  return ok(parts.join(""));
}
