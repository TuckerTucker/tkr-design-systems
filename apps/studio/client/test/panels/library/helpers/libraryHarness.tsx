/**
 * Library-panel component-test harness — a deterministic in-memory
 * LibraryApi serving the REAL fixture payloads (captured server
 * projections + the real swiss library SVG), a render helper composing
 * LibraryPanel inside a real ShellStateProvider over the fake socket, a
 * reference bridge exposing the shell's library→chat seam to tests, and a
 * controllable IntersectionObserver for progressive-loading tests.
 */
import { render, type RenderResult } from "@testing-library/react";
import { useEffect, type ReactElement } from "react";

import type {
  ApiError,
  BridgeStatusPayload,
  ComponentDetail,
  ComponentIndexEntry,
  LayoutTemplate,
  LibraryReference,
  LibrarySystem,
  TokenSetResponse,
} from "@studio/contract";

import { ShellStateProvider, useShellState } from "../../../../src/app/shellState.jsx";
import { LibraryPanel } from "../../../../src/panels/library/LibraryPanel.jsx";
import type {
  LibraryApi,
  LibraryResult,
} from "../../../../src/panels/library/model/libraryApi.js";
import {
  createLibraryCache,
  type LibraryCache,
} from "../../../../src/panels/library/model/libraryCache.js";
import { createWorkspaceHistory } from "../../../../src/routing/workspaceRoutes.js";
import {
  createFakeApi,
  createFakeSocket,
  workspaceSummary,
  type FakeStudioSocket,
} from "../../../unit/helpers/fakes.js";
import {
  librarySystems,
  swissButtonDetail,
  swissComponents,
  swissLayouts,
  swissTokens,
} from "./fixtures.js";

export const WS_ID = "ws-library";

// ── Fake LibraryApi over the real fixture payloads ──

export interface FakeLibraryApi extends LibraryApi {
  /** Per-method invocation counts (cache behavior assertions). */
  calls: {
    listSystems: number;
    getTokens: string[];
    getComponents: string[];
    getComponentDetail: string[];
    getLayouts: string[];
  };
  systems: LibrarySystem[];
  /** Token payloads keyed by system id. */
  tokens: Map<string, TokenSetResponse>;
  components: Map<string, ComponentIndexEntry[]>;
  /** `${systemId}:${componentId}` → detail. */
  details: Map<string, ComponentDetail>;
  layouts: Map<string, LayoutTemplate[]>;
  /** Forced failures (route key → error). */
  failSystems: ApiError | null;
  failTokens: Map<string, ApiError>;
  failComponents: Map<string, ApiError>;
  failDetail: Map<string, ApiError>;
  failLayouts: Map<string, ApiError>;
}

function bridgeDownError(): ApiError {
  return {
    code: "bridge_unavailable",
    message: "The MCP bridge is not running.",
    fix: "Wait for the bridge to restart, then retry.",
  };
}

function notFound(what: string): ApiError {
  return {
    code: "system_not_found",
    message: `${what} was not found.`,
    fix: "List systems via GET /api/library/systems.",
  };
}

