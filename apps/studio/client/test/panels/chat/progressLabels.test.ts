/**
 * progressLabel — the server-authored summary wins; empty summaries fall
 * back to a human-readable tool description so a marker never renders a
 * bare tool id.
 */
import { describe, expect, it } from "vitest";

import { progressLabel } from "../../../src/panels/chat/progressLabels.js";

describe("progressLabel", () => {
  it("prefers the payload summary verbatim", () => {
    expect(progressLabel("wf_generate", 'Generating "a dashboard" in swiss')).toBe(
      'Generating "a dashboard" in swiss',
    );
  });

  it("falls back to the human label for a known tool with an empty summary", () => {
    expect(progressLabel("wf_generate", "")).toBe("Generating a wireframe");
    expect(progressLabel("wf_apply_substitutions", "   ")).toBe(
      "Applying content substitutions",
    );
    expect(progressLabel("wf_assemble_from_blueprint", "")).toBe(
      "Assembling the composed layout",
    );
  });

  it("never renders a bare id for an unknown tool", () => {
    expect(progressLabel("wf_future_tool", "")).toBe("Running wf_future_tool");
  });
});
