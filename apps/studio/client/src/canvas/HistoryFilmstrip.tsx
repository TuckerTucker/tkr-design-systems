/**
 * HistoryFilmstrip — version thumbnails under the stage, oldest → newest
 * with the head marked. Thumbnails are scaled NATIVE SVG (id-prefixed so
 * stable node IDs never collide with the stage). Hover or arrow keys scrub
 * the stage to a preview; leaving returns to head; Enter restores the
 * scrubbed version as a NEW head with an inline Undo — never a
 * confirmation dialog (restore destroys nothing; undo restores the
 * previous head as another new head).
 */
import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
} from "react";

import type { ApiError } from "@studio/contract";

import { scrubMoveTarget, type FilmstripEntry, type ScrubMove } from "./filmstrip.js";
import type { UndoState } from "./state.js";
import { applyIdPrefix, parseArtifactSvg } from "./svgContent.js";

export interface HistoryFilmstripProps {
  entries: FilmstripEntry[];
  headVersion: number | null;
  /** null → the stage renders head. */
  scrubVersion: number | null;
  restorePending: boolean;
  restoreError: ApiError | null;
  undo: UndoState | null;
  onScrub(version: number | null): void;
  onRestore(version: number): void;
  /** Cached SVG text for a version, or null while it loads. */
  getSvg(version: number): string | null;
  /** Ask the panel to fetch a version's SVG (cached; immutable). */
  requestSvg(version: number): void;
}

function Thumbnail(props: { version: number; svgText: string | null }): ReactElement {
  const { version, svgText } = props;
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) {
      return;
    }
    if (svgText === null) {
      host.replaceChildren();
      return;
    }
    const parsed = parseArtifactSvg(svgText);
    if (!parsed.ok) {
      host.replaceChildren();
      return;
    }
    const imported = document.importNode(parsed.element, true);
    applyIdPrefix(imported, `thumb-v${version}-`);
    imported.setAttribute("width", "100%");
    imported.setAttribute("height", "100%");
    if (imported.getAttribute("viewBox") === null && parsed.width > 0) {
      imported.setAttribute("viewBox", `0 0 ${parsed.width} ${parsed.height}`);
    }
    imported.setAttribute("preserveAspectRatio", "xMidYMid meet");
    imported.setAttribute("aria-hidden", "true");
    imported.setAttribute("focusable", "false");
    host.replaceChildren(imported);
    return () => host.replaceChildren();
  }, [svgText, version]);

  return (
    <div
      ref={hostRef}
      className="canvas-thumbnail-svg"
      data-testid={`thumbnail-svg-${version}`}
    />
  );
}

export function HistoryFilmstrip(props: HistoryFilmstripProps): ReactElement {
  const {
    entries,
    headVersion,
    scrubVersion,
    restorePending,
    restoreError,
    undo,
    onScrub,
    onRestore,
    getSvg,
    requestSvg,
  } = props;

  // Thumbnails want every version's (immutable, cached) SVG.
  useEffect(() => {
    for (const entry of entries) {
      if (getSvg(entry.version) === null) {
        requestSvg(entry.version);
      }
    }
  }, [entries, getSvg, requestSvg]);

  const singleVersion = entries.length === 1;

  const move = (direction: ScrubMove): void => {
    onScrub(scrubMoveTarget(entries, headVersion, scrubVersion, direction));
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    switch (event.key) {
      case "ArrowLeft":
        move("previous");
        break;
      case "ArrowRight":
        move("next");
        break;
      case "Home":
        move("first");
        break;
      case "End":
        move("head");
        break;
      case "Enter":
        if (scrubVersion !== null && scrubVersion !== headVersion && !singleVersion && !restorePending) {
          onRestore(scrubVersion);
        }
        break;
      case "Escape":
        if (scrubVersion !== null) {
          onScrub(null);
          break;
        }
        return;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div className="canvas-filmstrip" data-testid="canvas-filmstrip">
      <div
        className="canvas-filmstrip-strip"
        role="listbox"
        aria-label="Version history (Left/Right scrub, Home first, End head, Enter restores)"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onMouseLeave={() => onScrub(null)}
      >
        {entries.map((entry) => {
          const previewed =
            scrubVersion === entry.version ||
            (scrubVersion === null && entry.isHead);
          const restoreDisabledReason = singleVersion
            ? "This is the only version — generate another before restoring."
            : entry.isHead
              ? "Already the head version."
              : restorePending
                ? "A restore is already in flight."
                : null;
          return (
            <div
              key={entry.version}
              className="canvas-filmstrip-entry"
              data-testid={`filmstrip-entry-${entry.version}`}
              data-head={entry.isHead ? "true" : undefined}
              data-previewed={previewed ? "true" : undefined}
              role="option"
              aria-selected={previewed}
              aria-label={`Version ${entry.version}${entry.isHead ? " (head)" : ""} — ${entry.brief} — ${entry.tool} — ${entry.createdAt}`}
              title={`v${entry.version}${entry.isHead ? " · head" : ""}\n${entry.brief}\n${entry.tool} · ${entry.createdAt}`}
              onMouseEnter={() => onScrub(entry.isHead ? null : entry.version)}
            >
              <Thumbnail version={entry.version} svgText={getSvg(entry.version)} />
              <div className="canvas-filmstrip-caption">
                <span className="canvas-filmstrip-version">
                  v{entry.version}
                  {entry.isHead ? <span className="canvas-filmstrip-head-mark"> · head</span> : null}
                </span>
                <button
                  type="button"
                  className="canvas-filmstrip-restore"
                  disabled={restoreDisabledReason !== null}
                  title={restoreDisabledReason ?? `Restore v${entry.version} as a new head`}
                  onClick={() => onRestore(entry.version)}
                >
                  Restore
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {restoreError !== null ? (
        <p className="canvas-filmstrip-error" role="alert">
          {restoreError.message} {restoreError.fix}
        </p>
      ) : null}
      {undo !== null ? (
        <p className="canvas-filmstrip-undo" role="status">
          Restored as v{undo.restoredAs}.
          <button
            type="button"
            className="canvas-filmstrip-undo-button"
            disabled={restorePending}
            onClick={() => onRestore(undo.undoTarget)}
          >
            Undo — bring back v{undo.undoTarget}
          </button>
        </p>
      ) : null}
    </div>
  );
}
