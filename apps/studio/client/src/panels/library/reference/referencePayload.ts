/**
 * LibraryReference builders and drag encoding — the typed payloads the
 * panel emits toward the chat composer. The LibraryReference type is
 * owned by this capability in @studio/contract (src/library.ts);
 * chat-panel imports it from there and never redeclares it.
 *
 * Drag payloads use a dedicated MIME type; the composer's drop target
 * decodes with decodeReferenceDrag, which ignores foreign drag data
 * (anything that fails the isLibraryReference guard).
 */
import {
  isLibraryReference,
  type ComponentIndexEntry,
  type LayoutTemplate,
  type LibraryReference,
} from "@studio/contract";

import type { PaletteEntryView, TypeScaleEntryView } from "../model/types.js";

export const LIBRARY_REFERENCE_MIME =
  "application/x-studio-library-reference+json";

/** Reference a component variant from a gallery card. */
export function componentReference(
  systemId: string,
  component: ComponentIndexEntry,
  variantId: string,
): LibraryReference {
  return {
    kind: "component",
    systemId,
    componentId: component.id,
    variantId,
    label:
      variantId === "" ? component.name : `${component.name} — ${variantId}`,
  };
}

/** Reference a palette color from a swatch. */
export function paletteReference(
  systemId: string,
  entry: PaletteEntryView,
): LibraryReference {
  return {
    kind: "token",
    systemId,
    tokenPath: `colors.palette.${entry.name}`,
    value: entry.value,
    label: `${entry.name} ${entry.value}`,
  };
}

/** Reference a type-scale step from a specimen. */
export function scaleReference(
  systemId: string,
  entry: TypeScaleEntryView,
): LibraryReference {
  return {
    kind: "token",
    systemId,
    tokenPath: `typography.scale.${entry.px}`,
    value: `${entry.px}px ${entry.role}`,
    label: `${entry.px}px ${entry.role}`,
  };
}

/** Reference a layout template from a browser card. */
export function layoutReference(
  systemId: string,
  template: LayoutTemplate,
): LibraryReference {
  return {
    kind: "layout",
    systemId,
    templateId: template.id,
    label: template.name,
  };
}

/** Encode a reference onto a drag (dedicated MIME + text fallback). */
export function encodeReferenceDrag(
  dataTransfer: DataTransfer,
  reference: LibraryReference,
): void {
  const json = JSON.stringify(reference);
  dataTransfer.setData(LIBRARY_REFERENCE_MIME, json);
  dataTransfer.setData("text/plain", reference.label);
  dataTransfer.effectAllowed = "copy";
}

/**
 * Decode a reference from a drop; null for foreign drag data (no parsing
 * of payloads from outside the app).
 */
export function decodeReferenceDrag(
  dataTransfer: DataTransfer,
): LibraryReference | null {
  const json = dataTransfer.getData(LIBRARY_REFERENCE_MIME);
  if (json === "") {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  return isLibraryReference(parsed) ? parsed : null;
}
