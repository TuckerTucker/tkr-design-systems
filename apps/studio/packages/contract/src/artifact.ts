/**
 * Artifact contract — version lifecycle, provenance, parsed spec metadata,
 * canonical compliance model, violation-to-node mapping, and the pipeline's
 * domain event payloads.
 *
 * Owned by artifact-pipeline. Consumers (agent-orchestration, studio-api,
 * canvas, the client) import these types from `@studio/contract`; no
 * capability redeclares them.
 *
 * Storage-level shapes (ArtifactMeta for artifact.yaml, VersionMeta for
 * version.yaml) stay in store.ts (workspace-store's module); this module
 * declares the pipeline's domain view over them.
 */

/**
 * The payload of agent-orchestration's `artifact_produced` event and the
 * input to pipeline ingestion. Both branches are first-class:
 * wf_generate / wf_apply_substitutions emit files to disk (`paths`),
 * wf_assemble_from_blueprint returns SVG text (`text`).
 */
export type ArtifactSource =
  | { kind: "paths"; svgPath: string; specPath: string }
  | { kind: "text"; svgText: string; specYaml?: string };

/** Producing tools — restore-as-new-head is a producing tool. */
export type GenerationTool =
  | "wf_generate"
  | "wf_apply_substitutions"
  | "wf_assemble_from_blueprint"
  | "restore";

/** Provenance recorded in versions/<NNNN>/version.yaml. */
export interface VersionProvenance {
  /** Parent version number; null for the first version. */
  parent: number | null;
  /** The brief (or restore description) behind this version. */
  brief: string;
  tool: GenerationTool;
  /**
   * Tool parameters as issued (system, platform, layout_id, substitutions,
   * blueprint, restored_from, …). Recorded verbatim; no secrets by
   * construction.
   */
  parameters: Record<string, unknown>;
  /** ISO 8601 UTC. */
  created: string;
}

/** One landed, immutable version of an artifact. */
export interface ArtifactVersion {
  /** 1-based; zero-padded NNNN on disk. */
  number: number;
  provenance: VersionProvenance;
  /** Parsed wireframe.spec.yaml; degraded when the spec is corrupt. */
  metadata: SpecMetadataState;
  compliance: ComplianceState;
}

/** Version listing projection for the history scrubber. */
export interface VersionSummary {
  number: number;
  parent: number | null;
  tool: GenerationTool;
  brief: string;
  created: string;
  compliance: {
    status: ComplianceState["status"];
    passed?: number;
    failed?: number;
    advisory?: number;
  };
}

// ── Parsed spec metadata (wireframe.spec.yaml per wireframe-skill emit.py) ──

export interface ParsedSpecMetadata {
  wireframe: {
    brief: string;
    platform: "mobile" | "desktop";
    dimensions: { width: number; height: number };
    /** ISO 8601 UTC. */
    generated_at: string;
    /** e.g. "3.0-deterministic". */
    generator_version: string;
    /** Emitted SVG filename. */
    svg: string;
  };
  design_system: DesignSystemBlock;
  notes?: Array<{ text: string }>;
  /** Forward-compatible passthrough — unknown top-level keys preserved. */
  extra?: Record<string, unknown>;
}

export interface DesignSystemBlock {
  /** null when generated against the neutral wireframe library. */
  id: string | null;
  /** Present when id is null. */
  note?: string;
  spec_version?: string | null;
  system_version?: string | null;
  layout_template_used?: string;
  base_pattern?: string;
  pattern_source_svg?: string | null;
  selection_rationale?: string;
  selection_was_fallback?: boolean;
  components_used: ComponentUsed[];
  rulebook_compliance?: RulebookComplianceSummary;
  artifact_treatments_applied: unknown[];
}

export interface ComponentUsed {
  /** Component id, or "custom". */
  id: string;
  /** Blueprint region id. */
  region: string;
  x: number;
  y: number;
  type: "library" | "custom";
  /** Custom components only. */
  svg_length?: number;
}

export interface RulebookComplianceSummary {
  checked: number;
  mechanical_passed: number;
  mechanical_failed: number;
  advisory_warnings: number;
  failed_rules: string[];
  ruleset: string | null;
  scope: string;
}

/**
 * Metadata availability — a corrupt spec degrades metadata only; the
 * version (the SVG is the artifact) still lands.
 */
export type SpecMetadataState =
  | { status: "available"; metadata: ParsedSpecMetadata }
  | { status: "unavailable"; reason: string };

// ── Canonical compliance model (ds_check_compliance via mcp-bridge) ──

export type RuleStatus = "pass" | "fail" | "advisory";

export interface RuleResult {
  rule_id: string;
  status: RuleStatus;
  /**
   * Offending evidence: actual, expected, violations, hint, … The bridge
   * guarantees parsing — never a JSON string above the bridge.
   */
  detail: Record<string, unknown>;
}

/**
 * THE canonical compliance type — versions/<NNNN>/compliance.yaml holds
 * this report plus the derived violation mappings. The HTTP layer serves
 * ComplianceResponse (studio-api), never this type raw.
 */
export interface ComplianceReport {
  system_id: string;
  /** The persisted version SVG path that was checked. */
  artifact_path: string;
  /** "component" | "artifact" (auto-detected) | "all". */
  scope: string;
  passed: number;
  failed: number;
  advisory: number;
  results: RuleResult[];
  /** null = no mechanical ruleset for this system. */
  ruleset: string | null;
  mechanical_only: boolean;
  /** Present when ruleset is null. */
  note?: string;
}

export type ComplianceState =
  | { status: "pending" }
  | {
      status: "completed";
      report: ComplianceReport;
      violations: ViolationNodeMapping[];
    }
  /** Bridge down — the version landed anyway; re-runnable. */
  | { status: "unavailable"; reason: string };

// ── Violation → SVG node mapping (canvas highlighting) ──

/**
 * Rule detail carries offending VALUES, not node references. The mapper
 * scans the sanitized SVG for elements matching that evidence and resolves
 * stable element ids (assembled artifacts: {region}__{component}_{idx}).
 */
export interface ViolationNodeMapping {
  ruleId: string;
  /** Element ids in the sanitized document; [] when matchedBy is "document". */
  nodeIds: string[];
  matchedBy: "attribute-value" | "text-content" | "element-name" | "document";
  /** The RuleResult.detail subset that matched. */
  evidence: Record<string, unknown>;
}

// ── Pipeline domain events (relayed by studio-api over WS) ──

/** Payload of "artifact.version_created" — generation and restore alike. */
export interface ArtifactVersionCreatedPayload {
  workspaceId: string;
  artifactId: string;
  version: number;
  /** New head after landing (never null once a version exists). */
  headVersion: number;
  provenance: VersionProvenance;
}

/** Payload of "artifact.compliance_completed". */
export interface ArtifactComplianceCompletedPayload {
  workspaceId: string;
  artifactId: string;
  version: number;
  status: "completed" | "unavailable";
  passed?: number;
  failed?: number;
  advisory?: number;
}