/** A fake api preloaded with the real swiss fixture projections. */
export function createFakeLibraryApi(): FakeLibraryApi {
  const detail = swissButtonDetail();
  const fake: FakeLibraryApi = {
    calls: {
      listSystems: 0,
      getTokens: [],
      getComponents: [],
      getComponentDetail: [],
      getLayouts: [],
    },
    systems: librarySystems(),
    tokens: new Map([["swiss", swissTokens()]]),
    components: new Map([["swiss", swissComponents()]]),
    details: new Map(
      swissComponents().map((entry) => [
        `swiss:${entry.id}`,
        { ...entry, svg: detail.svg },
      ]),
    ),
    layouts: new Map([["swiss", swissLayouts()]]),
    failSystems: null,
    failTokens: new Map(),
    failComponents: new Map(),
    failDetail: new Map(),
    failLayouts: new Map(),

    async listSystems(): Promise<LibraryResult<LibrarySystem[]>> {
      fake.calls.listSystems += 1;
      if (fake.failSystems !== null) {
        return { ok: false, error: fake.failSystems };
      }
      return { ok: true, value: fake.systems.map((system) => ({ ...system })) };
    },

    async getTokens(systemId): Promise<LibraryResult<TokenSetResponse>> {
      fake.calls.getTokens.push(systemId);
      const forced = fake.failTokens.get(systemId);
      if (forced !== undefined) {
        return { ok: false, error: forced };
      }
      const payload = fake.tokens.get(systemId);
      if (payload === undefined) {
        return { ok: false, error: notFound(`Tokens for ${systemId}`) };
      }
      return { ok: true, value: payload };
    },

    async getComponents(
      systemId,
    ): Promise<LibraryResult<ComponentIndexEntry[]>> {
      fake.calls.getComponents.push(systemId);
      const forced = fake.failComponents.get(systemId);
      if (forced !== undefined) {
        return { ok: false, error: forced };
      }
      const index = fake.components.get(systemId);
      if (index === undefined) {
        return { ok: false, error: notFound(`Components for ${systemId}`) };
      }
      return { ok: true, value: index.map((entry) => ({ ...entry })) };
    },

    async getComponentDetail(
      systemId,
      componentId,
    ): Promise<LibraryResult<ComponentDetail>> {
      const key = `${systemId}:${componentId}`;
      fake.calls.getComponentDetail.push(key);
      const forced = fake.failDetail.get(key);
      if (forced !== undefined) {
        return { ok: false, error: forced };
      }
      const entry = fake.details.get(key);
      if (entry === undefined) {
        return { ok: false, error: notFound(`Component ${key}`) };
      }
      return { ok: true, value: { ...entry } };
    },

    async getLayouts(systemId): Promise<LibraryResult<LayoutTemplate[]>> {
      fake.calls.getLayouts.push(systemId);
      const forced = fake.failLayouts.get(systemId);
      if (forced !== undefined) {
        return { ok: false, error: forced };
      }
      const layouts = fake.layouts.get(systemId);
      if (layouts === undefined) {
        return { ok: false, error: notFound(`Layouts for ${systemId}`) };
      }
      return { ok: true, value: layouts.map((layout) => ({ ...layout })) };
    },
  };
  return fake;
}

export { bridgeDownError };

// ── Controllable IntersectionObserver ──

export interface IntersectionControl {
  /** Mark targets matching the predicate visible (all when omitted). */
  reveal(predicate?: (target: Element) => boolean): void;
  /** Every element currently observed. */
  observed(): Element[];
  /** Remove the mock (restore jsdom's "unsupported" default). */
  uninstall(): void;
}

/**
 * Install a controllable IntersectionObserver before render; without it
 * jsdom has none and useProgressiveLoad degrades to immediately-visible.
 */
export function installIntersectionObserver(): IntersectionControl {
  const observers = new Map<
    FakeIntersectionObserver,
    Set<Element>
  >();

  class FakeIntersectionObserver {
    callback: IntersectionObserverCallback;
    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback;
      observers.set(this, new Set());
    }
    observe(target: Element): void {
      observers.get(this)?.add(target);
    }
    unobserve(target: Element): void {
      observers.get(this)?.delete(target);
    }
    disconnect(): void {
      observers.delete(this);
    }
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }

  const original = (
    globalThis as { IntersectionObserver?: typeof IntersectionObserver }
  ).IntersectionObserver;
  (globalThis as { IntersectionObserver: unknown }).IntersectionObserver =
    FakeIntersectionObserver;

  return {
    reveal(predicate): void {
      for (const [observer, targets] of [...observers.entries()]) {
        const matched = [...targets].filter(
          (target) => predicate === undefined || predicate(target),
        );
        if (matched.length === 0) {
          continue;
        }
        observer.callback(
          matched.map(
            (target) =>
              ({ target, isIntersecting: true }) as IntersectionObserverEntry,
          ),
          observer as unknown as IntersectionObserver,
        );
      }
    },
    observed(): Element[] {
      return [...observers.values()].flatMap((targets) => [...targets]);
    },
    uninstall(): void {
      if (original === undefined) {
        delete (globalThis as { IntersectionObserver?: unknown })
          .IntersectionObserver;
      } else {
        (globalThis as { IntersectionObserver: unknown }).IntersectionObserver =
          original;
      }
      observers.clear();
    },
  };
}

