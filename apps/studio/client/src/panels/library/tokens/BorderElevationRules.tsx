/**
 * Border-radius and elevation rules — radius values drawn as corner
 * examples (square corners labeled "0" for no-radius systems, never an
 * empty section); borders-only systems draw their stroke_border /
 * stroke_border_strong rules, other strategies render the elevation note
 * verbatim (e.g. Swiss "typographic").
 */
import type { ReactElement } from "react";

import type { DrawingRulesView } from "../model/types.js";

export interface BorderElevationRulesProps {
  drawingRules: DrawingRulesView;
}

interface ParsedStroke {
  color: string;
  width: number;
}

/** Parse an SVG attribute string like "stroke='#E0E0E0' stroke-width='1'". */
export function parseStrokeRule(rule: string): ParsedStroke | null {
  const colorMatch = /stroke=['"]([^'"]+)['"]/.exec(rule);
  const widthMatch = /stroke-width=['"]([^'"]+)['"]/.exec(rule);
  if (colorMatch?.[1] === undefined) {
    return null;
  }
  const width = widthMatch?.[1] !== undefined ? Number(widthMatch[1]) : 1;
  return {
    color: colorMatch[1],
    width: Number.isFinite(width) && width > 0 ? width : 1,
  };
}

function RadiusExample(props: { label: string; radius: number }): ReactElement {
  return (
    <li className="library-radius-example">
      <span
        className="library-radius-box"
        style={{ borderRadius: `${props.radius}px` }}
        aria-hidden="true"
      />
      <span className="library-radius-label">
        {props.label}: {props.radius}
      </span>
    </li>
  );
}

function StrokeExample(props: { label: string; rule: string }): ReactElement {
  const parsed = parseStrokeRule(props.rule);
  return (
    <li className="library-stroke-example">
      {parsed !== null ? (
        <span
          className="library-stroke-box"
          style={{ border: `${parsed.width}px solid ${parsed.color}` }}
          aria-hidden="true"
        />
      ) : null}
      <span className="library-stroke-label">
        {props.label}: <code>{props.rule}</code>
      </span>
    </li>
  );
}

export function BorderElevationRules(
  props: BorderElevationRulesProps,
): ReactElement {
  const rules = props.drawingRules;
  const bordersOnly =
    rules.strokeBorder !== null || rules.strokeBorderStrong !== null;
  return (
    <div className="library-borders">
      <ul className="library-radius-list" aria-label="Border radius examples">
        <RadiusExample label="default" radius={rules.radiusDefault} />
        <RadiusExample label="inputs" radius={rules.radiusInputs} />
        <RadiusExample label="chrome" radius={rules.radiusChrome} />
      </ul>
      {bordersOnly ? (
        <ul className="library-stroke-list" aria-label="Elevation strokes">
          {rules.strokeBorder !== null ? (
            <StrokeExample label="border" rule={rules.strokeBorder} />
          ) : null}
          {rules.strokeBorderStrong !== null ? (
            <StrokeExample
              label="border strong"
              rule={rules.strokeBorderStrong}
            />
          ) : null}
        </ul>
      ) : (
        <p className="library-elevation-note">{rules.elevationNote}</p>
      )}
    </div>
  );
}
