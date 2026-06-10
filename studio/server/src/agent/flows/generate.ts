/**
 * Generate flow — wf_generate routing_request handling, full-run prompt
 * instructions, and the deterministic chip re-run prompts. The agent loop
 * executes the flow; these builders define it.
 */
import type { DecisionDefaults, Intent } from "@studio/contract";

/** Instructions for the generate flow (part of the system prompt). */
export function generateFlowInstructions(): string {
  return [
    "## Generate flow (fresh brief)",
    "1. Call wf_generate(brief, system, platform, output_dir) WITHOUT",
    "   layout_id. It returns a routing_request listing available patterns",
    "   and components.",
    "2. Pick the closest pattern yourself (directly from the routing",
    "   request, or browse with wf_select_layout) and call wf_generate",
    "   again with layout_id=<pattern_id> for the full run. It emits",
    "   svg_path and spec_path on disk.",
    "3. If no available pattern is a reasonable fit, switch to the compose",
    "   flow instead of forcing a poor match.",
    "Always pass the output_dir given in the turn context.",
  ].join("\n");
}

/** Map a chip rerun step onto the routing intent recorded for the re-run. */
export function rerunIntent(step: "generate" | "substitute" | "compose"): Intent {
  return step;
}

export interface ChipRerunPromptArgs {
  /** The original brief that produced the artifact. */
  brief: string;
  /** Defaults AFTER applying the chip change. */
  defaults: DecisionDefaults;
  /** Which chip changed. */
  changedKind: "system" | "layout" | "platform";
  /** "generate" re-runs wf_generate; "compose" re-runs the compose flow. */
  rerunStep: "generate" | "compose";
  /** Per-request staging directory to pass as output_dir. */
  outputDir: string;
  /** Previously applied substitutions to replay (platform re-runs). */
  substitutions: ReadonlyArray<{ find: string; replace: string }>;
}

/**
 * Deterministic prompt for a chip change: only the affected step re-runs;
 * the conversation is never replayed.
 */
export function chipRerunPrompt(args: ChipRerunPromptArgs): string {
  const { brief, defaults, changedKind, rerunStep, outputDir } = args;
  const lines: string[] = [
    `Re-run request (decision chip "${changedKind}" changed). Do not treat`,
    "this as a new conversation; execute exactly the steps below.",
    "",
    `Brief: ${brief}`,
    `System: ${defaults.system}`,
    `Platform: ${defaults.platform}`,
    `output_dir: ${outputDir}`,
  ];

  if (rerunStep === "compose") {
    lines.push(
      "",
      "Steps:",
      `1. Call wf_select_layout(brief, system_id="${defaults.system}",`,
      `   platform="${defaults.platform}") to refresh the component catalog.`,
      "2. Author a LayoutBlueprint for the same brief and call",
      `   wf_assemble_from_blueprint(blueprint, system_id="${defaults.system}",`,
      `   output_dir="${outputDir}").`,
    );
    return lines.join("\n");
  }

  const steps: string[] = ["", "Steps:"];
  if (changedKind === "system") {
    steps.push(
      `1. Call wf_select_layout(brief, system_id="${defaults.system}",`,
      `   platform="${defaults.platform}") and pick the closest pattern from`,
      "   the new system's available_patterns yourself.",
      `2. Call wf_generate(brief, system="${defaults.system}",`,
      `   platform="${defaults.platform}", layout_id=<picked>,`,
      `   output_dir="${outputDir}") for the full run.`,
    );
  } else {
    steps.push(
      `1. Call wf_generate(brief, system="${defaults.system}",`,
      `   platform="${defaults.platform}",` +
        (args.defaults.layoutId !== null
          ? ` layout_id="${args.defaults.layoutId}",`
          : ""),
      `   output_dir="${outputDir}") for the full run.`,
    );
  }
  lines.push(...steps);

  if (args.substitutions.length > 0) {
    lines.push(
      "",
      "Then replay the previously applied content substitutions on the new",
      "SVG: call wf_build_substitution_request, then wf_apply_substitutions",
      `(system_id="${defaults.system}") with these find/replace pairs where`,
      "the finds still match (report any that no longer apply):",
      JSON.stringify(args.substitutions),
    );
  }
  return lines.join("\n");
}
