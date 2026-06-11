/**
 * Inline renderer for sanitized library SVGs — imports a clone of the
 * sanitized element into the document (native SVG, never rasterized) and
 * scales it to the container at viewBox proportions.
 */
import { useEffect, useRef, type ReactElement } from "react";

import type { SanitizedSvg } from "./sanitizeSvg.js";

export interface InlineSvgProps {
  sanitized: SanitizedSvg;
  /** Accessible name for the rendered graphic. */
  label: string;
}

export function InlineSvg(props: InlineSvgProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { sanitized } = props;

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    const clone = sanitized.element.cloneNode(true) as SVGSVGElement;
    // Scale to the container at viewBox proportions; declare a viewBox
    // from the intrinsic size when the source only set width/height.
    if (
      clone.getAttribute("viewBox") === null &&
      sanitized.width > 0 &&
      sanitized.height > 0
    ) {
      clone.setAttribute("viewBox", `0 0 ${sanitized.width} ${sanitized.height}`);
    }
    clone.removeAttribute("width");
    clone.removeAttribute("height");
    // The labeled container is the accessible image; the clone itself
    // stays out of the accessibility tree (no nested unlabeled role).
    clone.setAttribute("aria-hidden", "true");
    container.replaceChildren(document.importNode(clone, true));
    return () => {
      container.replaceChildren();
    };
  }, [sanitized]);

  return (
    <div
      ref={containerRef}
      className="library-inline-svg"
      role="img"
      aria-label={props.label}
    />
  );
}
