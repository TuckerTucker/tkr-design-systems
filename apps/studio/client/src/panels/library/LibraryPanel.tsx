/**
 * LibraryPanel — the visual browser over the registered design systems,
 * docked through the shell's panel registry (panels.tsx lazy target).
 *
 * Composition: system switcher (scopes everything), search (tokens AND
 * components, client-side over the cached index), token browser,
 * component gallery (progressive SVG loading through the client-side
 * sanitizer), and layout-template browser. Reference-into-chat emits
 * typed LibraryReference values through the shell seam (addReference).
 *
 * Degradation: bridge.status drives staleness — cached data stays
 * browsable through an outage with indicators in place; recovery
 * refetches silently. Keyless mode browses normally (no auth gate on
 * library routes). No toasts, no pagination, every error in place.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";

import type {
  ComponentIndexEntry,
  LayoutTemplate,
  LibraryReference,
  LibrarySystem,
  TokenSetResponse,
} from "@studio/contract";

import { useShellState } from "../../app/shellState.jsx";
import { ComponentGallery } from "./components/ComponentGallery.jsx";
import { useLibraryData, type LibraryDataState } from "./hooks/useLibraryData.js";
import {
  createLibraryApi,
  type LibraryApi,
  type LibraryResult,
} from "./model/libraryApi.js";
import {
  createLibraryCache,
  type LibraryCache,
} from "./model/libraryCache.js";
import { readSessionValue, writeSessionValue } from "./model/sessionState.js";
import { parseTokenSet, type TokenBrowserView } from "./model/types.js";
import { LayoutBrowser } from "./layouts/LayoutBrowser.jsx";
import {
  InlineError,
  InlineLoading,
  LibrarySection,
} from "./LibrarySection.jsx";
import { LibrarySearch } from "./search/LibrarySearch.jsx";
import {
  matchComponents,
  matchPalette,
  matchScale,
  normalizeQuery,
} from "./search/matchers.js";
import { SystemSwitcher } from "./SystemSwitcher.jsx";
import { TokenBrowser } from "./tokens/TokenBrowser.jsx";

import "./library.css";

/**
 * Module-level cache: survives panel collapse/remount, so an in-flight
 * fetch completing after collapse still lands and the expanded panel
 * renders instantly from cache (per-system entries retained for instant
 * switch-back).
 */
const sharedCache = createLibraryCache();

/**
 * Typed no-throw fallback for fetchers while no system is active — the
 * hooks never invoke a fetcher with a null cacheKey, so this only guards
 * the type seam.
 */
function noActiveSystem(): Promise<LibraryResult<never>> {
  return Promise.resolve({
    ok: false,
    error: {
      code: "system_not_found",
      message: "No design system is active yet.",
      fix: "Select a system in the switcher.",
    },
  });
}

export interface LibraryPanelProps {
  /** Injected in tests; defaults to the same-origin fetch client. */
  api?: LibraryApi;
  /** Injected in tests; defaults to the shared module-level cache. */
  cache?: LibraryCache;
}

const ACTIVE_SYSTEM_KEY = "activeSystem";

