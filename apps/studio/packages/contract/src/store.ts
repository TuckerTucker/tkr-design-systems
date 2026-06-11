/**
 * Workspace store contract — storage models, typed result/error model, and
 * the repository interfaces of the plain-file persistence layer.
 *
 * Owned by workspace-store. Consumers (agent-orchestration,
 * artifact-pipeline, studio-api, the client) import these types from
 * `@studio/contract`; no capability redeclares them.
 *
 * The concrete factory lives in the server:
 * `createWorkspaceStore(config: { rootDir: string }, logger): WorkspaceStore`
 * (studio/server/src/store/index.ts). Consumers receive the constructed
 * repositories via IoC and never compose filesystem paths — path logic
 * exists only inside server/src/store/.
 *
 * Error discipline: every repository method resolves to a StoreResult<T>.
 * Errors cross the seam as values, never as thrown exceptions.
 */
import type { LayoutPreference } from "./preferences.js";

/** Workspace metadata, persisted as <workspace-id>/workspace.yaml. */
export interface WorkspaceMeta {
  /** Kebab-case slug, unique in the store root. */
  id: string;
  /** Display name; renames never change the id. */
  name: string;
  /** ISO 8601 creation stamp. */
  created: string;
  /** ISO 8601 last-modified stamp, refreshed on every update. */
  updated: string;
  /** Artifact on the canvas when the workspace was last active. */
  activeArtifactId: string | null;
  /** Workspace settings; opaque to the store. */
  settings: Record<string, unknown>;
}

export const TRANSCRIPT_RECORD_KINDS = [
  "message",
  "tool_call",
  "decision_chips",
  "routing_result",
] as const;

/** Canonical record kinds (architecture.md canonical resolution). */
export type TranscriptRecordKind = (typeof TRANSCRIPT_RECORD_KINDS)[number];

/**
 * One append-ordered transcript record in <workspace-id>/transcript.yaml.
 * The payload is opaque to the store; its semantics are owned by
 * agent-orchestration.
 */
export interface TranscriptRecord {
  id: string;
  kind: TranscriptRecordKind;
  /** ISO 8601. */
  timestamp: string;
  /** Preserved verbatim — the store never interprets it. */
  payload: unknown;
}

export type ArtifactPlatform = "mobile" | "desktop";

/**
 * Artifact metadata, persisted as artifacts/<artifact-id>/artifact.yaml.
 */
export interface ArtifactMeta {
  /** Kebab-case slug, unique within the workspace. */
  id: string;
  name: string;
  /** Design system id, e.g. "swiss". */
  system: string;
  platform: ArtifactPlatform;
  /**
   * Current head version number; null = no versions yet (canonical
   * resolution). Moved only by setHead — artifact-pipeline owns when the
   * pointer moves; the store owns how it lands on disk.
   */
  headVersion: number | null;
  /** ISO 8601 creation stamp. */
  created: string;
  /** ISO 8601 last-modified stamp. */
  updated: string;
}

/** Version provenance, persisted as versions/<NNNN>/version.yaml. */
export interface VersionMeta {
  /** 1-based; the directory name is zero-padded to at least 4 digits. */
  number: number;
  parentVersion: number | null;
  /** The brief that produced this version. */
  brief: string;
  /** Producing tool, e.g. "wf_generate", "wf_apply_substitutions". */
  tool: string;
  parameters: Record<string, unknown>;
  /** ISO 8601 creation stamp, assigned by the store. */
  created: string;
}

/** Input for ArtifactRepository.createVersion; the store assigns number and created. */
export interface NewVersionInput {
  /** wireframe.svg content, stored verbatim. */
  svg: string;
  /**
   * wireframe.spec.yaml document as emitted by the generation pipeline.
   * A string is written verbatim as YAML text; any other value is
   * serialized with the yaml package.
   */
  spec: unknown;
  provenance: Omit<VersionMeta, "number" | "created">;
}

/** Input for ArtifactRepository.create. */
export interface NewArtifactInput {
  name: string;
  system: string;
  platform: ArtifactPlatform;
}

export type StoreErrorCode = "not_found" | "corrupt" | "conflict" | "io_error";

/** Typed store failure — what failed and how to fix it, never thrown. */
export interface StoreError {
  code: StoreErrorCode;
  /** What failed and how to fix it, surfaceable in place. */
  message: string;
  /** Offending file or directory, relative to the store root. */
  path?: string;
  cause?: unknown;
}

