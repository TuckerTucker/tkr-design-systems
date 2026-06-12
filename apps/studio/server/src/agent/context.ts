/**
 * Per-artifact conversation context — bounded context windows keyed by
 * artifactId, assembled from in-memory turn state and restored from the
 * persisted transcript on session creation. Refinements never need the
 * user to restate the brief, system, layout, or platform: this block
 * supplies all of it to the agent.
 *
 * Bounds: only the most recent refinement turns are included; the brief
 * and the current defaults ALWAYS survive truncation.
 */
import type { ChipSet, DecisionDefaults, TranscriptRecord } from "@studio/contract";

import type { RoutingPayload } from "./transcript.js";

/** Everything the session remembers about one artifact's conversation. */
export interface ArtifactContext {
  artifactId: string;
  /** The original brief that created the artifact. */
  brief: string;
  defaults: DecisionDefaults;
  /** Head version as tracked from ingest outcomes / transcript replay. */
  headVersion: number | null;
  /** Substitutions applied across turns (replayed on platform re-runs). */
  substitutions: Array<{ find: string; replace: string }>;
  /** Recent refinement texts, oldest first; bounded. */
  refinements: string[];
  /** Last emitted chip set (chip.update validation vocabulary). */
  chipSet: ChipSet | null;
  /** Last seen layout pattern vocabulary for this artifact's system. */
  layoutOptions: string[];
}

export const MAX_CONTEXT_REFINEMENTS = 6;
export const MAX_CONTEXT_SUBSTITUTIONS = 12;
const MAX_REFINEMENT_CHARS = 400;

export function createArtifactContext(
  artifactId: string,
  brief: string,
  defaults: DecisionDefaults,
): ArtifactContext {
  return {
    artifactId,
    brief,
    defaults,
    headVersion: null,
    substitutions: [],
    refinements: [],
    chipSet: null,
    layoutOptions: [],
  };
}

/** Append a refinement, keeping the window bounded (oldest truncated away). */
export function pushRefinement(ctx: ArtifactContext, text: string): void {
  ctx.refinements.push(
    text.length > MAX_REFINEMENT_CHARS
      ? `${text.slice(0, MAX_REFINEMENT_CHARS - 1)}…`
      : text,
  );
  if (ctx.refinements.length > MAX_CONTEXT_REFINEMENTS) {
    ctx.refinements.splice(0, ctx.refinements.length - MAX_CONTEXT_REFINEMENTS);
  }
}

/** Record applied substitutions, bounded to the most recent entries. */
export function pushSubstitutions(
  ctx: ArtifactContext,
  pairs: ReadonlyArray<{ find: string; replace: string }>,
): void {
  ctx.substitutions.push(...pairs);
  if (ctx.substitutions.length > MAX_CONTEXT_SUBSTITUTIONS) {
    ctx.substitutions.splice(
      0,
      ctx.substitutions.length - MAX_CONTEXT_SUBSTITUTIONS,
    );
  }
}

export interface ContextBlockArgs {
  ctx: ArtifactContext;
  /** Store-resolved head SVG path for pass-2 substitution; null when none. */
  headSvgPath: string | null;
}

/**
 * Render the bounded context block injected into the turn prompt. The brief
 * and the current defaults always survive; only recent refinements appear.
 */
export function buildContextBlock(args: ContextBlockArgs): string {
  const { ctx } = args;
  const lines: string[] = [
    "## Active artifact context",
    `artifact_id: ${ctx.artifactId}`,
    `original brief: ${ctx.brief}`,
    `system: ${ctx.defaults.system}`,
    `layout_id: ${ctx.defaults.layoutId ?? "composed (blueprint)"}`,
    `platform: ${ctx.defaults.platform}`,
  ];
  if (args.headSvgPath !== null) {
    lines.push(`current svg_path (for wf_apply_substitutions): ${args.headSvgPath}`);
  }
  if (ctx.substitutions.length > 0) {
    lines.push(
      `applied substitutions so far: ${JSON.stringify(ctx.substitutions)}`,
    );
  }
  if (ctx.refinements.length > 0) {
    lines.push(
      `recent refinements (most recent last, older turns truncated):`,
      ...ctx.refinements.map((text) => `- ${text}`),
    );
  }
  return lines.join("\n");
}

export interface RestoredState {
  artifacts: Map<string, ArtifactContext>;
  activeArtifactId: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Rebuild per-artifact contexts from the persisted transcript. Reopening a
 * workspace restores the brief, defaults, substitutions, chips, and head
 * version so refinements continue without restatement.
 */
export function restoreFromTranscript(
  records: readonly TranscriptRecord[],
): RestoredState {
  const artifacts = new Map<string, ArtifactContext>();
  let activeArtifactId: string | null = null;

  function ensure(artifactId: string): ArtifactContext {
    let ctx = artifacts.get(artifactId);
    if (ctx === undefined) {
      ctx = createArtifactContext(artifactId, "", {
        system: "swiss",
        layoutId: null,
        platform: "desktop",
      });
      artifacts.set(artifactId, ctx);
    }
    return ctx;
  }

  for (const record of records) {
    if (!isRecord(record.payload)) {
      continue;
    }
    switch (record.kind) {
      case "routing_result": {
        const payload = record.payload as Partial<RoutingPayload>;
        if (typeof payload.artifactId !== "string") {
          break;
        }
        const ctx = ensure(payload.artifactId);
        if (
          payload.defaults !== undefined &&
          payload.defaults !== null &&
          typeof payload.defaults.system === "string"
        ) {
          ctx.defaults = {
            system: payload.defaults.system,
            layoutId: payload.defaults.layoutId ?? null,
            platform: payload.defaults.platform === "mobile" ? "mobile" : "desktop",
          };
        }
        if (typeof payload.brief === "string" && payload.brief !== "") {
          if (payload.intent === "generate" || payload.intent === "compose") {
            ctx.brief = payload.brief;
          } else {
            pushRefinement(ctx, payload.brief);
          }
        }
        if (typeof payload.producedVersion === "number") {
          ctx.headVersion = payload.producedVersion;
        }
        if (Array.isArray(payload.substitutions)) {
          pushSubstitutions(
            ctx,
            payload.substitutions.filter(
              (entry): entry is { find: string; replace: string } =>
                isRecord(entry) &&
                typeof entry["find"] === "string" &&
                typeof entry["replace"] === "string",
            ),
          );
        }
        activeArtifactId = payload.artifactId;
        break;
      }
      case "decision_chips": {
        const payload = record.payload as { chipSet?: ChipSet };
        const chipSet = payload.chipSet;
        if (chipSet !== undefined && typeof chipSet.artifactId === "string") {
          const ctx = ensure(chipSet.artifactId);
          ctx.chipSet = chipSet;
          const layoutChip = chipSet.chips.find((chip) => chip.kind === "layout");
          if (layoutChip !== undefined) {
            ctx.layoutOptions = [...layoutChip.options];
          }
        }
        break;
      }
      // "message" and "tool_call" records are the audit trail; everything
      // context needs (brief, defaults, substitutions, head version, chips)
      // restores from routing_result and decision_chips records above.
      default:
        break;
    }
  }

  return { artifacts, activeArtifactId };
}
