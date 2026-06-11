/**
 * artifact-pipeline — the artifact lifecycle from generation result to
 * inspectable, versioned canvas object: ingestion with provenance, the
 * version graph with restore-as-new-head, typed spec metadata, canonical
 * per-version compliance, serving-side SVG sanitization, and
 * violation-to-node mapping.
 *
 * IoC factory: the pipeline receives the store's ArtifactRepository, the
 * MCP bridge, the event bus, and the version-file resolver — it never
 * constructs paths or imports shared instances. Errors cross this seam as
 * PipelineResult values, never thrown exceptions.
 */
import type {
  ArtifactRepository,
  ArtifactVersion,
  ComplianceState,
  SpecMetadataState,
  VersionSummary,
} from "@studio/contract";

import type { Logger } from "../logging/create-logger.js";
import {
  createComplianceRunner,
  type ComplianceBridge,
  type ComplianceRunner,
} from "./compliance.js";
import {
  fail,
  fromStoreError,
  ok,
  versionNotFound,
  type PipelineResult,
} from "./errors.js";
import {
  createPipelineEventBus,
  type PipelineEventBus,
} from "./events.js";
import {
  ingestArtifact,
  type IngestDeps,
  type IngestOutcome,
  type IngestRequest,
} from "./ingest.js";
import { sanitizeSvg } from "./sanitize.js";
import { parseSpecMetadata } from "./spec-metadata.js";
import {
  listVersionSummaries,
  restoreVersion,
  type VersionGraphDeps,
} from "./version-graph.js";
import type { VersionFileResolver } from "./version-files.js";

export type {
  PipelineError,
  PipelineErrorCode,
  PipelineResult,
} from "./errors.js";
export {
  createPipelineEventBus,
  type PipelineEventBus,
  type PipelineEventListener,
  type PipelineEventMap,
  type PipelineEventName,
} from "./events.js";
export type {
  IngestOutcome,
  IngestRequest,
  ProvenanceInput,
} from "./ingest.js";
export {
  parseSpecMetadata,
  synthesizeSpecDocument,
  type SynthesizeSpecOptions,
} from "./spec-metadata.js";
export { sanitizeSvg } from "./sanitize.js";
export {
  attributeValue,
  parseSvgDocument,
  resolveNodeId,
  type SvgAttribute,
  type SvgDocument,
  type SvgElement,
  type SvgParseResult,
} from "./svg-document.js";
export { mapViolations } from "./violation-mapping.js";
export {
  createComplianceRunner,
  toComplianceReport,
  unavailableReason,
  type ComplianceBridge,
  type ComplianceRunner,
  type ComplianceRunnerOptions,
} from "./compliance.js";
export {
  createStoreVersionFileResolver,
  type VersionFileKind,
  type VersionFileResolver,
} from "./version-files.js";

export interface ArtifactPipelineOptions {
  /** workspace-store artifact repository (storage mechanics live there). */
  artifacts: ArtifactRepository;
  /** mcp-bridge — only checkCompliance is used. */
  bridge: ComplianceBridge;
  /**
   * Store-derived version file paths (compliance artifact_path, restore's
   * verbatim spec read). Compose with createStoreVersionFileResolver.
   */
  versionFiles: VersionFileResolver;
  /**
   * Event bus consumed by studio-api (Wave 4). Created internally when
   * not injected; either way it is exposed on the pipeline handle.
   */
  events?: PipelineEventBus;
}

export interface ArtifactPipeline {
  /** Land a producing tool result (ArtifactSource union) as a new version. */
  ingest(request: IngestRequest): Promise<PipelineResult<IngestOutcome>>;
  /** Restore-as-new-head; emits version_created identically to ingest. */
  restore(
    workspaceId: string,
    artifactId: string,
    version: number,
  ): Promise<PipelineResult<IngestOutcome>>;
  /** History-scrubber projection, ascending; small YAML reads only. */
  listVersions(
    workspaceId: string,
    artifactId: string,
  ): Promise<PipelineResult<VersionSummary[]>>;
  /** One version's full domain view (provenance, metadata, compliance). */
  getVersion(
    workspaceId: string,
    artifactId: string,
    version: number,
  ): Promise<PipelineResult<ArtifactVersion>>;
  /** Typed spec metadata; corrupt specs degrade, the SVG still serves. */
  getSpecMetadata(
    workspaceId: string,
    artifactId: string,
    version: number,
  ): Promise<PipelineResult<SpecMetadataState>>;
  /** Persisted compliance state; absent compliance.yaml reads pending. */
  getCompliance(
    workspaceId: string,
    artifactId: string,
    version: number,
  ): Promise<PipelineResult<ComplianceState>>;
  /** Explicit (re-)run — the recovery path for "unavailable" versions. */
  runCompliance(
    workspaceId: string,
    artifactId: string,
    version: number,
  ): Promise<PipelineResult<ComplianceState>>;
  /** Sanitized SVG for serving; cached per immutable version. */
  getSanitizedSvg(
    workspaceId: string,
    artifactId: string,
    version: number,
  ): Promise<PipelineResult<string>>;
  /** The pipeline's domain event stream (version_created, compliance_completed). */
  events: PipelineEventBus;
}

