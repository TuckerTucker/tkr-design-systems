/**
 * Two-pass substitution flow — prompt instructions plus the staging step
 * that turns wf_apply_substitutions' svg_text into on-disk files.
 *
 * Wire truth (design-systems/mcp-server/server.py): wf_apply_substitutions
 * returns { ok, svg_text, unapplied_finds, grammar_warnings } — it does NOT
 * write files. The session stages the substituted SVG (plus the parent
 * version's spec, byte-identical) into the agent staging directory so the
 * artifact_produced event carries ArtifactSource { kind: "paths" } exactly
 * as the architecture contract specifies for this flow.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ArtifactSource } from "@studio/contract";

import type { Logger } from "../../logging/create-logger.js";

/** Instructions for the substitution flow (part of the system prompt). */
export function substitutionFlowInstructions(): string {
  return [
    "## Substitution flow (content refinement of the artifact in context)",
    "Refinements never need the user to restate the brief, system, layout,",
    "or platform — recover all of them from the artifact context block.",
    "1. Pass 1: call wf_build_substitution_request(brief, system_id,",
    "   platform, layout_id) using the context's values. It returns",
    "   text_nodes and grammar_caveats.",
    "2. Author {find, replace, rationale} substitutions yourself,",
    "   respecting the system's grammar caveats.",
    "3. Pass 2: call wf_apply_substitutions(svg_path, substitutions,",
    "   system_id) with the artifact's svg_path from the context block.",
    "Report unapplied_finds and grammar_warnings honestly; never drop them.",
  ].join("\n");
}

export interface StageSubstitutionArgs {
  /** Agent staging root (AgentConfig.stagingDir). */
  stagingDir: string;
  /** Per-turn isolation directory name. */
  requestId: string;
  /** Substituted SVG text returned by wf_apply_substitutions. */
  svgText: string;
  /**
   * Path of the parent version's wireframe.spec.yaml (store-resolved).
   * Copied byte-identical so the new version keeps real spec metadata.
   */
  parentSpecPath: string | null;
  logger: Logger;
}

/**
 * Stage the substituted artifact as files. Falls back to the text branch
 * (which artifact-pipeline also accepts; it synthesizes a spec) when the
 * parent spec cannot be read.
 */
export async function stageSubstitutedArtifact(
  args: StageSubstitutionArgs,
): Promise<ArtifactSource> {
  const dir = path.join(args.stagingDir, args.requestId);
  let specText: string | null = null;
  if (args.parentSpecPath !== null) {
    try {
      specText = await readFile(args.parentSpecPath, "utf8");
    } catch (err) {
      args.logger.warn(
        { path: args.parentSpecPath, err },
        "parent spec unreadable; substituted artifact falls back to the text source branch",
      );
    }
  }
  if (specText === null) {
    return { kind: "text", svgText: args.svgText };
  }
  await mkdir(dir, { recursive: true });
  const svgPath = path.join(dir, "wireframe.svg");
  const specPath = path.join(dir, "wireframe.spec.yaml");
  await writeFile(svgPath, args.svgText, "utf8");
  await writeFile(specPath, specText, "utf8");
  return { kind: "paths", svgPath, specPath };
}
