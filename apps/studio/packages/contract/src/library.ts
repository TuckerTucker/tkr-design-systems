/**
 * Library reference contract — owned by library-panel.
 *
 * LibraryReference is the typed payload the library panel emits when a
 * designer references a component variant, token, or layout template into
 * the chat composer. chat-panel imports it from @studio/contract (never
 * redeclares it) and attaches accepted references to chat.send as
 * ChatSendPayload's `references` field; agent-orchestration grounds its
 * next tool call on the exact artifact instead of a prose description.
 *
 * References carry only identifiers and human labels — never file paths;
 * path resolution stays server-side behind studio-api.
 */

/** A component variant reference, e.g. swiss card / gray_surface. */
export interface ComponentReference {
  kind: "component";
  systemId: string;
  /** The spec key from the component index, e.g. "card". */
  componentId: string;
  /** Variant id from the index, e.g. "gray_surface"; "" when none. */
  variantId: string;
  /** Human label for the composer chip, e.g. "Card — gray_surface". */
  label: string;
}

/** A design-token reference, e.g. a palette color or type-scale step. */
export interface TokenReference {
  kind: "token";
  systemId: string;
  /** Dot path inside the token export, e.g. "colors.palette.red". */
  tokenPath: string;
  /** Display value, e.g. "#E3000B" or "22px display_small". */
  value: string;
  /** Human label for the composer chip. */
  label: string;
}

/** A layout-template reference, e.g. the swiss dashboard archetype. */
export interface LayoutReference {
  kind: "layout";
  systemId: string;
  /** The spec's template key, e.g. "dashboard". */
  templateId: string;
  /** Human label for the composer chip. */
  label: string;
}

/**
 * The typed reference payload delivered from the library panel to the
 * chat composer (discriminated on `kind`).
 */
export type LibraryReference =
  | ComponentReference
  | TokenReference
  | LayoutReference;

export const LIBRARY_REFERENCE_KINDS = [
  "component",
  "token",
  "layout",
] as const;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

/**
 * Runtime guard for the reference seam — chat-panel narrows the
 * forward-compatible `references?: readonly unknown[]` entries on
 * ChatSendPayload (and drag payloads decoded from JSON) through this
 * guard before treating them as typed references.
 */
export function isLibraryReference(value: unknown): value is LibraryReference {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (!isNonEmptyString(candidate["systemId"])) {
    return false;
  }
  if (typeof candidate["label"] !== "string") {
    return false;
  }
  switch (candidate["kind"]) {
    case "component":
      return (
        isNonEmptyString(candidate["componentId"]) &&
        typeof candidate["variantId"] === "string"
      );
    case "token":
      return (
        isNonEmptyString(candidate["tokenPath"]) &&
        typeof candidate["value"] === "string"
      );
    case "layout":
      return isNonEmptyString(candidate["templateId"]);
    default:
      return false;
  }
}
