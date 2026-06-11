/**
 * Version graph — parent links, head pointer integrity, version listing
 * for the history scrubber, and restore-as-new-head.
 *
 * Restore is undo, never destructive rollback: the restored version's
 * content is COPIED byte-identical into a new head version with tool
 * "restore" and parameters.restored_from; nothing is ever deleted or
 * modified, so undoing a restore is just another restore.
 */
import { readFile } from "node:fs/promises";

import type {
  ArtifactRepository,
  ComplianceState,
  GenerationTool,
  SpecMetadataState,
  VersionMeta,
  VersionSummary,
} from "@studio/contract";

import type { Logger } from "../logging/create-logger.js";
import type { ComplianceRunner } from "./compliance.js";
import {
  fail,
  fromStoreError,
  graphCorrupt,
  ok,
  versionNotFound,
  type PipelineResult,
} from "./errors.js";
import { landVersion, type IngestDeps, type IngestOutcome } from "./ingest.js";
import { parseSpecMetadata } from "./spec-metadata.js";
import type { VersionFileResolver } from "./version-files.js";

function metadataStateFromDoc(doc: unknown): SpecMetadataState {
  const parsed = parseSpecMetadata(doc);
  return parsed.ok
    ? { status: "available", metadata: parsed.value }
    : { status: "unavailable", reason: parsed.error.message };
}

const GENERATION_TOOLS: ReadonlySet<string> = new Set([
  "wf_generate",
  "wf_apply_substitutions",
  "wf_assemble_from_blueprint",
  "restore",
]);

export interface VersionGraphDeps extends IngestDeps {
  artifacts: ArtifactRepository;
  compliance: ComplianceRunner;
  versionFiles: VersionFileResolver;
  logger: Logger;
}

function toGenerationTool(tool: string, logger: Logger): GenerationTool {
  if (!GENERATION_TOOLS.has(tool)) {
    logger.warn({ tool }, "unknown producing tool in version.yaml");
  }
  return tool as GenerationTool;
}

function complianceSummary(
  state: ComplianceState,
): VersionSummary["compliance"] {
  if (state.status === "completed") {
    return {
      status: "completed",
      passed: state.report.passed,
      failed: state.report.failed,
      advisory: state.report.advisory,
    };
  }
  return { status: state.status };
}

/**
 * Validate graph integrity over the landed set: every parent resolves and
 * the head pointer names a landed version. A dangling head is REPAIRED to
 * the highest landed version (the only state an interrupted landing can
 * leave); a dangling parent is corruption and reported as a typed error.
 */
async function validateGraph(
  deps: VersionGraphDeps,
  workspaceId: string,
  artifactId: string,
  versions: VersionMeta[],
  headVersion: number | null,
): Promise<PipelineResult<void>> {
  const landed = new Set(versions.map((version) => version.number));
  for (const version of versions) {
    if (
      version.parentVersion !== null &&
      !landed.has(version.parentVersion)
    ) {
      return fail(
        graphCorrupt(
          `Version ${version.number} of artifact "${artifactId}" links to parent ${version.parentVersion}, which does not exist`,
          {
            workspaceId,
            artifactId,
            version: version.number,
            parent: version.parentVersion,
          },
        ),
      );
    }
  }
  if (headVersion !== null && !landed.has(headVersion)) {
    const highest = versions[versions.length - 1];
    if (highest === undefined) {
      return fail(
        graphCorrupt(
          `Artifact "${artifactId}" points at head version ${headVersion} but has no versions`,
          { workspaceId, artifactId, headVersion },
        ),
      );
    }
    deps.logger.warn(
      { workspaceId, artifactId, headVersion, repairedTo: highest.number },
      "dangling head pointer repaired to highest landed version",
    );
    const repaired = await deps.artifacts.setHead(
      workspaceId,
      artifactId,
      highest.number,
    );
    if (!repaired.ok) {
      return fail(fromStoreError(repaired.error));
    }
  }
  return ok(undefined);
}

