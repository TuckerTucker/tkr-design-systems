/**
 * Type-scale specimens — every scale entry rendered at its TRUE pixel
 * size in the system's structural font stack (real-size is the contract:
 * a 40px display specimen renders at 40px even in a narrow panel and
 * scrolls horizontally, never scales down). Case and tracking rules
 * display beside the specimens they govern.
 */
import { type CSSProperties, type ReactElement } from "react";

import type { LibraryReference } from "@studio/contract";

import type { TypographyView } from "../model/types.js";
import { scaleReference } from "../reference/referencePayload.js";
import { SendToChatAction } from "../reference/SendToChatAction.jsx";

export interface TypeScaleSpecimensProps {
  systemId: string;
  typography: TypographyView;
  onReference(reference: LibraryReference): void;
}

const SPECIMEN_TEXT = "Hamburgefonstiv 0123";

export function TypeScaleSpecimens(
  props: TypeScaleSpecimensProps,
): ReactElement {
  const { typography } = props;
  if (typography.scale.length === 0) {
    return (
      <p className="library-empty" role="status">
        This system declares no type scale.
      </p>
    );
  }

  return (
    <div className="library-type-scale">
      <p className="library-type-stack">
        <span className="library-token-label">Structural stack</span>
        <code>{typography.fontStackStructural}</code>
      </p>
      {typography.fontStackMono !== "" ? (
        <p className="library-type-stack">
          <span className="library-token-label">Mono stack</span>
          <code>{typography.fontStackMono}</code>
        </p>
      ) : null}
      <ul className="library-specimens">
        {typography.scale.map((entry) => {
          const caseRule = typography.caseRules[entry.role];
          const tracking = typography.tracking[entry.role];
          const style: CSSProperties = {
            fontSize: `${entry.px}px`,
            fontFamily: typography.fontStackStructural,
            ...(caseRule === "uppercase" ? { textTransform: "uppercase" } : {}),
            ...(tracking !== undefined && tracking !== 0
              ? { letterSpacing: `${tracking}em` }
              : {}),
          };
          return (
            <li key={`${entry.px}-${entry.role}`} className="library-specimen">
              <div className="library-specimen-meta">
                <span className="library-specimen-size">{entry.px}px</span>
                <span className="library-specimen-role">{entry.role}</span>
                {caseRule !== undefined && caseRule !== "" ? (
                  <span className="library-specimen-rule">case: {caseRule}</span>
                ) : null}
                {tracking !== undefined && tracking !== 0 ? (
                  <span className="library-specimen-rule">
                    tracking: {tracking}em
                  </span>
                ) : null}
              </div>
              <div className="library-specimen-sample-wrap">
                <span
                  className="library-specimen-sample"
                  style={style}
                  data-px={entry.px}
                >
                  {SPECIMEN_TEXT}
                </span>
              </div>
              <SendToChatAction
                reference={scaleReference(props.systemId, entry)}
                onSend={props.onReference}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
