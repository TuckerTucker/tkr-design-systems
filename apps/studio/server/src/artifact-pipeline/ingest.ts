/**
 * Generation result ingestion — accepts the ArtifactSource discriminated
 * union (the artifact_produced payload from agent-orchestration), captures
 * provenance, and lands an immutable version through workspace-store
 * repositories. Both branches are first-class: { kind: "paths" } reads the
 * files wf_generate / wf_apply_substitutions emitted; { kind: "text" }
 * persists wf_assemble_from_blueprint's SVG text directly.
 *
 * All-or-nothing: a missing/unreadable source produces a typed
 * INGEST_OUTPUT_MISSING failure and nothing partial lands (the store's
 * staged-rename landing guarantees the directory is complete or absent).
 */
import { readFile } from "node:fs/promises";

import type {
  ArtifactMeta,
  ArtifactRepository,
  ArtifactSource,
  GenerationTool,
  SpecMetadataState,
  VersionProvenance,
} from "@studio/contract";
import { stringify as toYamlText } from "yaml";

import type { Logger } from "../logging/create-logger.js";
import type { ComplianceRunner } from "./compliance.js";
import {
  fail,
  fromStoreError,
  ingestOutputMissing,
  ok,
  type PipelineResult,
} from "./errors.js";
import type { PipelineEventBus } from "./events.js";
import {
  parseSpecMetadata,
  synthesizeSpecDocument,
} from "./spec-metadata.js";

/** Provenance as supplied by the producer (parent/created are assigned here). */
export interface ProvenanceInput {
  /** The brief behind this version. */
  brief: string;
  tool: GenerationTool;
  /** Tool parameters exactly as issued. */
  parameters: Record<string, unknown>;
}

export interface IngestRequest {
  workspaceId: string;
  /**
   * Target artifact. When it does not exist yet (first producing result),
   * the artifact is created in the same landing. Absent → a new artifact
   * is created and its allocated id returned in the outcome.
   */
  artifactId?: string;
  /** Display name when the artifact is created; defaults to the brief. */
  name?: string;
  source: ArtifactSource;
  provenance: ProvenanceInput;
}

export interface IngestOutcome {
  artifactId: string;
  version: number;
  /** New head after landing. */
  headVersion: number;
  provenance: VersionProvenance;
  /** Parsed spec metadata; degraded (never blocking) when the spec is corrupt. */
  metadata: SpecMetadataState;
}

export interface IngestDeps {
  artifacts: ArtifactRepository;
  compliance: ComplianceRunner;
  events: PipelineEventBus;
  logger: Logger;
}

interface ResolvedSource {
  svgText: string;
  /** Persisted verbatim as wireframe.spec.yaml. */
  specText: string;
}

function isErrnoNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as NodeJS.ErrnoException).code === "ENOENT"
  );
}

async function readSourceFile(
  filePath: string,
  field: "svgPath" | "specPath",
): Promise<PipelineResult<string>> {
  try {
    return ok(await readFile(filePath, "utf8"));
  } catch (err) {
    const what = isErrnoNotFound(err) ? "does not exist" : "is unreadable";
    return fail(
      ingestOutputMissing(
        `Generation output ${field} "${filePath}" ${what}`,
        { field, path: filePath },
        err,
      ),
    );
  }
}

/** Resolve both ArtifactSource branches to persistable content. */
async function resolveSource(
  source: ArtifactSource,
  provenance: ProvenanceInput,
): Promise<PipelineResult<ResolvedSource>> {
  if (source.kind === "paths") {
    const svg = await readSourceFile(source.svgPath, "svgPath");
    if (!svg.ok) {
      return svg;
    }
    const spec = await readSourceFile(source.specPath, "specPath");
    if (!spec.ok) {
      return spec;
    }
    return ok({ svgText: svg.value, specText: spec.value });
  }
  if (source.svgText.trim() === "") {
    return fail(
      ingestOutputMissing("Generation output svgText is empty", {
        field: "svgText",
      }),
    );
  }
  const specText =
    source.specYaml !== undefined && source.specYaml.trim() !== ""
      ? source.specYaml
      : toYamlText(
          synthesizeSpecDocument({
            brief: provenance.brief,
            svgText: source.svgText,
            parameters: provenance.parameters,
          }),
        );
  return ok({ svgText: source.svgText, specText });
}

/** Parse the spec into the degraded-capable metadata state. */
function metadataState(specText: string): SpecMetadataState {
  const parsed = parseSpecMetadata(specText);
  return parsed.ok
    ? { status: "available", metadata: parsed.value }
    : { status: "unavailable", reason: parsed.error.message };
}

