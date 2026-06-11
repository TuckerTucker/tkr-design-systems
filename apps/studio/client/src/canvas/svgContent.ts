/**
 * Artifact SVG content handling — parse server-sanitized SVG text into a
 * real DOM node for native inline rendering (never rasterized), with a
 * defense-in-depth guard, and id-prefixing for filmstrip thumbnails so
 * duplicate stable node IDs never collide in one document.
 *
 * The server (artifact-pipeline) is the sanitizer of record; this guard
 * still treats content as untrusted per the capability spec: script
 * elements, event-handler attributes, and external references are rejected
 * client-side. Malformed content is rejected whole — never half-rendered.
 */

export type SvgParseResult =
  | { ok: true; element: SVGSVGElement; width: number; height: number }
  | { ok: false; reason: string };

const BLOCKED_ELEMENTS = new Set(["script", "foreignobject", "iframe", "embed", "object"]);

function viewBoxSize(root: SVGSVGElement): { width: number; height: number } {
  const widthAttr = Number(root.getAttribute("width"));
  const heightAttr = Number(root.getAttribute("height"));
  if (Number.isFinite(widthAttr) && widthAttr > 0 && Number.isFinite(heightAttr) && heightAttr > 0) {
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

function offendingAttribute(element: Element): string | null {
  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name.toLowerCase();
    if (name.startsWith("on")) {
      return `event handler attribute "${attribute.name}"`;
    }
    if (name === "href" || name === "xlink:href") {
      const value = attribute.value.trim();
      if (!value.startsWith("#")) {
        return `external reference "${attribute.name}=${value}"`;
      }
    }
  }
  return null;
}

/**
 * Parse sanitized artifact SVG text. Returns the detached <svg> element
 * (caller imports it into the document) or a structured rejection naming
 * what was wrong — the offending content is never partially inserted.
 */
export function parseArtifactSvg(svgText: string): SvgParseResult {
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
  const elements = [root, ...Array.from(root.querySelectorAll("*"))];
  for (const element of elements) {
    if (BLOCKED_ELEMENTS.has(element.nodeName.toLowerCase())) {
      return {
        ok: false,
        reason: `The SVG contains a blocked <${element.nodeName}> element.`,
      };
    }
    const offence = offendingAttribute(element);
    if (offence !== null) {
      return { ok: false, reason: `The SVG contains an ${offence}.` };
    }
  }
  const size = viewBoxSize(root as unknown as SVGSVGElement);
  return {
    ok: true,
    element: root as unknown as SVGSVGElement,
    width: size.width,
    height: size.height,
  };
}

const URL_REF_PATTERN = /url\(#([^)]+)\)/g;

/**
 * Prefix every id (and internal #id reference) inside an SVG element so a
 * thumbnail copy never collides with the stage's stable node IDs. Mutates
 * the given element (callers pass a fresh clone).
 */
export function applyIdPrefix(root: Element, prefix: string): void {
  const elements = [root, ...Array.from(root.querySelectorAll("*"))];
  for (const element of elements) {
    const id = element.getAttribute("id");
    if (id !== null) {
      element.setAttribute("id", `${prefix}${id}`);
    }
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if ((name === "href" || name === "xlink:href") && attribute.value.startsWith("#")) {
        element.setAttribute(attribute.name, `#${prefix}${attribute.value.slice(1)}`);
      } else if (attribute.value.includes("url(#")) {
        element.setAttribute(
          attribute.name,
          attribute.value.replace(URL_REF_PATTERN, `url(#${prefix}$1)`),
        );
      }
    }
  }
}
