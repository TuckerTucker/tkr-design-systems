/**
 * SvgStage — native inline SVG rendering of one artifact version. The
 * server-sanitized text is parsed (with the client-side defense-in-depth
 * guard) and imported as real vector DOM — never an <img>, never
 * rasterized, stable node IDs intact. Malformed content renders an inline
 * error naming the version; nothing is ever half-rendered.
 */
import { useEffect, useMemo, useRef, type ReactElement } from "react";

import { parseArtifactSvg } from "./svgContent.js";

export interface SvgStageProps {
  svgText: string;
  versionNumber: number;
  /** Fill the frame's content box exactly (true platform dimensions). */
  width: number;
  height: number;
  /** The injected SVG's host element (inspect/highlight hit-testing). */
  onHostChange?: (host: HTMLDivElement | null) => void;
}

export function SvgStage(props: SvgStageProps): ReactElement {
  const { svgText, versionNumber, width, height, onHostChange } = props;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const parsed = useMemo(() => parseArtifactSvg(svgText), [svgText]);

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) {
      return;
    }
    if (!parsed.ok) {
      host.replaceChildren();
      return;
    }
    const imported = document.importNode(parsed.element, true);
    imported.setAttribute("width", "100%");
    imported.setAttribute("height", "100%");
    if (imported.getAttribute("viewBox") === null) {
      imported.setAttribute("viewBox", `0 0 ${width} ${height}`);
    }
    imported.setAttribute("focusable", "false");
    imported.setAttribute("aria-hidden", "true");
    host.replaceChildren(imported);
    onHostChange?.(host);
    return () => {
      host.replaceChildren();
      onHostChange?.(null);
    };
  }, [parsed, width, height, onHostChange]);

  if (!parsed.ok) {
    return (
      <div className="canvas-stage-error" role="alert">
        <p>
          <strong>Version {versionNumber} could not be rendered.</strong>
        </p>
        <p>{parsed.reason}</p>
        <p>Regenerate the version from chat, or restore an earlier one.</p>
      </div>
    );
  }

  return (
    <div
      ref={hostRef}
      className="canvas-svg-host"
      data-testid="canvas-svg-host"
      data-version={versionNumber}
    />
  );
}
