/**
 * Artifact routes — metadata + version list, raw sanitized SVG
 * (image/svg+xml, stable node IDs preserved), spec.yaml as JSON,
 * compliance as the ComplianceResponse projection (violation nodeIds
 * resolved via artifact-pipeline's ViolationNodeMapping), and POST restore
 * (restore-as-new-head; artifact.version_created flows through the normal
 * pipeline path, identical to generation).
 */
import type {
  ArtifactDetail,
  ArtifactMeta,
  ArtifactRepository,
  ArtifactSummary,
  ComplianceReport,
  ComplianceResponse,
  ComplianceRuleResult,
  ComplianceStatus,
  RestoreResponse,
  ViolationNodeMapping,
} from "@studio/contract";
import type { FastifyInstance, FastifyReply } from "fastify";

import type { ArtifactPipeline } from "../../artifact-pipeline/index.js";
import type { Logger } from "../../logging/create-logger.js";
import {
  apiError,
  errorResponse,
  fromPipelineError,
  fromStoreError,
  httpStatusFor,
} from "../errors.js";
import { validateSlugParam, validateVersionParam, type Validation } from "../validation.js";

export interface ArtifactRouteDeps {
  artifacts: ArtifactRepository;
  pipeline: ArtifactPipeline;
  logger: Logger;
}

interface ArtifactParams {
  wsId: string;
  artId: string;
}

interface VersionParams extends ArtifactParams {
  version: string;
}

function toSummary(meta: ArtifactMeta): ArtifactSummary {
  return {
    id: meta.id,
    name: meta.name,
    system: meta.system,
    platform: meta.platform,
    headVersion: meta.headVersion,
  };
}

/** Project the domain ComplianceReport + node mappings onto the wire shape. */
export function toComplianceResponse(
  report: ComplianceReport,
  violations: ViolationNodeMapping[],
): ComplianceResponse {
  const nodeIdsByRule = new Map<string, string[]>();
  for (const violation of violations) {
    const existing = nodeIdsByRule.get(violation.ruleId) ?? [];
    for (const nodeId of violation.nodeIds) {
      if (!existing.includes(nodeId)) {
        existing.push(nodeId);
      }
    }
    nodeIdsByRule.set(violation.ruleId, existing);
  }
  const rules: ComplianceRuleResult[] = report.results.map((rule) => {
    const status: ComplianceStatus =
      rule.status === "fail" ? "fail" : rule.status === "advisory" ? "warn" : "pass";
    const hint = rule.detail["hint"];
    return {
      ruleId: rule.rule_id,
      status,
      ...(typeof hint === "string" ? { message: hint } : {}),
      nodeIds: nodeIdsByRule.get(rule.rule_id) ?? [],
    };
  });
  const status: ComplianceStatus =
    report.failed > 0 ? "fail" : report.advisory > 0 ? "warn" : "pass";
  return {
    status,
    passed: report.passed,
    failed: report.failed,
    advisory: report.advisory,
    rules,
  };
}

function validateArtifactParams(
  params: ArtifactParams,
): Validation<{ wsId: string; artId: string }> {
  const wsId = validateSlugParam(params.wsId, "wsId");
  if (!wsId.ok) {
    return wsId as Validation<never>;
  }
  const artId = validateSlugParam(params.artId, "artId");
  if (!artId.ok) {
    return artId as Validation<never>;
  }
  return { ok: true, value: { wsId: wsId.value, artId: artId.value } };
}

function sendApiError(
  reply: FastifyReply,
  error: { code: Parameters<typeof httpStatusFor>[0]; message: string; fix: string; field?: string },
): FastifyReply {
  return reply.code(httpStatusFor(error.code)).send(errorResponse(error));
}