/** Every repository method resolves to one of these — never a rejection. */
export type StoreResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: StoreError };

/**
 * Workspace listing entry with per-item degradation: a corrupt
 * workspace.yaml degrades that entry, never the whole list.
 */
export type WorkspaceListEntry =
  | { ok: true; workspace: WorkspaceMeta }
  | { ok: false; id: string; error: StoreError };

/** Patchable workspace fields; absent keys are left untouched. */
export type WorkspacePatch = Partial<
  Pick<WorkspaceMeta, "name" | "activeArtifactId" | "settings">
>;

export interface WorkspaceRepository {
  /** Scan the store root; trashed workspaces excluded, corrupt ones degraded. */
  list(): Promise<StoreResult<WorkspaceListEntry[]>>;
  /** Create from a display name; the slug id is allocated collision-free. */
  create(name: string): Promise<StoreResult<WorkspaceMeta>>;
  get(id: string): Promise<StoreResult<WorkspaceMeta>>;
  update(id: string, patch: WorkspacePatch): Promise<StoreResult<WorkspaceMeta>>;
  /** Rename the directory to .trash-<id>; contents untouched, recoverable. */
  softDelete(id: string): Promise<StoreResult<void>>;
  /** Ids recoverable from .trash- directories. */
  listDeleted(): Promise<StoreResult<string[]>>;
  /** Rename back; conflict when the id has been reused by a live workspace. */
  restore(id: string): Promise<StoreResult<WorkspaceMeta>>;
}

export interface TranscriptRepository {
  /** Full transcript in append order; absent transcript.yaml reads as []. */
  read(workspaceId: string): Promise<StoreResult<TranscriptRecord[]>>;
  /** Append one record atomically; the file is created on first append. */
  append(
    workspaceId: string,
    record: TranscriptRecord,
  ): Promise<StoreResult<void>>;
}

export interface ArtifactRepository {
  list(workspaceId: string): Promise<StoreResult<ArtifactMeta[]>>;
  create(
    workspaceId: string,
    init: NewArtifactInput,
  ): Promise<StoreResult<ArtifactMeta>>;
  get(
    workspaceId: string,
    artifactId: string,
  ): Promise<StoreResult<ArtifactMeta>>;
  listVersions(
    workspaceId: string,
    artifactId: string,
  ): Promise<StoreResult<VersionMeta[]>>;
  /**
   * Land a new immutable version as a unit (wireframe.svg +
   * wireframe.spec.yaml + version.yaml); the store assigns the next
   * sequential number. The head pointer is not moved — artifact-pipeline
   * follows up with setHead.
   */
  createVersion(
    workspaceId: string,
    artifactId: string,
    input: NewVersionInput,
  ): Promise<StoreResult<VersionMeta>>;
  readSvg(
    workspaceId: string,
    artifactId: string,
    version: number,
  ): Promise<StoreResult<string>>;
  readSpec(
    workspaceId: string,
    artifactId: string,
    version: number,
  ): Promise<StoreResult<unknown>>;
  /** not_found until the pipeline delivers the report (late attach is normal). */
  readCompliance(
    workspaceId: string,
    artifactId: string,
    version: number,
  ): Promise<StoreResult<unknown>>;
  writeCompliance(
    workspaceId: string,
    artifactId: string,
    version: number,
    report: unknown,
  ): Promise<StoreResult<void>>;
  /** Pointer move only — version directories are never rewritten. */
  setHead(
    workspaceId: string,
    artifactId: string,
    version: number,
  ): Promise<StoreResult<ArtifactMeta>>;
}

export interface PreferencesRepository {
  /** null = no preferences.yaml yet; docking-shell applies its defaults. */
  get(): Promise<StoreResult<LayoutPreference | null>>;
  /** Whole-document atomic replace; persisted opaquely (unknown keys kept). */
  put(prefs: LayoutPreference): Promise<StoreResult<void>>;
}

/** The four repositories returned by createWorkspaceStore (IoC seam). */
export interface WorkspaceStore {
  workspaces: WorkspaceRepository;
  transcripts: TranscriptRepository;
  artifacts: ArtifactRepository;
  preferences: PreferencesRepository;
}

/** Factory input — the store root (StudioConfig.workspacesDir). */
export interface StoreRootConfig {
  rootDir: string;
}