/** Get the target artifact, creating it on the first producing result. */
async function resolveArtifact(
  deps: IngestDeps,
  request: IngestRequest,
  metadata: SpecMetadataState,
): Promise<PipelineResult<ArtifactMeta>> {
  const { artifacts, logger } = deps;
  if (request.artifactId !== undefined) {
    const existing = await artifacts.get(
      request.workspaceId,
      request.artifactId,
    );
    if (existing.ok) {
      return ok(existing.value);
    }
    if (existing.error.code !== "not_found") {
      return fail(fromStoreError(existing.error));
    }
  }

  const parsed =
    metadata.status === "available" ? metadata.metadata : undefined;
  const parameters = request.provenance.parameters;
  const system =
    parsed?.design_system.id ??
    (typeof parameters["system"] === "string"
      ? parameters["system"]
      : "wireframe");
  const platform =
    parsed?.wireframe.platform ??
    (parameters["platform"] === "mobile" ? "mobile" : "desktop");
  const name =
    request.name ?? request.artifactId ?? request.provenance.brief;

  const created = await artifacts.create(request.workspaceId, {
    name,
    system,
    platform,
  });
  if (!created.ok) {
    return fail(fromStoreError(created.error));
  }
  logger.info(
    {
      workspaceId: request.workspaceId,
      artifactId: created.value.id,
      system,
      platform,
    },
    "artifact created on first ingest",
  );
  return ok(created.value);
}

/**
 * Land content as a new version: create the immutable directory, move the
 * head pointer, emit version_created, and trigger compliance. Shared by
 * ingestion and restore — a restore emits and complies identically.
 */
export async function landVersion(
  deps: IngestDeps,
  args: {
    workspaceId: string;
    artifact: ArtifactMeta;
    svgText: string;
    specText: string;
    provenance: ProvenanceInput;
    metadata: SpecMetadataState;
  },
): Promise<PipelineResult<IngestOutcome>> {
  const { artifacts, compliance, events, logger } = deps;
  const { workspaceId, artifact } = args;

  const landed = await artifacts.createVersion(workspaceId, artifact.id, {
    svg: args.svgText,
    spec: args.specText,
    provenance: {
      parentVersion: artifact.headVersion,
      brief: args.provenance.brief,
      tool: args.provenance.tool,
      parameters: args.provenance.parameters,
    },
  });
  if (!landed.ok) {
    return fail(fromStoreError(landed.error));
  }
  const version = landed.value.number;

  const head = await artifacts.setHead(workspaceId, artifact.id, version);
  if (!head.ok) {
    // The version is durable and immutable; the pointer is repaired to the
    // highest landed version by the graph validator on the next read.
    logger.error(
      { workspaceId, artifactId: artifact.id, version, error: head.error },
      "head pointer update failed after landing; graph validator repairs on next read",
    );
  }

  const provenance: VersionProvenance = {
    parent: landed.value.parentVersion,
    brief: landed.value.brief,
    tool: args.provenance.tool,
    parameters: landed.value.parameters,
    created: landed.value.created,
  };
  events.emit("version_created", {
    workspaceId,
    artifactId: artifact.id,
    version,
    headVersion: version,
    provenance,
  });

  // Compliance attaches asynchronously — landing is never gated on it,
  // and its own event reports completion or unavailability.
  void compliance.run(workspaceId, artifact.id, version).then(
    (result) => {
      if (!result.ok) {
        logger.error(
          { workspaceId, artifactId: artifact.id, version, error: result.error },
          "compliance run failed",
        );
      }
    },
    (err: unknown) => {
      logger.error(
        { workspaceId, artifactId: artifact.id, version, err },
        "compliance run rejected unexpectedly",
      );
    },
  );

  return ok({
    artifactId: artifact.id,
    version,
    headVersion: version,
    provenance,
    metadata: args.metadata,
  });
}

/** Ingest one producing tool result as a new immutable version. */
export async function ingestArtifact(
  deps: IngestDeps,
  request: IngestRequest,
): Promise<PipelineResult<IngestOutcome>> {
  const resolved = await resolveSource(request.source, request.provenance);
  if (!resolved.ok) {
    deps.logger.warn(
      {
        workspaceId: request.workspaceId,
        artifactId: request.artifactId,
        error: resolved.error,
      },
      "ingestion rejected: generation output missing",
    );
    return resolved;
  }

  const metadata = metadataState(resolved.value.specText);
  if (metadata.status === "unavailable") {
    deps.logger.warn(
      {
        workspaceId: request.workspaceId,
        artifactId: request.artifactId,
        reason: metadata.reason,
      },
      "spec metadata degraded; version lands with the SVG as the artifact",
    );
  }

  const artifact = await resolveArtifact(deps, request, metadata);
  if (!artifact.ok) {
    return artifact;
  }

  return landVersion(deps, {
    workspaceId: request.workspaceId,
    artifact: artifact.value,
    svgText: resolved.value.svgText,
    specText: resolved.value.specText,
    provenance: request.provenance,
    metadata,
  });
}
