/**
 * Kebab-case slug generation and grammar validation.
 *
 * The slug grammar (lowercase alphanumerics and single hyphens, never
 * leading/trailing) doubles as the store's path-injection defense: every id
 * is validated against it before any path composition, so traversal
 * sequences, absolute paths, and null bytes never reach the filesystem.
 */

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/** Generated slugs are truncated to this; validation allows extra room for collision suffixes. */
export const MAX_SLUG_LENGTH = 80;

const MAX_ID_LENGTH = 96;

/**
 * True when `id` conforms to the slug grammar and may be used as a
 * directory name under the store root.
 */
export function isValidSlug(id: string): boolean {
  return (
    typeof id === "string" &&
    id.length > 0 &&
    id.length <= MAX_ID_LENGTH &&
    SLUG_PATTERN.test(id)
  );
}

/**
 * Derive a kebab-case slug from a display name.
 *
 * @param name - Arbitrary display name (any unicode).
 * @param fallback - Slug base used when the name yields nothing (e.g.
 *   emoji-only or punctuation-only names) — "workspace", "artifact".
 */
export function slugify(name: string, fallback: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, "");
  return slug === "" ? fallback : slug;
}

/**
 * Allocate a slug unique within its parent: the base itself when free,
 * otherwise the first free -2/-3/… suffix. Collisions never surface as
 * errors.
 */
export function allocateSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) {
    return base;
  }
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
}
