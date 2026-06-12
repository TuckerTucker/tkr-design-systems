/**
 * Client-side SVG sanitizer for library content — the ONLY sanitization
 * layer for component/layout SVGs, which flow wf_read_component →
 * studio-api → panel and never pass through artifact-pipeline's
 * server-side sanitizer (architecture.md, "SVG sanitization").
 *
 * Strips (recording every strip so cards can show an integrity note):
 * - script / foreignObject / iframe / embed / object subtrees
 * - on* event-handler attributes (any case)
 * - external href / xlink:href / src (anything not a local "#fragment")
 * - external CSS url(...) and @import in <style> blocks and style="..."
 *
 * Preserves ids, internal references (href="#local", fill="url(#local)"),
 * and all visual content. Sanitized output renders; it is never rejected
 * whole for stripped content — only unparseable input fails.
 *
 * Tested against the shared adversarial fixture set
 * (server/test/artifact-pipeline/fixtures/adversarial/) that also
 * exercises the server-side artifact sanitizer.
 */

export interface SanitizedSvg {
  ok: true;
  /** Detached sanitized <svg> root; callers clone before inserting. */
  element: SVGSVGElement;
  /** Serialized sanitized markup. */
  svgText: string;
  /** Human-readable record of every strip ([] = passed unchanged). */
  stripped: string[];
  /** From width/height attributes or the viewBox; 0 when undeclared. */
  width: number;
  height: number;
}

export type SanitizeResult = SanitizedSvg | { ok: false; reason: string };

const BLOCKED_ELEMENTS = new Set([
  "script",
  "foreignobject",
  "iframe",
  "embed",
  "object",
]);

const URL_FUNCTION_PATTERN = /url\(\s*(['"]?)([^'")]*)\1\s*\)/gi;
const IMPORT_PATTERN = /@import\b[^;]*(;|$)/gi;

function isLocalReference(target: string): boolean {
  return target.trim().startsWith("#");
}

/** Scrub CSS text: drop @import statements and external url() targets. */
function scrubCss(css: string): { css: string; changed: boolean } {
  let changed = false;
  let scrubbed = css.replace(IMPORT_PATTERN, () => {
    changed = true;
    return "";
  });
  scrubbed = scrubbed.replace(
    URL_FUNCTION_PATTERN,
    (match, _quote: string, target: string) => {
      if (isLocalReference(target)) {
        return match;
      }
      changed = true;
      return "none";
    },
  );
  return { css: scrubbed, changed };
}

function describe(element: Element): string {
  const id = element.getAttribute("id");
  return id === null
    ? `<${element.nodeName}>`
    : `<${element.nodeName} id="${id}">`;
}

function viewBoxSize(root: SVGSVGElement): { width: number; height: number } {
  const widthAttr = Number(root.getAttribute("width"));
  const heightAttr = Number(root.getAttribute("height"));
  if (
    Number.isFinite(widthAttr) &&
    widthAttr > 0 &&
    Number.isFinite(heightAttr) &&
    heightAttr > 0
  ) {
    return { width: widthAttr, height: heightAttr };
  }
  const viewBox = root.getAttribute("viewBox");
  if (viewBox !== null) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number);
    const width = parts[2];
    const height = parts[3];
    if (
      parts.length === 4 &&
      width !== undefined &&
      height !== undefined &&
      Number.isFinite(width) &&
      Number.isFinite(height)
    ) {
      return { width, height };
    }
  }
  return { width: 0, height: 0 };
}

function sanitizeAttributes(element: Element, stripped: string[]): void {
  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name.toLowerCase();
    const value = attribute.value;
    if (name.startsWith("on")) {
      element.removeAttribute(attribute.name);
      stripped.push(
        `event handler ${attribute.name} on ${describe(element)}`,
      );
      continue;
    }
    if (name === "href" || name === "xlink:href" || name === "src") {
      if (!isLocalReference(value)) {
        element.removeAttribute(attribute.name);
        stripped.push(
          `external reference ${attribute.name}="${value.trim()}" on ${describe(element)}`,
        );
      }
      continue;
    }
    if (name === "style") {
      const scrub = scrubCss(value);
      if (scrub.changed) {
        element.setAttribute(attribute.name, scrub.css);
        stripped.push(`external CSS in style attribute on ${describe(element)}`);
      }
      continue;
    }
    if (value.toLowerCase().includes("url(")) {
      const scrub = scrubCss(value);
      if (scrub.changed) {
        element.setAttribute(attribute.name, scrub.css);
        stripped.push(
          `external url() in ${attribute.name} on ${describe(element)}`,
        );
      }
    }
  }
}

/**
 * Sanitize library SVG text for inline rendering. Returns the sanitized
 * detached element plus the strip record; only unparseable or non-SVG
 * input returns a failure.
 */
export function sanitizeSvg(svgText: string): SanitizeResult {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  } catch {
    return { ok: false, reason: "The SVG content could not be parsed." };
  }
  if (doc.getElementsByTagName("parsererror").length > 0) {
    return { ok: false, reason: "The SVG content could not be parsed." };
  }
  const root = doc.documentElement;
  if (root.nodeName.toLowerCase() !== "svg") {
    return { ok: false, reason: "The content is not an SVG document." };
  }

  const stripped: string[] = [];

  // Blocked subtrees first (snapshot — removal mutates the tree).
  for (const element of Array.from(root.querySelectorAll("*"))) {
    if (BLOCKED_ELEMENTS.has(element.nodeName.toLowerCase())) {
      element.remove();
      stripped.push(`blocked element ${describe(element)}`);
    }
  }

  // Attributes on the root and every remaining descendant.
  sanitizeAttributes(root, stripped);
  for (const element of Array.from(root.querySelectorAll("*"))) {
    sanitizeAttributes(element, stripped);
    if (element.nodeName.toLowerCase() === "style") {
      const scrub = scrubCss(element.textContent ?? "");
      if (scrub.changed) {
        element.textContent = scrub.css;
        stripped.push("external CSS in <style> block");
      }
    }
  }

  const svgRoot = root as unknown as SVGSVGElement;
  const size = viewBoxSize(svgRoot);
  return {
    ok: true,
    element: svgRoot,
    svgText: new XMLSerializer().serializeToString(svgRoot),
    stripped,
    width: size.width,
    height: size.height,
  };
}
