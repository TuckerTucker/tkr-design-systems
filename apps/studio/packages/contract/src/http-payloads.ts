/**
 * HTTP payload contract — request/response shapes for every studio-api
 * route except GET /api/health (HealthResponse lives in health.ts, owned by
 * studio-server) and GET/PUT /api/preferences (LayoutPreference lives in
 * preferences.ts, owned by docking-shell). Owned by studio-api.
 *
 * VersionSummary is imported from artifact.ts (owned by artifact-pipeline)
 * — the version listing projection has exactly one declaration; the wire
 * serves it unchanged. RestoreResponse aliases it per architecture.md.
 */
import type { VersionSummary } from "./artifact.js";

export type Platform = "mobile" | "desktop";

// ── Workspaces ──

export interface WorkspaceSettings {
  defaultSystem?: string;
  defaultPlatform?: Platform;
}

export interface WorkspaceSummary {
  /** Kebab-case slug. */
  id: string;
  name: string;
  /** ISO 8601. */
  created: string;
  /** ISO 8601. */
  updated: string;
  /** Artifact on the canvas when the workspace was last active. */
  activeArtifactId?: string;
  settings: WorkspaceSettings;
}

export interface WorkspaceCreateRequest {
  /** Auto-named ("Untitled Workspace N") when omitted. */
  name?: string;
}

export interface WorkspacePatchRequest {
  name?: string;
  settings?: WorkspaceSettings;
}

// ── Artifacts and versions ──

export interface ArtifactSummary {
  id: string;
  name: string;
  /** Design system id, e.g. "swiss". */
  system: string;
  platform: Platform;
  /** Current head version; null = no versions yet (canonical resolution). */
  headVersion: number | null;
}

export interface ArtifactDetail extends ArtifactSummary {
  /** Full lineage, ascending by number (VersionSummary from artifact.ts). */
  versions: VersionSummary[];
}

/**
 * POST …/versions/:n/restore — the new head's VersionSummary (the canvas
 * needs the new version number for its inline Undo). The restore emits
 * artifact.version_created through the normal pipeline path, identical to
 * generation.
 */
export type RestoreResponse = VersionSummary;

// ── Compliance projection ──

export type ComplianceStatus = "pass" | "warn" | "fail";

/**
 * One rule outcome in the HTTP/WS compliance projection. Domain
 * "advisory" maps to "warn"; nodeIds are resolved from artifact-pipeline's
 * ViolationNodeMapping before serving.
 */
export interface ComplianceRuleResult {
  ruleId: string;
  status: ComplianceStatus;
  /** Human-readable evidence summary when the rule carries one. */
  message?: string;
  /** SVG node references for canvas highlighting; [] for document-level. */
  nodeIds: string[];
}

/**
 * GET …/versions/:n/compliance — the projection of artifact-pipeline's
 * domain ComplianceReport (artifact.ts) with violation nodeIds resolved via
 * the pipeline's violation-to-node mapping. The raw report never crosses
 * the API boundary.
 */
export interface ComplianceResponse {
  status: ComplianceStatus;
  passed: number;
  failed: number;
  advisory: number;
  rules: ComplianceRuleResult[];
}

// ── Library ──

export interface LibrarySystem {
  id: string;
  name: string;
  tagline?: string;
  /** Registry status, e.g. "available", "draft", "deprecated". */
  status: string;
}

export interface TokenSetResponse {
  systemId: string;
  /** Authoring token export as returned by wf_get_tokens. */
  tokens: Record<string, unknown>;
}

export interface ComponentIndexEntry {
  id: string;
  name: string;
  /** Variant ids from the system spec, e.g. ["primary", "text"]. */
  variants: string[];
}

export interface ComponentDetail extends ComponentIndexEntry {
  /** Raw component SVG via wf_read_component (sanitized client-side by library-panel). */
  svg: string;
}

/**
 * One layout template from the loaded system spec. Loaded specs key
 * layout_templates by archetype id and carry an svg path + description;
 * platforms defaults to both when the spec does not constrain it.
 */
export interface LayoutTemplate {
  id: string;
  name: string;
  /** The layout archetype (the spec's template key, e.g. "dashboard"). */
  archetype: string;
  platforms: Platform[];
  description?: string;
}
