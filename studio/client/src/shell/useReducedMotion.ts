/**
 * prefers-reduced-motion hook — shared by the drag ghost and the
 * collapse/expand transitions. CSS handles declarative transitions via the
 * media query; this hook gates the JS-driven motion (the floating drag
 * ghost) the same way.
 */
import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") {
    return () => undefined;
  }
  const list = window.matchMedia(QUERY);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches
  );
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion);
}
