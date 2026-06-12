/**
 * Layout-template browser — one card per template from
 * /api/library/:systemId/layouts (id, name, archetype, platforms,
 * description). The wire payload carries no layout SVG (LayoutTemplate in
 * @studio/contract, owned by studio-api), so cards render a schematic
 * glyph with the template's name, platforms, and spec description;
 * activation (click or Enter) expands an in-panel preview with the full
 * description — no modal, no navigation away; Escape returns to the grid.
 */
import {
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
} from "react";

import type { LayoutTemplate, LibraryReference } from "@studio/contract";

import type { LibraryDataState } from "../hooks/useLibraryData.js";
import {
  InlineError,
  InlineLoading,
  StaleNote,
} from "../LibrarySection.jsx";
import {
  encodeReferenceDrag,
  layoutReference,
} from "../reference/referencePayload.js";
import { SendToChatAction } from "../reference/SendToChatAction.jsx";

export interface LayoutBrowserProps {
  systemId: string;
  state: LibraryDataState<LayoutTemplate[]>;
  onReference(reference: LibraryReference): void;
  onRetry(): void;
}

function LayoutGlyph(): ReactElement {
  return (
    <svg
      viewBox="0 0 48 32"
      className="library-layout-glyph"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="46" height="30" fill="none" stroke="currentColor" />
      <rect x="3" y="3" width="12" height="26" fill="currentColor" opacity="0.35" />
      <rect x="18" y="3" width="27" height="8" fill="currentColor" opacity="0.2" />
      <rect x="18" y="14" width="27" height="15" fill="currentColor" opacity="0.12" />
    </svg>
  );
}

export function LayoutBrowser(props: LayoutBrowserProps): ReactElement {
  const { state } = props;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (state.status === "loading" || state.status === "idle") {
    return <InlineLoading label="Loading layout templates…" />;
  }
  if (state.status === "error") {
    return <InlineError error={state.error} onRetry={props.onRetry} />;
  }
  if (state.value.length === 0) {
    return (
      <p className="library-empty" role="status">
        This system declares no layout templates.
      </p>
    );
  }

  function onCardKeyDown(
    event: ReactKeyboardEvent<HTMLElement>,
    templateId: string,
  ): void {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setExpandedId((current) => (current === templateId ? null : templateId));
    } else if (event.key === "Escape" && expandedId === templateId) {
      event.preventDefault();
      setExpandedId(null);
    }
  }

  return (
    <div className="library-layouts">
      {state.stale ? <StaleNote fetchedAt={state.fetchedAt} /> : null}
      <ul className="library-layout-grid" aria-label="Layout templates">
        {state.value.map((template) => {
          const expanded = expandedId === template.id;
          const reference = layoutReference(props.systemId, template);
          return (
            <li
              key={template.id}
              className="library-layout-card"
              data-expanded={expanded ? "true" : undefined}
            >
              <div
                role="button"
                tabIndex={0}
                aria-expanded={expanded}
                aria-label={`${template.name} layout template`}
                className="library-layout-activate"
                draggable
                onDragStart={(event) =>
                  encodeReferenceDrag(event.dataTransfer, reference)
                }
                onClick={() =>
                  setExpandedId((current) =>
                    current === template.id ? null : template.id,
                  )
                }
                onKeyDown={(event) => onCardKeyDown(event, template.id)}
              >
                <LayoutGlyph />
                <span className="library-layout-name">{template.name}</span>
                <code className="library-layout-id">{template.id}</code>
                <span className="library-layout-platforms">
                  {template.platforms.join(" · ")}
                </span>
                {!expanded && template.description !== undefined ? (
                  <span className="library-layout-description">
                    {template.description}
                  </span>
                ) : null}
              </div>
              {expanded ? (
                <div className="library-layout-preview">
                  <p className="library-layout-description-full">
                    {template.description ?? "No description in the spec."}
                  </p>
                  <button type="button" onClick={() => setExpandedId(null)}>
                    Close preview
                  </button>
                </div>
              ) : null}
              <SendToChatAction
                reference={reference}
                onSend={props.onReference}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