// ── Render helper ──

export interface ReferenceSeam {
  /** Latest pending references on the shell seam. */
  pending(): readonly LibraryReference[];
  remove(index: number): void;
  consume(): LibraryReference[];
}

export interface LibraryRender extends RenderResult {
  socket: FakeStudioSocket;
  libraryApi: FakeLibraryApi;
  cache: LibraryCache;
  references: ReferenceSeam;
  emitBridge(state: BridgeStatusPayload["state"]): void;
}

interface SeamHolder {
  pending: readonly LibraryReference[];
  remove: (index: number) => void;
  consume: () => LibraryReference[];
}

function ReferenceBridge(props: { holder: SeamHolder }): null {
  const { pendingReferences, removeReference, consumeReferences } =
    useShellState();
  const { holder } = props;
  holder.pending = pendingReferences;
  useEffect(() => {
    holder.remove = removeReference;
    holder.consume = consumeReferences;
  }, [holder, removeReference, consumeReferences]);
  return null;
}

export function renderLibrary(
  options: {
    libraryApi?: FakeLibraryApi;
    cache?: LibraryCache;
    socket?: FakeStudioSocket;
  } = {},
): LibraryRender {
  const socket = options.socket ?? createFakeSocket();
  const libraryApi = options.libraryApi ?? createFakeLibraryApi();
  const cache = options.cache ?? createLibraryCache();
  const shellApi = createFakeApi({ workspaces: [workspaceSummary(WS_ID)] });
  const holder: SeamHolder = {
    pending: [],
    remove: () => undefined,
    consume: () => [],
  };

  const ui: ReactElement = (
    <ShellStateProvider
      socket={socket}
      api={shellApi}
      history={createWorkspaceHistory()}
      initialWorkspaceId={WS_ID}
    >
      <ReferenceBridge holder={holder} />
      <LibraryPanel api={libraryApi} cache={cache} />
    </ShellStateProvider>
  );
  const result = render(ui);

  return Object.assign(result, {
    socket,
    libraryApi,
    cache,
    references: {
      pending: () => holder.pending,
      remove: (index: number) => holder.remove(index),
      consume: () => holder.consume(),
    },
    emitBridge(state: BridgeStatusPayload["state"]): void {
      socket.emit({
        type: "bridge.status",
        seq: 0,
        payload: {
          state,
          restartCount: 0,
          since: "2026-06-10T00:00:00.000Z",
        },
      });
    },
  });
}

/** Clear the panel's persisted UI state between tests. */
export function clearLibraryStorage(): void {
  const doomed: string[] = [];
  for (let index = 0; index < globalThis.localStorage.length; index += 1) {
    const key = globalThis.localStorage.key(index);
    if (key !== null && key.startsWith("studio.library.")) {
      doomed.push(key);
    }
  }
  for (const key of doomed) {
    globalThis.localStorage.removeItem(key);
  }
}

/** A minimal DataTransfer stand-in (jsdom has no constructor). */
export interface FakeDataTransfer {
  data: Map<string, string>;
  effectAllowed: string;
  setData(type: string, value: string): void;
  getData(type: string): string;
}

export function createFakeDataTransfer(): FakeDataTransfer {
  const data = new Map<string, string>();
  return {
    data,
    effectAllowed: "uninitialized",
    setData(type: string, value: string): void {
      data.set(type, value);
    },
    getData(type: string): string {
      return data.get(type) ?? "";
    },
  };
}