/**
 * Construct the pipeline from its collaborators alone (IoC seam).
 *
 * @param options - Repositories, bridge, resolver, optional event bus.
 * @param logger - pino logger; modules log through children.
 */
export function createArtifactPipeline(
  options: ArtifactPipelineOptions,
  logger: Logger,
): ArtifactPipeline {
  const log = logger.child({ component: "artifact-pipeline" });
  const events = options.events ?? createPipelineEventBus(log);
  const compliance: ComplianceRunner = createComplianceRunner(
    {
      artifacts: options.artifacts,
      bridge: options.bridge,
      versionFiles: options.versionFiles,
      events,
    },
    log,
  );

  const ingestDeps: IngestDeps = {
    artifacts: options.artifacts,
    compliance,
    events,
    logger: log,
  };
  const graphDeps: VersionGraphDeps = {
    ...ingestDeps,
    versionFiles: options.versionFiles,
  };

  /** Sanitized output cache — versions are immutable, never stale. */
  const sanitizedCache = new Map<string, string>();

  async function getSpecMetadata(
    workspaceId: string,
    artifactId: string,
    version: number,
  ): Promise<PipelineResult<SpecMetadataState>> {
    const spec = await options.artifacts.readSpec(
      workspaceId,
      artifactId,
      version,
    );
    if (!spec.ok) {
      if (spec.error.code === "corrupt") {
        // Unparseable spec degrades metadata only — the SVG still serves.
        return ok({ status: "unavailable", reason: spec.error.message });
      }
      return fail(fromStoreError(spec.error, "VERSION_NOT_FOUND"));
    }
    const parsed = parseSpecMetadata(spec.value);
    return ok(
      parsed.ok
        ? { status: "available", metadata: parsed.value }
        : { status: "unavailable", reason: parsed.error.message },
    );
  }

  return {
    events,

    ingest(request) {
      return ingestArtifact(ingestDeps, request);
    },

    restore(workspaceId, artifactId, version) {
      return restoreVersion(graphDeps, workspaceId, artifactId, version);
    },

    listVersions(workspaceId, artifactId) {
      return listVersionSummaries(graphDeps, workspaceId, artifactId);
    },

    async getVersion(workspaceId, artifactId, version) {
      const versions = await options.artifacts.listVersions(
        workspaceId,
        artifactId,
      );
      if (!versions.ok) {
        return fail(fromStoreError(versions.error));
      }
      const meta = versions.value.find((entry) => entry.number === version);
      if (meta === undefined) {
        return fail(versionNotFound(artifactId, version));
      }
      const metadata = await getSpecMetadata(workspaceId, artifactId, version);
      if (!metadata.ok) {
        return metadata;
      }
      const state = await compliance.read(workspaceId, artifactId, version);
      if (!state.ok) {
        return state;
      }
      return ok({
        number: meta.number,
        provenance: {
          parent: meta.parentVersion,
          brief: meta.brief,
          tool: meta.tool as ArtifactVersion["provenance"]["tool"],
          parameters: meta.parameters,
          created: meta.created,
        },
        metadata: metadata.value,
        compliance: state.value,
      });
    },

    getSpecMetadata,

    getCompliance(workspaceId, artifactId, version) {
      return compliance.read(workspaceId, artifactId, version);
    },

    runCompliance(workspaceId, artifactId, version) {
      return compliance.run(workspaceId, artifactId, version);
    },

    async getSanitizedSvg(workspaceId, artifactId, version) {
      const cacheKey = `${workspaceId}/${artifactId}/${version}`;
      const cached = sanitizedCache.get(cacheKey);
      if (cached !== undefined) {
        return ok(cached);
      }
      const svg = await options.artifacts.readSvg(
        workspaceId,
        artifactId,
        version,
      );
      if (!svg.ok) {
        return fail(fromStoreError(svg.error, "VERSION_NOT_FOUND"));
      }
      const sanitized = sanitizeSvg(svg.value);
      if (!sanitized.ok) {
        log.error(
          { workspaceId, artifactId, version, error: sanitized.error },
          "stored SVG failed sanitization; structured error served instead",
        );
        return sanitized;
      }
      sanitizedCache.set(cacheKey, sanitized.value);
      return sanitized;
    },
  };
}
