/**
 * Compliance per version — runs ds_check_compliance through the
 * mcp-bridge against the PERSISTED version SVG path, maps the
 * bridge-internal RawComplianceResult onto the canonical ComplianceReport
 * (contract artifact.ts), derives violation-to-node mappings against the
 * sanitized document, and persists everything as compliance.yaml.
 *
 * Reported-state semantics: mechanical failures are version data — a
 * failing rulebook NEVER blocks landing. Bridge-down records the
 * "unavailable" state with a reason; the run is repeatable after
 * recovery (run() overwrites compliance.yaml).
 */
import type {
  ArtifactRepository,
  BridgeError,
  ComplianceReport,
  ComplianceState,
  RuleResult,
  RuleStatus,
  ViolationNodeMapping,
} from "@studio/contract";

import type { McpBridge } from "../mcp/index.js";
import type { RawComplianceResult } from "../mcp/types.js";
import type { Logger } from "../logging/create-logger.js";
import {
  fail,
  fromStoreError,
  ok,
  type PipelineResult,
} from "./errors.js";
import type { PipelineEventBus } from "./events.js";
import { parseSpecMetadata } from "./spec-metadata.js";
import { sanitizeSvg } from "./sanitize.js";
import type { VersionFileResolver } from "./version-files.js";
import { mapViolations } from "./violation-mapping.js";

/** The one bridge tool this module needs (IoC — injected, never imported). */
export type ComplianceBridge = Pick<McpBridge, "checkCompliance">;

export interface ComplianceRunnerOptions {
  artifacts: ArtifactRepository;
  bridge: ComplianceBridge;
  /** Store-derived absolute paths to persisted version files. */
  versionFiles: VersionFileResolver;
  events: PipelineEventBus;
}

export interface ComplianceRunner {
  /**
   * Run compliance for a landed version and persist compliance.yaml.
   * Triggered on every landing; also the explicit re-run path for
   * versions left "unavailable" by a bridge outage.
   */
  run(
    workspaceId: string,
    artifactId: string,
    version: number,
  ): Promise<PipelineResult<ComplianceState>>;
  /** Read the persisted state; absent compliance.yaml reads as pending. */
  read(
    workspaceId: string,
    artifactId: string,
    version: number,
  ): Promise<PipelineResult<ComplianceState>>;
}