export function LibraryPanel(props: LibraryPanelProps): ReactElement {
  const injectedApi = props.api;
  const api = useMemo(() => injectedApi ?? createLibraryApi(), [injectedApi]);
  const cache = props.cache ?? sharedCache;
  const { bridgeStatus, addReference } = useShellState();

  const bridgeDown = bridgeStatus !== null && bridgeStatus.state !== "up";

  // Flip every cached payload stale the moment the bridge goes down; the
  // sections keep serving cached data with the indicator in place.
  const wasDown = useRef(bridgeDown);
  useEffect(() => {
    if (bridgeDown && !wasDown.current) {
      cache.markAllStale();
    }
    wasDown.current = bridgeDown;
  }, [bridgeDown, cache]);

  // ── Systems ──
  const fetchSystems = useCallback(
    (signal: AbortSignal) => api.listSystems(signal),
    [api],
  );
  const systems = useLibraryData<LibrarySystem[]>({
    cache,
    cacheKey: "systems",
    fetcher: fetchSystems,
    bridgeDown,
  });

  const [activeSystemId, setActiveSystemId] = useState<string | null>(null);

  // Restore the last-viewed system (silent, no save action) or default to
  // the first registered system once the list resolves.
  useEffect(() => {
    if (systems.state.status !== "ready") {
      return;
    }
    const list = systems.state.value;
    if (
      activeSystemId !== null &&
      list.some((system) => system.id === activeSystemId)
    ) {
      return;
    }
    const remembered = readSessionValue(ACTIVE_SYSTEM_KEY);
    const restored =
      remembered !== null && list.some((system) => system.id === remembered)
        ? remembered
        : (list[0]?.id ?? null);
    setActiveSystemId(restored);
  }, [systems.state, activeSystemId]);

  const selectSystem = useCallback((systemId: string): void => {
    setActiveSystemId(systemId);
    writeSessionValue(ACTIVE_SYSTEM_KEY, systemId);
  }, []);

  // ── Per-system data ──
  const fetchTokens = useCallback(
    (signal: AbortSignal) =>
      activeSystemId === null
        ? noActiveSystem()
        : api.getTokens(activeSystemId, signal),
    [api, activeSystemId],
  );
  const tokens = useLibraryData<TokenSetResponse>({
    cache,
    cacheKey: activeSystemId === null ? null : `tokens:${activeSystemId}`,
    fetcher: fetchTokens,
    bridgeDown,
  });

  const fetchComponents = useCallback(
    (signal: AbortSignal) =>
      activeSystemId === null
        ? noActiveSystem()
        : api.getComponents(activeSystemId, signal),
    [api, activeSystemId],
  );
  const components = useLibraryData<ComponentIndexEntry[]>({
    cache,
    cacheKey:
      activeSystemId === null ? null : `components:${activeSystemId}`,
    fetcher: fetchComponents,
    bridgeDown,
  });

  const fetchLayouts = useCallback(
    (signal: AbortSignal) =>
      activeSystemId === null
        ? noActiveSystem()
        : api.getLayouts(activeSystemId, signal),
    [api, activeSystemId],
  );
  const layouts = useLibraryData<LayoutTemplate[]>({
    cache,
    cacheKey: activeSystemId === null ? null : `layouts:${activeSystemId}`,
    fetcher: fetchLayouts,
    bridgeDown,
  });

  // ── Token view projection (parse once at the boundary) ──
  const tokensView = useMemo((): LibraryDataState<TokenBrowserView> => {
    if (tokens.state.status !== "ready") {
      return tokens.state;
    }
    return { ...tokens.state, value: parseTokenSet(tokens.state.value) };
  }, [tokens.state]);

  // ── Search ──
  const [query, setQuery] = useState("");
  const searching = normalizeQuery(query) !== "";
  const searchReady =
    tokensView.status === "ready" && components.state.status === "ready";

  const filteredComponents = useMemo(
    () =>
      components.state.status === "ready"
        ? matchComponents(components.state.value, query)
        : null,
    [components.state, query],
  );
  const tokenMatchCount = useMemo(() => {
    if (!searching || tokensView.status !== "ready") {
      return 0;
    }
    const view = tokensView.value;
    return (
      matchPalette(view.palette, query).length +
      (view.typography === null
        ? 0
        : matchScale(view.typography.scale, query).length)
    );
  }, [searching, tokensView, query]);

  const nothingMatches =
    searching &&
    searchReady &&
    tokenMatchCount === 0 &&
    (filteredComponents?.length ?? 0) === 0;

  const onReference = useCallback(
    (reference: LibraryReference): void => {
      addReference(reference);
    },
    [addReference],
  );

  // ArrowDown in the search field moves focus into the first result
  // (keyboard flow: focus search, arrow into results, Escape clears).
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const focusFirstResult = useCallback((): void => {
    resultsRef.current
      ?.querySelector<HTMLElement>("button, [tabindex='0']")
      ?.focus();
  }, []);

  const activeSystem =
    systems.state.status === "ready"
      ? (systems.state.value.find((system) => system.id === activeSystemId) ??
        null)
      : null;

  return (
    <div className="library-panel">
      <LibrarySection id="systems" title="Systems">
        {systems.state.status === "loading" ||
        systems.state.status === "idle" ? (
          <InlineLoading label="Loading design systems…" />
        ) : systems.state.status === "error" ? (
          <InlineError error={systems.state.error} onRetry={systems.retry} />
        ) : (
          <SystemSwitcher
            systems={systems.state.value}
            activeSystemId={activeSystemId}
            onSelect={selectSystem}
          />
        )}
      </LibrarySection>

      {activeSystem !== null ? (
        <div
          className="library-system-scope"
          aria-label={`${activeSystem.name} library`}
        >
            <LibrarySearch
              query={query}
              onQueryChange={setQuery}
              ready={searchReady}
              systemName={activeSystem.name}
              onArrowDown={focusFirstResult}
            />

            {nothingMatches ? (
              <div className="library-search-empty" role="status">
                <p>
                  Nothing in {activeSystem.name} matches “{query}”.
                </p>
                <button type="button" onClick={() => setQuery("")}>
                  Clear filter
                </button>
              </div>
            ) : (
              <div ref={resultsRef} className="library-results">
                <TokenBrowser
                  systemId={activeSystem.id}
                  state={tokensView}
                  query={query}
                  onReference={onReference}
                  onRetry={tokens.retry}
                />

                <LibrarySection
                  id="components"
                  title="Components"
                  count={
                    searching && filteredComponents !== null
                      ? filteredComponents.length
                      : null
                  }
                  staleSince={
                    components.state.status === "ready" &&
                    components.state.stale
                      ? components.state.fetchedAt
                      : null
                  }
                >
                  <ComponentGallery
                    systemId={activeSystem.id}
                    state={components.state}
                    components={filteredComponents}
                    api={api}
                    cache={cache}
                    bridgeDown={bridgeDown}
                    onReference={onReference}
                    onRetry={components.retry}
                  />
                </LibrarySection>

                {!searching ? (
                  <LibrarySection
                    id="layouts"
                    title="Layout templates"
                    staleSince={
                      layouts.state.status === "ready" && layouts.state.stale
                        ? layouts.state.fetchedAt
                        : null
                    }
                  >
                    <LayoutBrowser
                      systemId={activeSystem.id}
                      state={layouts.state}
                      onReference={onReference}
                      onRetry={layouts.retry}
                    />
                  </LibrarySection>
                ) : null}
              </div>
            )}
        </div>
      ) : null}
    </div>
  );
}

// React.lazy requires a default export from the lazy module boundary; the
// shell's panel registration is the only importer.
// eslint-disable-next-line no-restricted-exports
export default LibraryPanel;
