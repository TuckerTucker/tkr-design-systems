/**
 * Filmstrip model — pure projection of the artifact's version lineage
 * (VersionSummary[]) into ordered entries with head marking, plus the
 * scrub-navigation helpers the keyboard path shares with hover.
 */
import type { VersionSummary } from "@studio/contract";

export interface FilmstripEntry {
  version: number;
  parentVersion: number | null;
  isHead: boolean;
  /** ISO 8601 from version provenance. */
  createdAt: string;
  /** Provenance brief (excerpted for display). */
  brief: string;
  tool: string;
}

const BRIEF_EXCERPT_LENGTH = 80;

export function excerptBrief(brief: string): string {
  const trimmed = brief.trim();
  if (trimmed.length <= BRIEF_EXCERPT_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, BRIEF_EXCERPT_LENGTH - 1)}…`;
}

/** Entries ordered oldest → newest with the head marked. */
export function buildFilmstrip(
  versions: readonly VersionSummary[],
  headVersion: number | null,
): FilmstripEntry[] {
  return [...versions]
    .sort((a, b) => a.number - b.number)
    .map((version) => ({
      version: version.number,
      parentVersion: version.parent,
      isHead: version.number === headVersion,
      createdAt: version.created,
      brief: excerptBrief(version.brief),
      tool: version.tool,
    }));
}

export type ScrubMove = "previous" | "next" | "first" | "head";

/**
 * The version a scrub move lands on. `current` is the scrubbed version or
 * null when the strip is at head. Returns null when the move lands on head
 * (scrub cleared → stage returns to head).
 */
export function scrubMoveTarget(
  entries: readonly FilmstripEntry[],
  headVersion: number | null,
  current: number | null,
  move: ScrubMove,
): number | null {
  if (entries.length === 0) {
    return null;
  }
  const numbers = entries.map((entry) => entry.version);
  const effective = current ?? headVersion;
  const index = effective === null ? -1 : numbers.indexOf(effective);
  let targetIndex: number;
  switch (move) {
    case "first":
      targetIndex = 0;
      break;
    case "head":
      return null;
    case "previous":
      targetIndex = index <= 0 ? 0 : index - 1;
      break;
    case "next":
      targetIndex = index === -1 ? numbers.length - 1 : Math.min(numbers.length - 1, index + 1);
      break;
  }
  const target = numbers[targetIndex] ?? null;
  return target === headVersion ? null : target;
}
