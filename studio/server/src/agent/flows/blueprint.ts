/**
 * Compose flow — blueprint composition for layouts the system has not
 * authored. The agent authors a LayoutBlueprint JSON and assembles via
 * wf_assemble_from_blueprint; validation-failure recovery happens inside
 * the agent loop (revise and retry) and is bounded by the runtime's turn
 * budget. Exhaustion surfaces as a blueprint_invalid error listing the
 * unresolved validation errors.
 */

/** Instructions for the compose flow (part of the system prompt). */
export function composeFlowInstructions(): string {
  return [
    "## Compose flow (novel layout, no authored pattern fits)",
    "1. Call wf_generate(brief, system, platform, compose=true,",
    "   output_dir) — it returns a decomposition_request with the system's",
    "   available components and canvas dimensions (wf_select_layout also",
    "   lists available_components).",
    "2. Author a LayoutBlueprint JSON yourself:",
    '   {"canvas": {"width", "height"}, "regions": [{"id",',
    '   "components": [{"component_id", "x", "y"}]}]}',
    "   using only listed component_ids, placed inside the canvas bounds.",
    "3. Call wf_assemble_from_blueprint(blueprint, system_id, output_dir).",
    "   Validation runs first: on validation_errors (unknown component_ids,",
    "   out-of-bounds placements), revise the blueprint and retry — at most",
    "   three assembly attempts, then stop and report the remaining errors.",
    "Surface assembly warnings honestly; never drop them.",
  ].join("\n");
}

/** Format the unresolved validation errors for the blueprint_invalid error. */
export function describeBlueprintFailure(validationErrors: string[]): {
  message: string;
  fix: string;
} {
  return {
    message:
      "Blueprint assembly failed validation after bounded retries: " +
      validationErrors.join("; "),
    fix:
      "Rephrase the brief or name the components to use — the listed " +
      "validation errors show what the blueprint could not satisfy.",
  };
}
