/**
 * Shared section chrome — collapsible disclosure (expand/collapse state
 * persisted per section, silently), the in-place staleness indicator, and
 * the inline error block with a retry affordance. No toasts; every state
 * renders at the affected section.
 */
import { useState, type ReactElement, type ReactNode } from "react";

import type { ApiError } from "@studio/contract";

import { readSessionValue, writeSessionValue } from "./model/sessionState.js";

export interface LibrarySectionProps {
  /** Stable id for persisted expand/collapse state. */
  id: string;
  title: string;
  /** Match count under an active search; null hides the count. */
  count?: number | null;
  /** Renders the in-place staleness indicator when set. */
  staleSince?: string | null;
  defaultExpanded?: boolean;
  children: ReactNode;
}

function formatFetchedAt(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleTimeString();
}

export function LibrarySection(props: LibrarySectionProps): ReactElement {
  const storageKey = `section.${props.id}`;
  const [expanded, setExpanded] = useState<boolean>(() => {
    const persisted = readSessionValue(storageKey);
    if (persisted === "open") {
      return true;
    }
    if (persisted === "closed") {
      return false;
    }
    return props.defaultExpanded ?? true;
  });
  const contentId = `library-section-${props.id}`;

  return (
    <section className="library-section" aria-label={props.title}>
      <div className="library-section-header">
        <button
          type="button"
          className="library-section-toggle"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => {
            const next = !expanded;
            setExpanded(next);
            writeSessionValue(storageKey, next ? "open" : "closed");
          }}
        >
          <span aria-hidden="true" className="library-section-chevron">
            {expanded ? "▾" : "▸"}
          </span>
          {props.title}
          {props.count !== undefined && props.count !== null ? (
            <span className="library-section-count">
              {props.count} {props.count === 1 ? "match" : "matches"}
            </span>
          ) : null}
        </button>
        {props.staleSince !== undefined && props.staleSince !== null ? (
          <StaleNote fetchedAt={props.staleSince} />
        ) : null}
      </div>
      <div id={contentId} hidden={!expanded} className="library-section-body">
        {props.children}
      </div>
    </section>
  );
}

export function StaleNote(props: { fetchedAt: string }): ReactElement {
  return (
    <span className="library-stale-note" role="status">
      Cached {formatFetchedAt(props.fetchedAt)} — bridge offline
    </span>
  );
}

export interface InlineErrorProps {
  error: ApiError;
  onRetry?: () => void;
}

export function InlineError(props: InlineErrorProps): ReactElement {
  return (
    <div className="library-inline-error" role="status">
      <p className="library-inline-error-message">{props.error.message}</p>
      <p className="library-inline-error-fix">{props.error.fix}</p>
      {props.onRetry !== undefined ? (
        <button type="button" onClick={props.onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function InlineLoading(props: { label: string }): ReactElement {
  return (
    <p className="library-inline-loading" role="status">
      {props.label}
    </p>
  );
}
