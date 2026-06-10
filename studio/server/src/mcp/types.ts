/**
 * Bridge-internal tool payload types — faithful mirrors of the result shapes
 * produced by design-systems/mcp-server/server.py and the Python skill
 * packages behind it (design_system_skill, wireframe_skill).
 *
 * These types are deliberately NOT in @studio/contract: the raw MCP shapes
 * are the bridge's wire concern. Downstream capabilities project them into
 * their own domain models (e.g. artifact-pipeline's ComplianceReport).
 */

/**
 * ds_list_systems — skill Result envelope, `data` = descriptor list
 * (design_system_skill/registry.py `list_systems`).
 *
 * Unreadable registered specs degrade to a stub descriptor (name = id,
 * status "draft") plus a SPEC_FILE_MISSING / SPEC_PARSE_FAILED warning —
 * surfaced via `BridgeResult.warnings`, never flattened into an error.
 */
export interface SystemDescriptor {
  id: string;
  name: string;
  tagline: string;
  grammar_family: string | null;
  version: string | null;
  spec_version: string | null;
  /** Registry status, e.g. "available", "draft", "deprecated". */
  status: string;
}

/**
 * ds_get_rulebook — skill Result envelope, `data` = flattened rule list
 * (design_system_skill/rulebook.py `get_rulebook`).
 */
export interface RulebookEntry {
  id: string;
  rule: string;
  rationale: string | null;
  severity: string;
  check_method: string | null;
  check_scope: "component" | "artifact" | "both";
  applies_when: string | null;
  /** Derived: check_scope "component" ⇢ "component", else "global". */
  scope: "global" | "component";
  check_implementation: string | null;
}

/**
 * ds_load_system — skill Result envelope, `data` = full normalized spec
 * (design_system_skill loader). Spec sections are schema-versioned; unknown
 * keys are preserved verbatim.
 */
export interface LoadedSystemSpec {
  /** id, name, tagline, version, grammar_family, ... */
  system: Record<string, unknown>;
  /** colors, typography, spacing, borders, elevation, ... */
  tokens: Record<string, unknown>;
  /** Component entries with absolute SVG paths. */
  components: unknown;
  /** Layout templates. */
  layouts?: unknown;
  rulebook?: RulebookEntry[];
  grammar_extensions?: Record<string, unknown>;
  _meta: { library_root: string; [key: string]: unknown };
  [key: string]: unknown;
}

/**
 * One mechanical rule outcome inside a compliance run
 * (design_system_skill/rulebook.py `check_compliance`).
 */
export interface ComplianceRuleResult {
  rule_id: string;
  /** "pass" | "fail" | "advisory" — mechanical check outcome. */
  status: string;
  /**
   * Structured rule detail. When the wire carries a JSON string the bridge
   * parses it before returning; artifact-pipeline's violation-to-node mapper
   * depends on the structured fields. An unparseable detail string is a
   * protocol-kind failure, never delivered raw.
   */
  detail: Record<string, unknown>;
}

/**
 * ds_check_compliance — skill Result envelope, `data` = raw result. This raw
 * MCP shape is bridge-internal; the name ComplianceReport belongs exclusively
 * to artifact-pipeline's domain model in @studio/contract (artifact.ts).
 */
export interface RawComplianceResult {
  system_id: string;
  artifact_path: string;
  /** "component" | "artifact" | "all" (auto-detected when not passed). */
  scope: string;
  passed: number;
  failed: number;
  advisory: number;
  results: ComplianceRuleResult[];
  /** null when no mechanical ruleset exists for the system. */
  ruleset: string | null;
  mechanical_only: boolean;
  /** Present when ruleset is null — consumers branch on ruleset, not counts. */
  note?: string;
}

/** One palette entry in the authoring token export. */
export interface PaletteEntry {
  name: string;
  value: string;
  role: string;
  usage_constraint: string;
}

/**
 * wf_get_tokens — flat dict (NOT Result-enveloped): `{ok: true, ...payload}`
 * or `{ok: false, errors: string[]}` on load failure
 * (wireframe_skill/tokens.py `export_tokens_for_authoring`).
 */
export interface AuthoringTokens {
  system_id: string;
  palette: PaletteEntry[];
  /** SVG-ready attribute strings + CSS class block. */
  drawing_rules: Record<string, unknown>;
  /** Type scale formatted for SVG authoring. */
  typography: Record<string, unknown>;
  /** Spacing/layout constants. */
  layout: Record<string, unknown>;
}

/**
 * wf_read_component — single read: flat dict `{ok: true, ...ComponentRead}`;
 * batch: `{ok: true, components: ComponentRead[]}` where individual entries
 * may carry `{ok: false, component_id, error}` (translated by the bridge into
 * a single tool error — no partial batch); `{ok: false, errors: string[]}` on
 * spec load failure (wireframe_skill/components.py).
 */
export interface ComponentRead {
  /** Canonical id after variant resolution ("toggle" → "toggle-default"). */
  component_id: string;
  /** Raw SVG text. */
  svg_source: string;
  viewBox: { w: number; h: number };
  rendering_notes: string | null;
  /** Anatomy labels from the parent component spec. */
  anatomy: unknown | null;
  /** "primitive" | "composite" | "pattern" | "unknown". */
  tier: string;
  states: unknown | null;
  constraints: unknown | null;
}
