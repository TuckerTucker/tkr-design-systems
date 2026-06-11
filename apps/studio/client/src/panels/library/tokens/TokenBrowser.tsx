/**
 * Token browser — the collapsible token sections (palette, type scale,
 * spacing, borders/elevation) over the parsed wf_get_tokens payload.
 * Sections render what exists; staleness and search filtering arrive via
 * props from the panel root.
 */
import { useMemo, type ReactElement } from "react";

import type { ApiError, LibraryReference } from "@studio/contract";

import type { LibraryDataState } from "../hooks/useLibraryData.js";
import type { TokenBrowserView } from "../model/types.js";
import { matchPalette, matchScale, normalizeQuery } from "../search/matchers.js";
import { BorderElevationRules } from "./BorderElevationRules.jsx";
import { PaletteSwatches } from "./PaletteSwatches.jsx";
import { SpacingGrid } from "./SpacingGrid.jsx";
import { TypeScaleSpecimens } from "./TypeScaleSpecimens.jsx";
import {
  InlineError,
  InlineLoading,
  LibrarySection,
} from "../LibrarySection.jsx";

export interface TokenBrowserProps {
  systemId: string;
  state: LibraryDataState<TokenBrowserView>;
  query: string;
  onReference(reference: LibraryReference): void;
  onRetry(): void;
}

function bridgeDownError(error: ApiError): boolean {
  return error.code === "bridge_unavailable";
}

export function TokenBrowser(props: TokenBrowserProps): ReactElement {
  const { state, query } = props;
  const searching = normalizeQuery(query) !== "";

  const view = state.status === "ready" ? state.value : null;
  const filteredPalette = useMemo(
    () => (view === null ? [] : matchPalette(view.palette, query)),
    [view, query],
  );
  const filteredScale = useMemo(
    () =>
      view?.typography == null ? [] : matchScale(view.typography.scale, query),
    [view, query],
  );

  if (state.status === "loading" || state.status === "idle") {
    return <InlineLoading label="Loading tokens…" />;
  }
  if (state.status === "error") {
    return (
      <InlineError
        error={
          bridgeDownError(state.error)
            ? {
                ...state.error,
                message: `Tokens are unavailable: ${state.error.message}`,
              }
            : state.error
        }
        onRetry={props.onRetry}
      />
    );
  }
  if (view === null) {
    return <InlineLoading label="Loading tokens…" />;
  }

  const staleSince = state.stale ? state.fetchedAt : null;

  return (
    <div className="library-token-browser">
      <LibrarySection
        id="palette"
        title="Palette"
        staleSince={staleSince}
        count={searching ? filteredPalette.length : null}
      >
        {searching && filteredPalette.length === 0 ? (
          <p className="library-empty" role="status">
            No palette entries match.
          </p>
        ) : (
          <PaletteSwatches
            systemId={props.systemId}
            entries={filteredPalette}
            onReference={props.onReference}
          />
        )}
      </LibrarySection>

      {view.typography !== null ? (
        <LibrarySection
          id="type-scale"
          title="Type scale"
          staleSince={staleSince}
          count={searching ? filteredScale.length : null}
        >
          {searching && filteredScale.length === 0 ? (
            <p className="library-empty" role="status">
              No type-scale entries match.
            </p>
          ) : (
            <TypeScaleSpecimens
              systemId={props.systemId}
              typography={{ ...view.typography, scale: filteredScale }}
              onReference={props.onReference}
            />
          )}
        </LibrarySection>
      ) : null}

      {!searching && view.layout !== null ? (
        <LibrarySection id="spacing" title="Spacing" staleSince={staleSince}>
          <SpacingGrid layout={view.layout} />
        </LibrarySection>
      ) : null}

      {!searching && view.drawingRules !== null ? (
        <LibrarySection
          id="borders"
          title="Borders & elevation"
          staleSince={staleSince}
        >
          <BorderElevationRules drawingRules={view.drawingRules} />
        </LibrarySection>
      ) : null}
    </div>
  );
}
