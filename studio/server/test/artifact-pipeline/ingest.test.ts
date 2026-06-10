/**
 * Ingestion + version-graph tests against a REAL temp workspace store
 * (testing policy: no filesystem mocks). The bridge here is a real
 * McpBridge instance that has never been started, so compliance lands as
 * the genuine "unavailable" state without gating any landing — the real
 * compliance runs live in compliance.test.ts.
 */
import { readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

import type { ArtifactSource } from "@studio/contract";

import {
  ASSEMBLED_SPEC,
  ASSEMBLED_SVG,
  expectPipelineFail,
  expectPipelineOk,
  fixtureText,
  makePipeline,
  onceEvent,
  stoppedBridge,
  SWISS_DASHBOARD_SPEC,
  SWISS_DASHBOARD_SVG,
  type PipelineFixture,
} from "./pipeline-helpers.js";

const PATHS_SOURCE: ArtifactSource = {
  kind: "paths",
  svgPath: SWISS_DASHBOARD_SVG,
  specPath: SWISS_DASHBOARD_SPEC,
};

function provenance(
  tool: "wf_generate" | "wf_apply_substitutions" | "wf_assemble_from_blueprint" = "wf_generate",
) {
  return {
    brief: "analytics dashboard with stats and activity feed",
    tool,
    parameters: { system: "swiss", platform: "desktop", layout_id: "dashboard" },
  };
}

function versionDirOf(fixture: PipelineFixture, artifactId: string): string {
  return path.join(
    fixture.store.rootDir,
    fixture.workspace.id,
    "artifacts",
    artifactId,
    "versions",
  );
}

describe("ingestion (slice 1)", () => {
  it("lands a paths-branch wf_generate result as versions/0001 with provenance", async () => {
    const fixture = await makePipeline(stoppedBridge());
    const created = onceEvent(fixture.events, "version_created");

    const outcome = expectPipelineOk(
      await fixture.pipeline.ingest({
        workspaceId: fixture.workspace.id,
        artifactId: "dashboard",
        source: PATHS_SOURCE,
        provenance: provenance(),
      }),
    );

    expect(outcome.version).toBe(1);
    expect(outcome.headVersion).toBe(1);
    expect(outcome.artifactId).toBe("dashboard");
    expect(outcome.provenance.parent).toBeNull();
    expect(outcome.provenance.tool).toBe("wf_generate");
    expect(outcome.provenance.parameters).toEqual(provenance().parameters);
    expect(outcome.provenance.created).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(outcome.metadata.status).toBe("available");

    // artifact.yaml created on first ingest, head pointed at 1.
    const meta = await fixture.store.store.artifacts.get(
      fixture.workspace.id,
      "dashboard",
    );
    expect(meta.ok && meta.value.headVersion).toBe(1);
    expect(meta.ok && meta.value.system).toBe("swiss");
    expect(meta.ok && meta.value.platform).toBe("desktop");

    // Version directory holds the three landing files, content verbatim.
    const entries = readdirSync(
      path.join(versionDirOf(fixture, "dashboard"), "0001"),
    ).sort();
    expect(entries).toContain("wireframe.svg");
    expect(entries).toContain("wireframe.spec.yaml");
    expect(entries).toContain("version.yaml");
    const svg = await fixture.store.store.artifacts.readSvg(
      fixture.workspace.id,
      "dashboard",
      1,
    );
    expect(svg.ok && svg.value).toBe(fixtureText(SWISS_DASHBOARD_SVG));

    // version.yaml provenance shape.
    const versionYaml = parseYaml(
      fixtureText(
        path.join(versionDirOf(fixture, "dashboard"), "0001", "version.yaml"),
      ),
    ) as Record<string, unknown>;
    expect(versionYaml["parentVersion"]).toBeNull();
    expect(versionYaml["tool"]).toBe("wf_generate");
    expect(versionYaml["brief"]).toBe(provenance().brief);

    // Exactly one version_created with the correct identifiers.
    const payload = await created;
    expect(payload).toMatchObject({
      workspaceId: fixture.workspace.id,
      artifactId: "dashboard",
      version: 1,
      headVersion: 1,
    });
  });

  it("lands a text-branch assembly result through the same path", async () => {
    const fixture = await makePipeline(stoppedBridge());
    const source: ArtifactSource = {
      kind: "text",
      svgText: fixtureText(ASSEMBLED_SVG),
      specYaml: fixtureText(ASSEMBLED_SPEC),
    };
    const outcome = expectPipelineOk(
      await fixture.pipeline.ingest({
        workspaceId: fixture.workspace.id,
        artifactId: "assembled",
        source,
        provenance: provenance("wf_assemble_from_blueprint"),
      }),
    );
    expect(outcome.version).toBe(1);
    expect(outcome.metadata.status).toBe("available");

    const svg = await fixture.store.store.artifacts.readSvg(
      fixture.workspace.id,
      "assembled",
      1,
    );
    expect(svg.ok && svg.value).toBe(fixtureText(ASSEMBLED_SVG));
    const spec = await fixture.store.store.artifacts.readSpec(
      fixture.workspace.id,
      "assembled",
      1,
    );
    expect(spec.ok).toBe(true);
  });

  it("synthesizes minimal metadata for a text-branch result without specYaml", async () => {
    const fixture = await makePipeline(stoppedBridge());
    const outcome = expectPipelineOk(
      await fixture.pipeline.ingest({
        workspaceId: fixture.workspace.id,
        artifactId: "assembled",
        source: { kind: "text", svgText: fixtureText(ASSEMBLED_SVG) },
        provenance: {
          brief: "assembled from blueprint",
          tool: "wf_assemble_from_blueprint",
          parameters: { system: "swiss", platform: "desktop" },
        },
      }),
    );
    expect(outcome.metadata.status).toBe("available");
    if (outcome.metadata.status === "available") {
      expect(outcome.metadata.metadata.wireframe.brief).toBe(
        "assembled from blueprint",
      );
      expect(outcome.metadata.metadata.design_system.id).toBe("swiss");
      expect(outcome.metadata.metadata.wireframe.dimensions).toEqual({
        width: 1280,
        height: 800,
      });
    }
  });

  it("moves headVersion null→1→2 and leaves 0001 byte-identical", async () => {
    const fixture = await makePipeline(stoppedBridge());
    expectPipelineOk(
      await fixture.pipeline.ingest({
        workspaceId: fixture.workspace.id,
        artifactId: "dashboard",
        source: PATHS_SOURCE,
        provenance: provenance(),
      }),
    );
    const firstSvg = fixtureText(
      path.join(versionDirOf(fixture, "dashboard"), "0001", "wireframe.svg"),
    );
    const firstVersionYaml = fixtureText(
      path.join(versionDirOf(fixture, "dashboard"), "0001", "version.yaml"),
    );

    const second = expectPipelineOk(
      await fixture.pipeline.ingest({
        workspaceId: fixture.workspace.id,
        artifactId: "dashboard",
        source: PATHS_SOURCE,
        provenance: provenance("wf_apply_substitutions"),
      }),
    );
    expect(second.version).toBe(2);
    expect(second.headVersion).toBe(2);
    expect(second.provenance.parent).toBe(1);

    const meta = await fixture.store.store.artifacts.get(
      fixture.workspace.id,
      "dashboard",
    );
    expect(meta.ok && meta.value.headVersion).toBe(2);

    // 0001 untouched byte-for-byte.
    expect(
      fixtureText(
        path.join(versionDirOf(fixture, "dashboard"), "0001", "wireframe.svg"),
      ),
    ).toBe(firstSvg);
    expect(
      fixtureText(
        path.join(versionDirOf(fixture, "dashboard"), "0001", "version.yaml"),
      ),
    ).toBe(firstVersionYaml);
  });

  it("rejects a missing svgPath with INGEST_OUTPUT_MISSING and lands nothing", async () => {
    const fixture = await makePipeline(stoppedBridge());
    const result = await fixture.pipeline.ingest({
      workspaceId: fixture.workspace.id,
      artifactId: "dashboard",
      source: {
        kind: "paths",
        svgPath: "/nonexistent/wireframe.svg",
        specPath: SWISS_DASHBOARD_SPEC,
      },
      provenance: provenance(),
    });
    expectPipelineFail(result, "INGEST_OUTPUT_MISSING");
    const artifacts = await fixture.store.store.artifacts.list(
      fixture.workspace.id,
    );
    expect(artifacts.ok && artifacts.value).toEqual([]);
  });

  it("rejects empty svgText with INGEST_OUTPUT_MISSING", async () => {
    const fixture = await makePipeline(stoppedBridge());
    const result = await fixture.pipeline.ingest({
      workspaceId: fixture.workspace.id,
      artifactId: "assembled",
      source: { kind: "text", svgText: "   " },
      provenance: provenance("wf_assemble_from_blueprint"),
    });
    expectPipelineFail(result, "INGEST_OUTPUT_MISSING");
  });

  it("lands a version with degraded metadata when the spec is corrupt", async () => {
    const fixture = await makePipeline(stoppedBridge());
    const outcome = expectPipelineOk(
      await fixture.pipeline.ingest({
        workspaceId: fixture.workspace.id,
        artifactId: "broken-spec",
        source: {
          kind: "text",
          svgText: fixtureText(ASSEMBLED_SVG),
          specYaml: "wireframe: [unclosed",
        },
        provenance: provenance("wf_assemble_from_blueprint"),
      }),
    );
    expect(outcome.version).toBe(1);
    expect(outcome.metadata.status).toBe("unavailable");

    // The SVG still serves; metadata reads as the degraded state.
    const svg = await fixture.pipeline.getSanitizedSvg(
      fixture.workspace.id,
      "broken-spec",
      1,
    );
    expect(svg.ok).toBe(true);
    const metadata = expectPipelineOk(
      await fixture.pipeline.getSpecMetadata(
        fixture.workspace.id,
        "broken-spec",
        1,
      ),
    );
    expect(metadata.status).toBe("unavailable");
  });

  it("records compliance unavailable when the bridge is down, without blocking landing", async () => {
    const fixture = await makePipeline(stoppedBridge());
    const completion = onceEvent(fixture.events, "compliance_completed");
    expectPipelineOk(
      await fixture.pipeline.ingest({
        workspaceId: fixture.workspace.id,
        artifactId: "dashboard",
        source: PATHS_SOURCE,
        provenance: provenance(),
      }),
    );
    const payload = await completion;
    expect(payload.status).toBe("unavailable");

    const state = expectPipelineOk(
      await fixture.pipeline.getCompliance(fixture.workspace.id, "dashboard", 1),
    );
    expect(state.status).toBe("unavailable");
    if (state.status === "unavailable") {
      expect(state.reason).toContain("bridge_unavailable");
    }
  });
});

describe("version graph and restore (slice 2)", () => {
  async function landThree(fixture: PipelineFixture): Promise<void> {
    for (const tool of [
      "wf_generate",
      "wf_apply_substitutions",
      "wf_apply_substitutions",
    ] as const) {
      expectPipelineOk(
        await fixture.pipeline.ingest({
          workspaceId: fixture.workspace.id,
          artifactId: "dashboard",
          source: PATHS_SOURCE,
          provenance: provenance(tool),
        }),
      );
    }
  }

  it("restore of 1 from head 3 creates 0004 with byte-identical content", async () => {
    const fixture = await makePipeline(stoppedBridge());
    await landThree(fixture);
    const created = onceEvent(fixture.events, "version_created");

    const outcome = expectPipelineOk(
      await fixture.pipeline.restore(fixture.workspace.id, "dashboard", 1),
    );
    expect(outcome.version).toBe(4);
    expect(outcome.headVersion).toBe(4);
    expect(outcome.provenance.tool).toBe("restore");
    expect(outcome.provenance.parameters["restored_from"]).toBe(1);
    expect(outcome.provenance.parent).toBe(3);

    // Content byte-identical to 0001 (SVG and spec).
    const dir = path.join(
      fixture.store.rootDir,
      fixture.workspace.id,
      "artifacts",
      "dashboard",
      "versions",
    );
    expect(fixtureText(path.join(dir, "0004", "wireframe.svg"))).toBe(
      fixtureText(path.join(dir, "0001", "wireframe.svg")),
    );
    expect(fixtureText(path.join(dir, "0004", "wireframe.spec.yaml"))).toBe(
      fixtureText(path.join(dir, "0001", "wireframe.spec.yaml")),
    );

    // No version deleted; head moved to 4; event identical to generation.
    expect(readdirSync(dir).sort()).toEqual(["0001", "0002", "0003", "0004"]);
    const payload = await created;
    expect(payload).toMatchObject({ version: 4, headVersion: 4 });
    expect(payload.provenance.tool).toBe("restore");
  });

  it("VERSION_NOT_FOUND leaves headVersion unchanged", async () => {
    const fixture = await makePipeline(stoppedBridge());
    await landThree(fixture);
    expectPipelineFail(
      await fixture.pipeline.restore(fixture.workspace.id, "dashboard", 99),
      "VERSION_NOT_FOUND",
    );
    const meta = await fixture.store.store.artifacts.get(
      fixture.workspace.id,
      "dashboard",
    );
    expect(meta.ok && meta.value.headVersion).toBe(3);
  });

  it("restore of a restore records the actual lineage", async () => {
    const fixture = await makePipeline(stoppedBridge());
    await landThree(fixture);
    expectPipelineOk(
      await fixture.pipeline.restore(fixture.workspace.id, "dashboard", 1),
    );
    const second = expectPipelineOk(
      await fixture.pipeline.restore(fixture.workspace.id, "dashboard", 3),
    );
    expect(second.version).toBe(5);
    expect(second.provenance.parent).toBe(4);
    expect(second.provenance.parameters["restored_from"]).toBe(3);
  });

  it("lists version summaries in scrubber order with compliance status", async () => {
    const fixture = await makePipeline(stoppedBridge());
    await landThree(fixture);
    const summaries = expectPipelineOk(
      await fixture.pipeline.listVersions(fixture.workspace.id, "dashboard"),
    );
    expect(summaries.map((entry) => entry.number)).toEqual([1, 2, 3]);
    expect(summaries[0]?.parent).toBeNull();
    expect(summaries[1]?.parent).toBe(1);
    expect(summaries[2]?.tool).toBe("wf_apply_substitutions");
    for (const summary of summaries) {
      expect(["pending", "unavailable", "completed"]).toContain(
        summary.compliance.status,
      );
    }
  });

  it("getVersion returns the full domain view", async () => {
    const fixture = await makePipeline(stoppedBridge());
    await landThree(fixture);
    const version = expectPipelineOk(
      await fixture.pipeline.getVersion(fixture.workspace.id, "dashboard", 2),
    );
    expect(version.number).toBe(2);
    expect(version.provenance.parent).toBe(1);
    expect(version.provenance.parameters).toEqual(provenance().parameters);
    expect(version.metadata.status).toBe("available");
  });

  it("two racing ingestions serialize to sequential version numbers", async () => {
    const fixture = await makePipeline(stoppedBridge());
    expectPipelineOk(
      await fixture.pipeline.ingest({
        workspaceId: fixture.workspace.id,
        artifactId: "dashboard",
        source: PATHS_SOURCE,
        provenance: provenance(),
      }),
    );
    const [first, second] = await Promise.all([
      fixture.pipeline.ingest({
        workspaceId: fixture.workspace.id,
        artifactId: "dashboard",
        source: PATHS_SOURCE,
        provenance: provenance("wf_apply_substitutions"),
      }),
      fixture.pipeline.ingest({
        workspaceId: fixture.workspace.id,
        artifactId: "dashboard",
        source: PATHS_SOURCE,
        provenance: provenance("wf_apply_substitutions"),
      }),
    ]);
    const numbers = [
      expectPipelineOk(first).version,
      expectPipelineOk(second).version,
    ].sort((a, b) => a - b);
    expect(numbers).toEqual([2, 3]);
  });
});
