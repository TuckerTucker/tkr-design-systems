/**
 * Pure search matchers over the cached library index — zero network per
 * keystroke. Matching is case-insensitive substring across the fields a
 * designer remembers: component ids/names/variants, palette names, hex
 * values, roles, and type-scale roles/sizes.
 */
import type { ComponentIndexEntry } from "@studio/contract";

import type { PaletteEntryView, TypeScaleEntryView } from "../model/types.js";

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function contains(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle);
}

/** Component matching: id, display name, and variant ids. */
export function matchComponents(
  components: readonly ComponentIndexEntry[],
  query: string,
): ComponentIndexEntry[] {
  const needle = normalizeQuery(query);
  if (needle === "") {
    return [...components];
  }
  return components.filter(
    (component) =>
      contains(component.id, needle) ||
      contains(component.name, needle) ||
      component.variants.some((variant) => contains(variant, needle)),
  );
}

/** Palette matching: name, hex value, and role. */
export function matchPalette(
  entries: readonly PaletteEntryView[],
  query: string,
): PaletteEntryView[] {
  const needle = normalizeQuery(query);
  if (needle === "") {
    return [...entries];
  }
  return entries.filter(
    (entry) =>
      contains(entry.name, needle) ||
      contains(entry.value, needle) ||
      contains(entry.role, needle),
  );
}

/** Type-scale matching: role and pixel size ("22" matches 22px). */
export function matchScale(
  entries: readonly TypeScaleEntryView[],
  query: string,
): TypeScaleEntryView[] {
  const needle = normalizeQuery(query);
  if (needle === "") {
    return [...entries];
  }
  return entries.filter(
    (entry) =>
      contains(entry.role, needle) || contains(`${entry.px}px`, needle),
  );
}
