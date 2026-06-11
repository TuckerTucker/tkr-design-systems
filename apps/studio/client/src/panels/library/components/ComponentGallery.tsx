/**
 * Component gallery — one card per component from the index on a single
 * scrollable surface (no pagination). SVGs load progressively per card
 * via IntersectionObserver; the index itself arrives through
 * useLibraryData with staleness and inline errors handled here.
 */
import { type ReactElement } from "react";

import type { ComponentIndexEntry, LibraryReference } from "@studio/contract";

import type { LibraryDataState } from "../hooks/useLibraryData.js";
import type { LibraryApi } from "../model/libraryApi.js";
import type { LibraryCache } from "../model/libraryCache.js";
import { ComponentCard } from "./ComponentCard.jsx";
import {
  InlineError,
  InlineLoading,
} from "../LibrarySection.jsx";

export interface ComponentGalleryProps {
  systemId: string;
  state: LibraryDataState<ComponentIndexEntry[]>;
  /** Already search-filtered by the panel root. */
  components: readonly ComponentIndexEntry[] | null;
  api: LibraryApi;
  cache: LibraryCache;
  bridgeDown: boolean;
  onReference(reference: LibraryReference): void;
  onRetry(): void;
}

export function ComponentGallery(props: ComponentGalleryProps): ReactElement {
  const { state } = props;

  if (state.status === "loading" || state.status === "idle") {
    return <InlineLoading label="Loading components…" />;
  }
  if (state.status === "error") {
    return <InlineError error={state.error} onRetry={props.onRetry} />;
  }

  const components = props.components ?? state.value;
  if (state.value.length === 0) {
    return (
      <p className="library-empty" role="status">
        This system declares no components.
      </p>
    );
  }
  if (components.length === 0) {
    return (
      <p className="library-empty" role="status">
        No components match.
      </p>
    );
  }

  return (
    <ul className="library-gallery" aria-label="Components">
      {components.map((component) => (
        <ComponentCard
          key={`${props.systemId}:${component.id}`}
          systemId={props.systemId}
          component={component}
          api={props.api}
          cache={props.cache}
          bridgeDown={props.bridgeDown}
          onReference={props.onReference}
        />
      ))}
    </ul>
  );
}