const RULE_STATUSES: ReadonlySet<string> = new Set([
  "pass",
  "fail",
  "advisory",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Project the bridge-internal raw shape onto the canonical domain model. */
export function toComplianceReport(
  raw: RawComplianceResult,
  logger: Logger,
): ComplianceReport {
  const results: RuleResult[] = raw.results.map((entry) => {
    let status: RuleStatus;
    if (RULE_STATUSES.has(entry.status)) {
      status = entry.status as RuleStatus;
    } else {
      logger.warn(
        { ruleId: entry.rule_id, status: entry.status },
        "unknown compliance rule status recorded as advisory",
      );
      status = "advisory";
    }
    return { rule_id: entry.rule_id, status, detail: entry.detail };
  });
  return {
    system_id: raw.system_id,
    artifact_path: raw.artifact_path,
    scope: raw.scope,
    passed: raw.passed,
    failed: raw.failed,
    advisory: raw.advisory,
    results,
    ruleset: raw.ruleset,
    mechanical_only: raw.mechanical_only,
    ...(raw.note !== undefined ? { note: raw.note } : {}),
  };
}

/** Classify a bridge failure into the recorded unavailable-state reason. */
export function unavailableReason(error: BridgeError): string {
  if (error.kind === "bridge_down" || error.kind === "timeout") {
    return `bridge_unavailable: ${error.message}`;
  }
  if (error.kind === "tool") {
    return `${error.code ?? "TOOL_ERROR"}: ${error.message}`;
  }
  return `${error.kind}: ${error.message}`;
}

/** Validate a compliance.yaml document back into a ComplianceState. */
function parseComplianceDoc(doc: unknown): ComplianceState | null {
  if (!isRecord(doc)) {
    return null;
  }
  if (doc["status"] === "unavailable" && typeof doc["reason"] === "string") {
    return { status: "unavailable", reason: doc["reason"] };
  }
  if (doc["status"] === "completed" && isRecord(doc["report"])) {
    const report = doc["report"] as unknown as ComplianceReport;
    const violations = Array.isArray(doc["violations"])
      ? (doc["violations"] as ViolationNodeMapping[])
      : [];
    return { status: "completed", report, violations };
  }
  if (doc["status"] === "pending") {
    return { status: "pending" };
  }
  return null;
}

export function createComplianceRunner(
  options: ComplianceRunnerOptions,
  logger: Logger,
): ComplianceRunner {
  const log = logger.child({ component: "artifact-pipeline-compliance" });
  const { artifacts, bridge, versionFiles, events } = options;

  /** design_system.id from the persisted spec; artifact.yaml as fallback. */
  async function resolveSystemId(
    workspaceId: string,
    artifactId: string,
    version: number,
  ): Promise<PipelineResult<string>> {
    const spec = await artifacts.readSpec(workspaceId, artifactId, version);
    let degradedReason: string | undefined;
    if (spec.ok) {
      const metadata = parseSpecMetadata(spec.value);
      if (metadata.ok) {
        // Neutral-library generation (id null) uses the canonical
        // "wireframe" ruleset.
        return ok(metadata.value.design_system.id ?? "wireframe");
      }
      degradedReason = metadata.error.message;
    } else if (spec.error.code === "corrupt") {
      degradedReason = spec.error.message;
    } else {
      return fail(fromStoreError(spec.error, "VERSION_NOT_FOUND"));
    }
    const meta = await artifacts.get(workspaceId, artifactId);
    if (!meta.ok) {
      return fail(fromStoreError(meta.error));
    }
    log.warn(
      { workspaceId, artifactId, version, reason: degradedReason },
      "spec metadata unavailable; compliance system taken from artifact.yaml",
    );
    return ok(meta.value.system);
  }

  async function persistAndEmit(
    workspaceId: string,
    artifactId: string,
    version: number,
    state: ComplianceState,
  ): Promise<PipelineResult<ComplianceState>> {
    const written = await artifacts.writeCompliance(
      workspaceId,
      artifactId,
      version,
      state,
    );
    if (!written.ok) {
      log.error(
        { workspaceId, artifactId, version, error: written.error },
        "compliance.yaml write failed",
      );
      return fail(fromStoreError(written.error, "VERSION_NOT_FOUND"));
    }
    if (state.status === "completed") {
      events.emit("compliance_completed", {
        workspaceId,
        artifactId,
        version,
        status: "completed",
        passed: state.report.passed,
        failed: state.report.failed,
        advisory: state.report.advisory,
      });
    } else if (state.status === "unavailable") {
      events.emit("compliance_completed", {
        workspaceId,
        artifactId,
        version,
        status: "unavailable",
      });
    }
    return ok(state);
  }

  return {
    async run(workspaceId, artifactId, version) {
      const svg = await artifacts.readSvg(workspaceId, artifactId, version);
      if (!svg.ok) {
        return fail(fromStoreError(svg.error, "VERSION_NOT_FOUND"));
      }
      const systemId = await resolveSystemId(workspaceId, artifactId, version);
      if (!systemId.ok) {
        return systemId;
      }
      const artifactPath = versionFiles(workspaceId, artifactId, version, "svg");
      const result = await bridge.checkCompliance({
        systemId: systemId.value,
        artifactPath,
      });

      if (!result.ok) {
        const reason = unavailableReason(result.error);
        log.warn(
          { workspaceId, artifactId, version, kind: result.error.kind, reason },
          "compliance unavailable; version unaffected and re-runnable",
        );
        return persistAndEmit(workspaceId, artifactId, version, {
          status: "unavailable",
          reason,
        });
      }

      const report = toComplianceReport(result.value, log);
      const sanitized = sanitizeSvg(svg.value);
      if (!sanitized.ok) {
        log.warn(
          { workspaceId, artifactId, version, reason: sanitized.error.message },
          "stored SVG failed sanitization; violations map to document scope",
        );
      }
      const violations = mapViolations(
        report.results,
        sanitized.ok ? sanitized.value : null,
        log,
      );
      log.info(
        {
          workspaceId,
          artifactId,
          version,
          systemId: systemId.value,
          passed: report.passed,
          failed: report.failed,
          advisory: report.advisory,
        },
        "compliance completed",
      );
      return persistAndEmit(workspaceId, artifactId, version, {
        status: "completed",
        report,
        violations,
      });
    },

    async read(workspaceId, artifactId, version) {
      const doc = await artifacts.readCompliance(
        workspaceId,
        artifactId,
        version,
      );
      if (!doc.ok) {
        if (doc.error.code !== "not_found") {
          return fail(fromStoreError(doc.error, "VERSION_NOT_FOUND"));
        }
        // Absent compliance.yaml on an existing version = pending (late
        // attach is normal); a missing version stays VERSION_NOT_FOUND.
        const spec = await artifacts.readSpec(workspaceId, artifactId, version);
        if (!spec.ok && spec.error.code === "not_found") {
          return fail(fromStoreError(spec.error, "VERSION_NOT_FOUND"));
        }
        return ok({ status: "pending" });
      }
      const state = parseComplianceDoc(doc.value);
      if (state === null) {
        return fail({
          code: "STORE_FAILURE",
          message: `compliance.yaml for version ${version} of artifact "${artifactId}" is damaged; re-run compliance to rewrite it`,
          detail: { workspaceId, artifactId, version },
        });
      }
      return ok(state);
    },
  };
}
