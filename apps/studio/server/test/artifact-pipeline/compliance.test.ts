/**
 * Compliance per version against the REAL design-systems MCP server
 * (testing policy: the server is never mocked). One shared bridge backs
 * the suite; the outage/recovery test drives its own lifecycle.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type {
  ArtifactComplianceCompletedPayload,
  ArtifactSource,
} from "@studio/contract";

import { createMcpBridge, type McpBridge } from "../../src/mcp/bridge.js";
import {
  toComplianceReport,
  unavailableReason,
} from "../../src/artifact-pipeline/index.js";
import type { RawComplianceResult } from "../../src/mcp/types.js";
import { captureLogger } from "../helpers.js";
import { realBridgeConfig } from "../mcp/mcp-helpers.js";
import {
  ASSEMBLED_SPEC,
  expectPipelineOk,
  fixtureText,
  makePipeline,
  onceEvent,
  SWISS_DASHBOARD_SPEC,
  SWISS_DASHBOARD_SVG,
  VIOLATING_SVG,
} from "./pipeline-helpers.js";

const PATHS_SOURCE: ArtifactSource = {
  kind: "paths",
  svgPath: SWISS_DASHBOARD_SVG,
  specPath: SWISS_DASHBOARD_SPEC,
};

const PROVENANCE = {
  brief: "analytics dashboard with stats and activity feed",
  tool: "wf_generate" as const,
  parameters: { system: "swiss", platform: "desktop" },
};

let bridge: McpBridge;

beforeAll(async () => {
  bridge = createMcpBridge(realBridgeConfig(), captureLogger().logger);
  await bridge.start();
  expect(bridge.status().state).toBe("up");
}, 30_000);

afterAll(async () => {
  await bridge.stop();
});

describe("compliance pipeline (slice 4) — real MCP server", () => {
  it("attaches a completed report to a landed version and emits counts", async () => {
    const fixture = await makePipeline(bridge);
    const completion = onceEvent(fixture.events, "compliance_completed");
    const outcome = expectPipelineOk(
      await fixture.pipeline.ingest({
        workspaceId: fixture.workspace.id,
        artifactId: "dashboard",
        source: PATHS_SOURCE,
        provenance: PROVENANCE,
      }),
    );

    const payload = await completion;
    expect(payload).toMatchObject({
      workspaceId: fixture.workspace.id,
      artifactId: "dashboard",
      version: outcome.version,
      status: "completed",
    });

    const state = expectPipelineOk(
      await fixture.pipeline.getCompliance(
        fixture.workspace.id,
        "dashboard",
        outcome.version,
      ),
    );
    expect(state.status).toBe("completed");
    if (state.status !== "completed") {
      return;
    }
    expect(state.report.system_id).toBe("swiss");
    expect(state.report.ruleset).toBe("swiss");
    expect(state.report.results.length).toBeGreaterThan(0);
    for (const rule of state.report.results) {
      expect(rule.rule_id).toBeTruthy();
      expect(["pass", "fail", "advisory"]).toContain(rule.status);
      expect(typeof rule.detail).toBe("object");
    }
    // The persisted SVG path was checked, not a temp copy.
    expect(state.report.artifact_path).toContain("versions/0001/wireframe.svg");
    // Event counts match compliance.yaml.
    expect(payload.passed).toBe(state.report.passed);
    expect(payload.failed).toBe(state.report.failed);
    expect(payload.advisory).toBe(state.report.advisory);

    // compliance.yaml on disk via the store seam.
    const doc = await fixture.store.store.artifacts.readCompliance(
      fixture.workspace.id,
      "dashboard",
      outcome.version,
    );
    expect(doc.ok).toBe(true);
  });

  it("lands a rulebook-failing version and maps the violation to its node", async () => {
    const fixture = await makePipeline(bridge);
    const completion = onceEvent(fixture.events, "compliance_completed");
    // Text-branch ingest of the known-violating fixture (17px off-scale
    // text inside main__banner-info_0; see fixtures/README.md).
    const outcome = expectPipelineOk(
      await fixture.pipeline.ingest({
        workspaceId: fixture.workspace.id,
        artifactId: "violating",
        source: {
          kind: "text",
          svgText: fixtureText(VIOLATING_SVG),
          specYaml: fixtureText(ASSEMBLED_SPEC),
        },
        provenance: {
          brief: "assembled dashboard header with banner and badge",
          tool: "wf_assemble_from_blueprint",
          parameters: { system: "swiss" },
        },
      }),
    );
    // Reported state: the version landed and is head despite failures.
    expect(outcome.version).toBe(1);
    expect(outcome.headVersion).toBe(1);

    const payload = await completion;
    expect(payload.status).toBe("completed");
    expect(payload.failed ?? 0).toBeGreaterThan(0);

    const state = expectPipelineOk(
      await fixture.pipeline.getCompliance(fixture.workspace.id, "violating", 1),
    );
    if (state.status !== "completed") {
      throw new Error(`expected completed, got ${state.status}`);
    }
    const typeScale = state.report.results.find(
      (rule) => rule.rule_id === "swiss-fixed-type-scale",
    );
    expect(typeScale?.status).toBe("fail");
    expect(typeScale?.detail["violations"]).toContain(17);

    const mapping = state.violations.find(
      (violation) => violation.ruleId === "swiss-fixed-type-scale",
    );
    expect(mapping).toBeDefined();
    expect(mapping?.matchedBy).toBe("attribute-value");
    expect(mapping?.nodeIds).toEqual(["main__banner-info_0"]);
  });

  it("runs compliance for restored versions like any landing", async () => {
    const fixture = await makePipeline(bridge);
    expectPipelineOk(
      await fixture.pipeline.ingest({
        workspaceId: fixture.workspace.id,
        artifactId: "dashboard",
        source: PATHS_SOURCE,
        provenance: PROVENANCE,
      }),
    );
    // Collect events for version 2 specifically — version 1's compliance
    // may complete at any point around the restore.
    const versionTwoDone = new Promise<ArtifactComplianceCompletedPayload>(
      (resolve) => {
        fixture.events.on("compliance_completed", (payload) => {
          if (payload.version === 2) {
            resolve(payload);
          }
        });
      },
    );
    const restored = expectPipelineOk(
      await fixture.pipeline.restore(fixture.workspace.id, "dashboard", 1),
    );
    expect(restored.version).toBe(2);
    const payload = await versionTwoDone;
    expect(payload.status).toBe("completed");
  }, 30_000);

  it("recovers an unavailable version via the re-run path", async () => {
    // Own bridge lifecycle: never started → genuine bridge_down.
    const ownBridge = createMcpBridge(realBridgeConfig(), captureLogger().logger);
    const fixture = await makePipeline(ownBridge);
    const unavailable = onceEvent(fixture.events, "compliance_completed");
    expectPipelineOk(
      await fixture.pipeline.ingest({
        workspaceId: fixture.workspace.id,
        artifactId: "dashboard",
        source: PATHS_SOURCE,
        provenance: PROVENANCE,
      }),
    );
    expect((await unavailable).status).toBe("unavailable");
    const before = expectPipelineOk(
      await fixture.pipeline.getCompliance(fixture.workspace.id, "dashboard", 1),
    );
    expect(before.status).toBe("unavailable");

    // Bridge recovers; the explicit re-run transitions to completed.
    await ownBridge.start();
    try {
      const rerun = expectPipelineOk(
        await fixture.pipeline.runCompliance(
          fixture.workspace.id,
          "dashboard",
          1,
        ),
      );
      expect(rerun.status).toBe("completed");
      const after = expectPipelineOk(
        await fixture.pipeline.getCompliance(
          fixture.workspace.id,
          "dashboard",
          1,
        ),
      );
      expect(after.status).toBe("completed");
    } finally {
      await ownBridge.stop();
    }
  }, 40_000);

  it("reads pending for a version whose compliance.yaml is absent", async () => {
    const fixture = await makePipeline(bridge);
    const outcome = expectPipelineOk(
      await fixture.pipeline.ingest({
        workspaceId: fixture.workspace.id,
        artifactId: "dashboard",
        source: PATHS_SOURCE,
        provenance: PROVENANCE,
      }),
    );
    // Read immediately — compliance may not have attached yet; both the
    // pending and completed answers are valid, VERSION_NOT_FOUND is not.
    const state = expectPipelineOk(
      await fixture.pipeline.getCompliance(
        fixture.workspace.id,
        "dashboard",
        outcome.version,
      ),
    );
    expect(["pending", "completed", "unavailable"]).toContain(state.status);

    const missing = await fixture.pipeline.getCompliance(
      fixture.workspace.id,
      "dashboard",
      99,
    );
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.error.code).toBe("VERSION_NOT_FOUND");
    }
  });
});

describe("canonical mapping (unit)", () => {
  it("projects a ruleset-less raw result as completed with the note", () => {
    const raw: RawComplianceResult = {
      system_id: "future-system",
      artifact_path: "/tmp/wireframe.svg",
      scope: "all",
      passed: 0,
      failed: 0,
      advisory: 0,
      results: [],
      ruleset: null,
      mechanical_only: true,
      note: "No mechanical ruleset implemented for 'future-system' yet.",
    };
    const report = toComplianceReport(raw, captureLogger().logger);
    expect(report.ruleset).toBeNull();
    expect(report.note).toContain("No mechanical ruleset");
    expect(report.passed + report.failed + report.advisory).toBe(0);
  });

  it("coerces unknown rule statuses to advisory", () => {
    const raw: RawComplianceResult = {
      system_id: "swiss",
      artifact_path: "/tmp/wireframe.svg",
      scope: "artifact",
      passed: 1,
      failed: 0,
      advisory: 0,
      results: [{ rule_id: "future-rule", status: "warning", detail: {} }],
      ruleset: "swiss",
      mechanical_only: true,
    };
    const report = toComplianceReport(raw, captureLogger().logger);
    expect(report.results[0]?.status).toBe("advisory");
  });

  it("classifies bridge failures into recorded unavailable reasons", () => {
    expect(
      unavailableReason({ kind: "bridge_down", message: "MCP bridge is stopped" }),
    ).toContain("bridge_unavailable");
    expect(
      unavailableReason({
        kind: "tool",
        code: "SYSTEM_NOT_FOUND",
        message: "no such system",
      }),
    ).toBe("SYSTEM_NOT_FOUND: no such system");
  });
});
