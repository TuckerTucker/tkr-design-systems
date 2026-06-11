/**
 * wireframe.spec.yaml → ParsedSpecMetadata — typed parsing of the document
 * the wireframe skill emits (wireframe_skill/emit.py `_build_spec_yaml`),
 * plus synthesis of a minimal spec for text-branch ingestion when
 * wf_assemble_from_blueprint returned SVG text without a spec.
 *
 * Tolerant by design: optional blocks may be absent, unknown top-level
 * keys are preserved (forward compatibility), and validation failures are
 * typed results naming the offending field — never thrown.
 */
import { parse as parseYaml } from "yaml";

import type {
  ComponentUsed,
  DesignSystemBlock,
  ParsedSpecMetadata,
  RulebookComplianceSummary,
} from "@studio/contract";

import { fail, ok, specInvalid, type PipelineResult } from "./errors.js";

const KNOWN_TOP_LEVEL_KEYS = new Set(["wireframe", "design_system", "notes"]);
const PLATFORMS = new Set(["mobile", "desktop"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parseComponentsUsed(
  value: unknown,
): PipelineResult<ComponentUsed[]> {
  if (value === undefined || value === null) {
    return ok([]);
  }
  if (!Array.isArray(value)) {
    return fail(
      specInvalid('design_system.components_used is not a list', {
        field: "design_system.components_used",
      }),
    );
  }
  const components: ComponentUsed[] = [];
  for (const [index, entry] of value.entries()) {
    const field = `design_system.components_used[${index}]`;
    if (!isRecord(entry)) {
      return fail(specInvalid(`${field} is not a mapping`, { field }));
    }
    if (typeof entry["id"] !== "string" || typeof entry["region"] !== "string") {
      return fail(
        specInvalid(`${field} is missing "id" or "region"`, { field }),
      );
    }
    if (typeof entry["x"] !== "number" || typeof entry["y"] !== "number") {
      return fail(specInvalid(`${field} has non-numeric "x"/"y"`, { field }));
    }
    const type = entry["type"] === "custom" ? "custom" : "library";
    components.push({
      id: entry["id"],
      region: entry["region"],
      x: entry["x"],
      y: entry["y"],
      type,
      ...(typeof entry["svg_length"] === "number"
        ? { svg_length: entry["svg_length"] }
        : {}),
    });
  }
  return ok(components);
}

function parseRulebookSummary(
  value: unknown,
): PipelineResult<RulebookComplianceSummary | undefined> {
  if (value === undefined || value === null) {
    return ok(undefined);
  }
  if (!isRecord(value)) {
    return fail(
      specInvalid("design_system.rulebook_compliance is not a mapping", {
        field: "design_system.rulebook_compliance",
      }),
    );
  }
  for (const field of [
    "checked",
    "mechanical_passed",
    "mechanical_failed",
    "advisory_warnings",
  ] as const) {
    if (typeof value[field] !== "number") {
      return fail(
        specInvalid(
          `design_system.rulebook_compliance.${field} is missing or not a number`,
          { field: `design_system.rulebook_compliance.${field}` },
        ),
      );
    }
  }
  const failedRules = Array.isArray(value["failed_rules"])
    ? value["failed_rules"].map((rule) => String(rule))
    : [];
  return ok({
    checked: value["checked"] as number,
    mechanical_passed: value["mechanical_passed"] as number,
    mechanical_failed: value["mechanical_failed"] as number,
    advisory_warnings: value["advisory_warnings"] as number,
    failed_rules: failedRules,
    ruleset: typeof value["ruleset"] === "string" ? value["ruleset"] : null,
    scope: typeof value["scope"] === "string" ? value["scope"] : "artifact",
  });
}

function parseDesignSystemBlock(
  value: unknown,
): PipelineResult<DesignSystemBlock> {
  if (value === undefined || value === null) {
    // Tolerated: a spec without the block reads as neutral-library.
    return ok({
      id: null,
      components_used: [],
      artifact_treatments_applied: [],
    });
  }
  if (!isRecord(value)) {
    return fail(
      specInvalid("design_system is not a mapping", { field: "design_system" }),
    );
  }
  const id = typeof value["id"] === "string" ? value["id"] : null;
  const componentsUsed = parseComponentsUsed(value["components_used"]);
  if (!componentsUsed.ok) {
    return componentsUsed;
  }
  const rulebook = parseRulebookSummary(value["rulebook_compliance"]);
  if (!rulebook.ok) {
    return rulebook;
  }
  const note = asOptionalString(value["note"]);
  const block: DesignSystemBlock = {
    id,
    ...(note !== undefined ? { note } : {}),
    spec_version:
      typeof value["spec_version"] === "string" ? value["spec_version"] : null,
    system_version:
      typeof value["system_version"] === "string"
        ? value["system_version"]
        : null,
    components_used: componentsUsed.value,
    artifact_treatments_applied: Array.isArray(
      value["artifact_treatments_applied"],
    )
      ? value["artifact_treatments_applied"]
      : [],
  };
  const layoutTemplateUsed = asOptionalString(value["layout_template_used"]);
  if (layoutTemplateUsed !== undefined) {
    block.layout_template_used = layoutTemplateUsed;
  }
  const basePattern = asOptionalString(value["base_pattern"]);
  if (basePattern !== undefined) {
    block.base_pattern = basePattern;
  }
  if ("pattern_source_svg" in value) {
    block.pattern_source_svg =
      typeof value["pattern_source_svg"] === "string"
        ? value["pattern_source_svg"]
        : null;
  }
  const rationale = asOptionalString(value["selection_rationale"]);
  if (rationale !== undefined) {
    block.selection_rationale = rationale;
  }
  if (typeof value["selection_was_fallback"] === "boolean") {
    block.selection_was_fallback = value["selection_was_fallback"];
  }
  if (rulebook.value !== undefined) {
    block.rulebook_compliance = rulebook.value;
  }
  return ok(block);
}

/**
 * Parse a wireframe.spec.yaml document (raw YAML text or an already-parsed
 * value) into ParsedSpecMetadata. Failures are typed SPEC_INVALID results
 * naming the missing or malformed field.
 */
export function parseSpecMetadata(
  spec: unknown,
): PipelineResult<ParsedSpecMetadata> {
  let doc: unknown = spec;
  if (typeof spec === "string") {
    try {
      doc = parseYaml(spec);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return fail(
        specInvalid(`wireframe.spec.yaml is not parseable YAML: ${detail}`),
      );
    }
  }
  if (!isRecord(doc)) {
    return fail(
      specInvalid("wireframe.spec.yaml is not a YAML mapping", {
        field: "(document)",
      }),
    );
  }

  const wireframe = doc["wireframe"];
  if (!isRecord(wireframe)) {
    return fail(
      specInvalid('missing or malformed "wireframe" block', {
        field: "wireframe",
      }),
    );
  }
  for (const field of [
    "brief",
    "generated_at",
    "generator_version",
    "svg",
  ] as const) {
    if (typeof wireframe[field] !== "string") {
      return fail(
        specInvalid(`wireframe.${field} is missing or not a string`, {
          field: `wireframe.${field}`,
        }),
      );
    }
  }
  const platform = wireframe["platform"];
  if (typeof platform !== "string" || !PLATFORMS.has(platform)) {
    return fail(
      specInvalid('wireframe.platform is not "mobile" or "desktop"', {
        field: "wireframe.platform",
      }),
    );
  }
  const dimensions = wireframe["dimensions"];
  if (
    !isRecord(dimensions) ||
    typeof dimensions["width"] !== "number" ||
    typeof dimensions["height"] !== "number"
  ) {
    return fail(
      specInvalid("wireframe.dimensions is missing numeric width/height", {
        field: "wireframe.dimensions",
      }),
    );
  }

  const designSystem = parseDesignSystemBlock(doc["design_system"]);
  if (!designSystem.ok) {
    return designSystem;
  }

  let notes: Array<{ text: string }> | undefined;
  if (Array.isArray(doc["notes"])) {
    notes = doc["notes"]
      .filter(
        (note): note is Record<string, unknown> =>
          isRecord(note) && typeof note["text"] === "string",
      )
      .map((note) => ({ text: note["text"] as string }));
  }

  let extra: Record<string, unknown> | undefined;
  for (const key of Object.keys(doc)) {
    if (!KNOWN_TOP_LEVEL_KEYS.has(key)) {
      extra = extra ?? {};
      extra[key] = doc[key];
    }
  }

  return ok({
    wireframe: {
      brief: wireframe["brief"] as string,
      platform: platform as "mobile" | "desktop",
      dimensions: {
        width: dimensions["width"],
        height: dimensions["height"],
      },
      generated_at: wireframe["generated_at"] as string,
      generator_version: wireframe["generator_version"] as string,
      svg: wireframe["svg"] as string,
    },
    design_system: designSystem.value,
    ...(notes !== undefined ? { notes } : {}),
    ...(extra !== undefined ? { extra } : {}),
  });
}

/** Extract canvas dimensions from SVG width/height attributes or viewBox. */
function dimensionsFromSvg(svgText: string): { width: number; height: number } {
  const width = /<svg[^>]*\bwidth="(\d+(?:\.\d+)?)"/.exec(svgText);
  const height = /<svg[^>]*\bheight="(\d+(?:\.\d+)?)"/.exec(svgText);
  if (width !== null && height !== null) {
    return {
      width: Number.parseFloat(width[1] as string),
      height: Number.parseFloat(height[1] as string),
    };
  }
  const viewBox = /<svg[^>]*\bviewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(
    svgText,
  );
  if (viewBox !== null) {
    return {
      width: Number.parseFloat(viewBox[1] as string),
      height: Number.parseFloat(viewBox[2] as string),
    };
  }
  return { width: 1280, height: 800 };
}

export interface SynthesizeSpecOptions {
  brief: string;
  svgText: string;
  /** Tool parameters as issued — system/platform/components_used are read when present. */
  parameters: Record<string, unknown>;
}

/**
 * Synthesize a minimal spec document for a text-branch ingestion that
 * arrived without specYaml (wf_assemble_from_blueprint returns SVG text;
 * the spec is only emitted when the tool was given an output_dir).
 *
 * The result is a plain document in the emit.py schema — it round-trips
 * through parseSpecMetadata like any emitted spec.
 */
export function synthesizeSpecDocument(
  options: SynthesizeSpecOptions,
): Record<string, unknown> {
  const parameters = options.parameters;
  const platform =
    typeof parameters["platform"] === "string" &&
    PLATFORMS.has(parameters["platform"])
      ? parameters["platform"]
      : "desktop";
  const systemId =
    typeof parameters["system"] === "string"
      ? parameters["system"]
      : typeof parameters["system_id"] === "string"
        ? parameters["system_id"]
        : null;
  const componentsUsed = Array.isArray(parameters["components_used"])
    ? parameters["components_used"]
    : [];
  return {
    wireframe: {
      brief: options.brief,
      platform,
      dimensions: dimensionsFromSvg(options.svgText),
      generated_at: new Date().toISOString(),
      generator_version: "studio-synthesized",
      svg: "wireframe.svg",
    },
    design_system: {
      id: systemId,
      note: "Synthesized at ingestion: the assembly tool returned SVG text without a spec.yaml.",
      components_used: componentsUsed,
      artifact_treatments_applied: [],
    },
  };
}
