/**
 * Component card — one card per component from the index. The real
 * library SVG is fetched only when the card scrolls into view
 * (progressive loading), sanitized client-side, and rendered inline at
 * viewBox proportions. Variant toggle selects the variant carried on the
 * reference payload; details (variant ids and the wire payload's data)
 * reveal on demand; per-card failures render inline on this card only.
 *
 * The wire's ComponentDetail carries one canonical SVG per component
 * (studio-api resolves the default variant server-side) — the variant
 * toggle scopes the reference and label, not the rendered SVG.
 */
import { useEffect, useState, type ReactElement } from "react";

import type {
  ApiError,
  ComponentDetail,
  ComponentIndexEntry,
  LibraryReference,
} from "@studio/contract";

import { useProgressiveLoad } from "../hooks/useProgressiveLoad.js";
import type { LibraryApi } from "../model/libraryApi.js";
import type { LibraryCache } from "../model/libraryCache.js";
import {
  componentReference,
  encodeReferenceDrag,
} from "../reference/referencePayload.js";
import { SendToChatAction } from "../reference/SendToChatAction.jsx";
import { InlineSvg } from "../svg/InlineSvg.jsx";
import { sanitizeSvg, type SanitizedSvg } from "../svg/sanitizeSvg.js";
import { VariantToggle } from "./VariantToggle.jsx";

export interface ComponentCardProps {
  systemId: string;
  component: ComponentIndexEntry;
  api: LibraryApi;
  cache: LibraryCache;
  bridgeDown: boolean;
  onReference(reference: LibraryReference): void;
}

type CardContent =
  | { status: "pending" }
  | { status: "loading" }
  | { status: "ready"; sanitized: SanitizedSvg; stale: boolean }
  | { status: "bridge-down" }
  | { status: "error"; error: ApiError }
  | { status: "invalid"; reason: string };

export function ComponentCard(props: ComponentCardProps): ReactElement {
  const { api, cache, systemId, component, bridgeDown } = props;
  const { ref, visible } = useProgressiveLoad();
  const [content, setContent] = useState<CardContent>({ status: "pending" });
  const [selectedVariant, setSelectedVariant] = useState<string>(
    component.variants[0] ?? "",
  );
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  const cacheKey = `component:${systemId}:${component.id}`;

  useEffect(() => {
    if (!visible) {
      return;
    }
    const cached = cache.get<ComponentDetail>(cacheKey);
    if (cached !== undefined) {
      const sanitized = sanitizeSvg(cached.data.svg);
      // Display staleness derives from bridgeDown directly: the panel's
      // markAllStale effect runs after child effects in the same commit.
      setContent(
        sanitized.ok
          ? { status: "ready", sanitized, stale: cached.stale || bridgeDown }
          : { status: "invalid", reason: sanitized.reason },
      );
      // Fresh, or stale while the bridge is still down: keep serving the
      // cache. Stale with the bridge back up: refetch below.
      if (!cached.stale || bridgeDown) {
        return;
      }
    } else if (bridgeDown) {
      // Cold card with the bridge down: explain in place instead of a
      // spinner that never resolves; loads automatically on recovery.
      setContent({ status: "bridge-down" });
      return;
    } else {
      setContent({ status: "loading" });
    }
    const controller = new AbortController();
    let cancelled = false;
    void api
      .getComponentDetail(systemId, component.id, controller.signal)
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (!result.ok) {
          if (result.aborted === true) {
            return;
          }
          // A failed stale-refetch never blanks a rendered card — keep
          // serving the cached SVG with the staleness note in place.
          const fallback = cache.get<ComponentDetail>(cacheKey);
          if (fallback !== undefined) {
            const sanitized = sanitizeSvg(fallback.data.svg);
            setContent(
              sanitized.ok
                ? { status: "ready", sanitized, stale: true }
                : { status: "invalid", reason: sanitized.reason },
            );
            return;
          }
          setContent({ status: "error", error: result.error });
          return;
        }
        cache.set(cacheKey, result.value);
        const sanitized = sanitizeSvg(result.value.svg);
        setContent(
          sanitized.ok
            ? { status: "ready", sanitized, stale: false }
            : { status: "invalid", reason: sanitized.reason },
        );
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [visible, bridgeDown, retryNonce, api, cache, cacheKey, systemId, component.id]);

  const reference = componentReference(systemId, component, selectedVariant);
  const accessibleName =
    selectedVariant === ""
      ? component.name
      : `${component.name}, variant ${selectedVariant}`;

  return (
    <li
      ref={(element) => ref(element)}
      className="library-component-card"
      aria-label={accessibleName}
      draggable
      onDragStart={(event) =>
        encodeReferenceDrag(event.dataTransfer, reference)
      }
    >
      <div className="library-card-header">
        <span className="library-card-title">{component.name}</span>
        <code className="library-card-id">{component.id}</code>
      </div>

      <div className="library-card-stage">
        {content.status === "pending" || content.status === "loading" ? (
          <div className="library-card-placeholder" role="status">
            {content.status === "loading" ? "Loading…" : ""}
          </div>
        ) : null}
        {content.status === "bridge-down" ? (
          <p className="library-card-note" role="status">
            The MCP bridge is offline — this component loads automatically
            when the bridge recovers.
          </p>
        ) : null}
        {content.status === "error" ? (
          <div className="library-inline-error" role="status">
            <p className="library-inline-error-message">
              {component.id}: {content.error.message}
            </p>
            <p className="library-inline-error-fix">{content.error.fix}</p>
            <button
              type="button"
              onClick={() => setRetryNonce((nonce) => nonce + 1)}
            >
              Retry
            </button>
          </div>
        ) : null}
        {content.status === "invalid" ? (
          <p className="library-card-note" role="status">
            {component.id}: {content.reason}
          </p>
        ) : null}
        {content.status === "ready" ? (
          <InlineSvg sanitized={content.sanitized} label={accessibleName} />
        ) : null}
      </div>

      {content.status === "ready" && content.sanitized.stripped.length > 0 ? (
        <p className="library-card-integrity" role="status">
          Unsafe content was removed from this SVG before rendering.
        </p>
      ) : null}
      {content.status === "ready" && content.stale ? (
        <p className="library-card-note" role="status">
          Showing cached SVG — bridge offline.
        </p>
      ) : null}

      {component.variants.length > 1 ? (
        <VariantToggle
          componentId={component.id}
          variants={component.variants}
          selected={selectedVariant}
          onSelect={setSelectedVariant}
        />
      ) : null}

      <div className="library-card-actions">
        <button
          type="button"
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen((open) => !open)}
        >
          {detailsOpen ? "Hide details" : "Details"}
        </button>
        <SendToChatAction reference={reference} onSend={props.onReference} />
      </div>

      {detailsOpen ? (
        <dl className="library-card-details">
          <div>
            <dt>Component id</dt>
            <dd>
              <code>{component.id}</code>
            </dd>
          </div>
          <div>
            <dt>Variants</dt>
            <dd>
              {component.variants.length > 0
                ? component.variants.join(", ")
                : "none declared"}
            </dd>
          </div>
        </dl>
      ) : null}
    </li>
  );
}