export function registerArtifactRoutes(
  app: FastifyInstance,
  deps: ArtifactRouteDeps,
): void {
  const log = deps.logger.child({ component: "api-artifacts" });

  app.get<{ Params: { wsId: string } }>(
    "/api/workspaces/:wsId/artifacts",
    async (request, reply) => {
      const wsId = validateSlugParam(request.params.wsId, "wsId");
      if (!wsId.ok) {
        return sendApiError(reply, wsId.error);
      }
      const listed = await deps.artifacts.list(wsId.value);
      if (!listed.ok) {
        return sendApiError(reply, fromStoreError(listed.error, "workspace_not_found"));
      }
      return reply.send(listed.value.map(toSummary));
    },
  );

  app.get<{ Params: ArtifactParams }>(
    "/api/workspaces/:wsId/artifacts/:artId",
    async (request, reply) => {
      const params = validateArtifactParams(request.params);
      if (!params.ok) {
        return sendApiError(reply, params.error);
      }
      const meta = await deps.artifacts.get(params.value.wsId, params.value.artId);
      if (!meta.ok) {
        return sendApiError(reply, fromStoreError(meta.error, "artifact_not_found"));
      }
      const versions = await deps.pipeline.listVersions(
        params.value.wsId,
        params.value.artId,
      );
      if (!versions.ok) {
        return sendApiError(reply, fromPipelineError(versions.error));
      }
      const detail: ArtifactDetail = {
        ...toSummary(meta.value),
        versions: versions.value,
      };
      return reply.send(detail);
    },
  );

  function versionRoute(
    suffix: string,
    handler: (
      reply: FastifyReply,
      wsId: string,
      artId: string,
      version: number,
    ) => Promise<FastifyReply>,
  ): void {
    app.get<{ Params: VersionParams }>(
      `/api/workspaces/:wsId/artifacts/:artId/versions/:version/${suffix}`,
      async (request, reply) => {
        const params = validateArtifactParams(request.params);
        if (!params.ok) {
          return sendApiError(reply, params.error);
        }
        const version = validateVersionParam(request.params.version);
        if (!version.ok) {
          return sendApiError(reply, version.error);
        }
        return handler(reply, params.value.wsId, params.value.artId, version.value);
      },
    );
  }

  versionRoute("svg", async (reply, wsId, artId, version) => {
    const svg = await deps.pipeline.getSanitizedSvg(wsId, artId, version);
    if (!svg.ok) {
      return sendApiError(reply, fromPipelineError(svg.error));
    }
    return reply.type("image/svg+xml").send(svg.value);
  });

  versionRoute("spec", async (reply, wsId, artId, version) => {
    const spec = await deps.artifacts.readSpec(wsId, artId, version);
    if (!spec.ok) {
      return sendApiError(reply, fromStoreError(spec.error, "version_not_found"));
    }
    // The store parses wireframe.spec.yaml with the yaml package; the route
    // serves the parsed document as application/json.
    return reply.send(spec.value);
  });

  versionRoute("compliance", async (reply, wsId, artId, version) => {
    const state = await deps.pipeline.getCompliance(wsId, artId, version);
    if (!state.ok) {
      return sendApiError(reply, fromPipelineError(state.error));
    }
    switch (state.value.status) {
      case "pending":
        return sendApiError(
          reply,
          apiError(
            "compliance_pending",
            `Compliance has not completed for version ${version} yet.`,
            "Await the artifact.compliance_completed WS event, then refetch.",
          ),
        );
      case "unavailable":
        return sendApiError(
          reply,
          apiError(
            "compliance_unavailable",
            `Compliance could not run for version ${version}: ${state.value.reason}`,
            "Bring the design-systems bridge up (see bridge.status) — the run is repeatable.",
          ),
        );
      case "completed":
        return reply.send(
          toComplianceResponse(state.value.report, state.value.violations),
        );
    }
  });

  app.post<{ Params: VersionParams }>(
    "/api/workspaces/:wsId/artifacts/:artId/versions/:version/restore",
    async (request, reply) => {
      const params = validateArtifactParams(request.params);
      if (!params.ok) {
        return sendApiError(reply, params.error);
      }
      const version = validateVersionParam(request.params.version);
      if (!version.ok) {
        return sendApiError(reply, version.error);
      }
      const restored = await deps.pipeline.restore(
        params.value.wsId,
        params.value.artId,
        version.value,
      );
      if (!restored.ok) {
        return sendApiError(reply, fromPipelineError(restored.error));
      }
      // RestoreResponse = the new head's VersionSummary. Read it back from
      // the canonical listing so compliance counts reflect the run the
      // landing already performed.
      const versions = await deps.pipeline.listVersions(
        params.value.wsId,
        params.value.artId,
      );
      const summary = versions.ok
        ? versions.value.find((entry) => entry.number === restored.value.version)
        : undefined;
      const response: RestoreResponse = summary ?? {
        number: restored.value.version,
        parent: restored.value.provenance.parent,
        tool: restored.value.provenance.tool,
        brief: restored.value.provenance.brief,
        created: restored.value.provenance.created,
        compliance: { status: "pending" },
      };
      log.info(
        {
          workspaceId: params.value.wsId,
          artifactId: params.value.artId,
          restoredFrom: version.value,
          newHead: response.number,
        },
        "version restored as new head",
      );
      return reply.send(response);
    },
  );
}