/**
 * Version listing for the history scrubber — provenance summaries plus
 * compliance counts, ascending by number. Reads only the small YAML files,
 * never SVG content.
 */
export async function listVersionSummaries(
  deps: VersionGraphDeps,
  workspaceId: string,
  artifactId: string,
): Promise<PipelineResult<VersionSummary[]>> {
  const meta = await deps.artifacts.get(workspaceId, artifactId);
  if (!meta.ok) {
    return fail(fromStoreError(meta.error));
  }
  const versions = await deps.artifacts.listVersions(workspaceId, artifactId);
  if (!versions.ok) {
    return fail(fromStoreError(versions.error));
  }

  const integrity = await validateGraph(
    deps,
    workspaceId,
    artifactId,
    versions.value,
    meta.value.headVersion,
  );
  if (!integrity.ok) {
    return integrity;
  }

  const summaries: VersionSummary[] = [];
  for (const version of versions.value) {
    const compliance = await deps.compliance.read(
      workspaceId,
      artifactId,
      version.number,
    );
    if (!compliance.ok) {
      // Per-item degradation: a damaged compliance.yaml costs the counts
      // in the listing, never the listing itself.
      deps.logger.warn(
        {
          workspaceId,
          artifactId,
          version: version.number,
          error: compliance.error,
        },
        "compliance state degraded to pending in version listing",
      );
    }
    summaries.push({
      number: version.number,
      parent: version.parentVersion,
      tool: toGenerationTool(version.tool, deps.logger),
      brief: version.brief,
      created: version.created,
      compliance: complianceSummary(
        compliance.ok ? compliance.value : { status: "pending" },
      ),
    });
  }
  return ok(summaries);
}

/**
 * Restore-as-new-head: copy version `version`'s content byte-identical
 * into a NEW head version (tool "restore", parameters.restored_from).
 * Emits version_created identically to a generation; VERSION_NOT_FOUND
 * leaves headVersion unchanged.
 */
export async function restoreVersion(
  deps: VersionGraphDeps,
  workspaceId: string,
  artifactId: string,
  version: number,
): Promise<PipelineResult<IngestOutcome>> {
  const meta = await deps.artifacts.get(workspaceId, artifactId);
  if (!meta.ok) {
    return fail(fromStoreError(meta.error));
  }

  const svg = await deps.artifacts.readSvg(workspaceId, artifactId, version);
  if (!svg.ok) {
    return svg.error.code === "not_found"
      ? fail(versionNotFound(artifactId, version))
      : fail(fromStoreError(svg.error, "VERSION_NOT_FOUND"));
  }

  // Spec text read verbatim (store-resolved path) so the copy is
  // byte-identical — re-serializing parsed YAML would not be.
  let specText: string;
  try {
    specText = await readFile(
      deps.versionFiles(workspaceId, artifactId, version, "spec"),
      "utf8",
    );
  } catch (err) {
    return fail({
      code: "VERSION_NOT_FOUND",
      message: `wireframe.spec.yaml of version ${version} of artifact "${artifactId}" is unreadable`,
      detail: { workspaceId, artifactId, version },
      cause: err,
    });
  }

  const spec = await deps.artifacts.readSpec(workspaceId, artifactId, version);
  const metadata = spec.ok
    ? metadataStateFromDoc(spec.value)
    : ({ status: "unavailable", reason: spec.error.message } as const);

  deps.logger.info(
    { workspaceId, artifactId, restoredFrom: version, head: meta.value.headVersion },
    "restoring version as new head",
  );

  return landVersion(deps, {
    workspaceId,
    artifact: meta.value,
    svgText: svg.value,
    specText,
    provenance: {
      brief: `Restore of version ${version}`,
      tool: "restore",
      parameters: { restored_from: version },
    },
    metadata,
  });
}
