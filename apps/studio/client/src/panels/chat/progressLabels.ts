/**
 * Tool progress labels — human-readable inline markers from the tool name
 * and the summary the payload carries (chat.tool_started's `summary` is
 * authored server-side, e.g. "Generating "a dashboard" in swiss"). The
 * fallback map covers payloads with an empty summary so the marker never
 * renders a bare tool id.
 */

const TOOL_FALLBACKS: Readonly<Record<string, string>> = {
  wf_generate: "Generating a wireframe",
  wf_select_layout: "Selecting a layout",
  wf_build_substitution_request: "Preparing content substitutions",
  wf_apply_substitutions: "Applying content substitutions",
  wf_assemble_from_blueprint: "Assembling the composed layout",
};

/** Human label for an inline tool-progress marker. */
export function progressLabel(tool: string, summary: string): string {
  const trimmed = summary.trim();
  if (trimmed !== "") {
    return trimmed;
  }
  return TOOL_FALLBACKS[tool] ?? `Running ${tool}`;
}
