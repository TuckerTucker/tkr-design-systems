/**
 * Artifact serving and restore over real HTTP — metadata with lineage,
 * sanitized SVG as image/svg+xml, spec.yaml as JSON, the ComplianceResponse
 * projection (real ds_check_compliance through the real bridge), and the
 * restore round-trip with artifact.version_created observed on WS.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type {
  ArtifactDetail,
  ArtifactSummary,
  ComplianceResponse,
  ErrorResponse,
  RestoreResponse,
  WorkspaceSummary,
} from "@studio/contract";

import {
  SWISS_DASHBOARD_SPEC,
  SWISS_DASHBOARD_SVG,
  fixtureText,
} from "../artifact-pipeline/pipeline-helpers.js";
import {
  attachWorkspace,
  awaitCompliance,
  connectWs,
  expectStoreOk,
  http,
  startApiServer,
  type ApiServerFixture,
  type TestWsClient,
} from "./api-helpers.js";

let fixture: ApiServerFixture;
let wsId: string;
let artId: string;
const clients: TestWsClient[] = [];

beforeAll(async () => {
  fixture = await startApiServer({ startBridge: true });
  const created = await http(fixture.base, "POST", "/api/workspaces", {
    name: "Artifact Test",
  });
  wsId = (created.body as WorkspaceSummary).id;

  // Seed two versions through the REAL pipeline (paths branch + compliance).
  const first = await fixture.pipeline.ingest({
    workspaceId: wsId,
    source: {
      kind: "paths",
      svgPath: SWISS_DASHBOARD_SVG,
      specPath: SWISS_DASHBOARD_SPEC,
    },
    provenance: {
      brief: "a dashboard for a meditation app",
      tool: "wf_generate",
      parameters: { system: "swiss", platform: "desktop", layout_id: "dashboard" },
    },
  });
  if (!first.ok) {
    throw new Error(`seed ingest failed: ${first.error.code} ${first.error.message}`);
  }
  artId = first.value.artifactId;

  const second = await fixture.pipeline.ingest({
    workspaceId: wsId,
    artifactId: artId,
    source: { kind: "text", svgText: fixtureText(SWISS_DASHBOARD_SVG) },
    provenance: {
      brief: "tweak the dashboard",
      tool: "wf_apply_substitutions",
      parameters: { substitutions: [{ find: "a", replace: "b" }] },
    },
  });
  if (!second.ok) {
    throw new Error(`second ingest failed: ${second.error.code}`);
  }

  // Compliance is fire-and-forget after a landing; settle both versions
  // before the suite asserts on compliance state.
  await awaitCompliance(fixture, wsId, artId, 1);
  await awaitCompliance(fixture, wsId, artId, 2);
}, 120_000);

afterAll(async () => {
  for (const client of clients.splice(0)) {
    client.terminate();
  }
  await fixture.close();
});

describe("artifact metadata", () => {
  it("lists artifact summaries for the workspace", async () => {
    const listed = await http(fixture.base, "GET", `/api/workspaces/${wsId}/artifacts`);
    expect(listed.status).toBe(200);
    const summaries = listed.body as ArtifactSummary[];
    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.id).toBe(artId);
    expect(summaries[0]?.system).toBe("swiss");
    expect(summaries[0]?.headVersion).toBe(2);
  });

  it("serves artifact detail with the full version lineage and compliance counts", async () => {
    const detail = await http(
      fixture.base,
      "GET",
      `/api/workspaces/${wsId}/artifacts/${artId}`,
    );
    expect(detail.status).toBe(200);
    const artifact = detail.body as ArtifactDetail;
    expect(artifact.versions).toHaveLength(2);
    expect(artifact.versions[0]?.number).toBe(1);
    expect(artifact.versions[0]?.parent).toBeNull();
    expect(artifact.versions[1]?.number).toBe(2);
    expect(artifact.versions[1]?.parent).toBe(1);
    expect(artifact.versions[0]?.compliance.status).toBe("completed");
    expect(artifact.versions[0]?.tool).toBe("wf_generate");
  });

  it("returns 404 with a discovery fix for an unknown artifact", async () => {
    const missing = await http(
      fixture.base,
      "GET",
      `/api/workspaces/${wsId}/artifacts/no-such-artifact`,
    );
    expect(missing.status).toBe(404);
    const error = (missing.body as ErrorResponse).error;
    expect(error.code).toBe("artifact_not_found");
    expect(error.fix).toContain("artifacts");
  });
});

describe("version content", () => {
  it("serves the sanitized SVG as image/svg+xml with node IDs preserved", async () => {
    const svg = await http(
      fixture.base,
      "GET",
      `/api/workspaces/${wsId}/artifacts/${artId}/versions/1/svg`,
    );
    expect(svg.status).toBe(200);
    expect(svg.contentType).toContain("image/svg+xml");
    const text = svg.body as string;
    expect(text).toContain("<svg");
    // Stable node IDs survive sanitization (the fixture carries id attrs).
    const fixtureIds = fixtureText(SWISS_DASHBOARD_SVG).match(/ id="[^"]+"/g) ?? [];
    if (fixtureIds.length > 0) {
      expect(text).toContain(fixtureIds[0] as string);
    }
  });

  it("serves wireframe.spec.yaml parsed to JSON", async () => {
    const spec = await http(
      fixture.base,
      "GET",
      `/api/workspaces/${wsId}/artifacts/${artId}/versions/1/spec`,
    );
    expect(spec.status).toBe(200);
    expect(spec.contentType).toContain("application/json");
    const doc = spec.body as { wireframe?: { brief?: string } };
    expect(doc.wireframe).toBeDefined();
  });

  it("serves the ComplianceResponse projection with per-rule results and nodeIds", async () => {
    const compliance = await http(
      fixture.base,
      "GET",
      `/api/workspaces/${wsId}/artifacts/${artId}/versions/1/compliance`,
    );
    expect(compliance.status).toBe(200);
    const body = compliance.body as ComplianceResponse;
    expect(["pass", "warn", "fail"]).toContain(body.status);
    expect(body.rules.length).toBeGreaterThan(0);
    for (const rule of body.rules) {
      expect(typeof rule.ruleId).toBe("string");
      expect(["pass", "warn", "fail"]).toContain(rule.status);
      expect(Array.isArray(rule.nodeIds)).toBe(true);
    }
    expect(body.passed + body.failed + body.advisory).toBe(body.rules.length);
  });

  it("answers compliance_pending for a version whose compliance has not run", async () => {
    // Land a version directly through the store (no pipeline → no
    // compliance.yaml): the genuine late-attach state.
    const meta = expectStoreOk(
      await fixture.store.artifacts.create(wsId, {
        name: "Pending Artifact",
        system: "swiss",
        platform: "desktop",
      }),
    );
    expectStoreOk(
      await fixture.store.artifacts.createVersion(wsId, meta.id, {
        svg: fixtureText(SWISS_DASHBOARD_SVG),
        spec: fixtureText(SWISS_DASHBOARD_SPEC),
        provenance: {
          parentVersion: null,
          brief: "pending",
          tool: "wf_generate",
          parameters: {},
        },
      }),
    );
    expectStoreOk(await fixture.store.artifacts.setHead(wsId, meta.id, 1));

    const pending = await http(
      fixture.base,
      "GET",
      `/api/workspaces/${wsId}/artifacts/${meta.id}/versions/1/compliance`,
    );
    expect(pending.status).toBe(404);
    const error = (pending.body as ErrorResponse).error;
    expect(error.code).toBe("compliance_pending");
    expect(error.fix).toContain("artifact.compliance_completed");
  });

  it("returns 404 version_not_found for a version that does not exist", async () => {
    const missing = await http(
      fixture.base,
      "GET",
      `/api/workspaces/${wsId}/artifacts/${artId}/versions/99/svg`,
    );
    expect(missing.status).toBe(404);
    expect((missing.body as ErrorResponse).error.code).toBe("version_not_found");
  });
});

describe("restore", () => {
  it("restores version 1 as a new head, returns its VersionSummary, and emits artifact.version_created on WS", async () => {
    const client = await connectWs(fixture.wsUrl);
    clients.push(client);
    await attachWorkspace(client, wsId);

    const restored = await http(
      fixture.base,
      "POST",
      `/api/workspaces/${wsId}/artifacts/${artId}/versions/1/restore`,
    );
    expect(restored.status).toBe(200);
    const summary = restored.body as RestoreResponse;
    expect(summary.number).toBe(3);
    expect(summary.tool).toBe("restore");
    expect(summary.parent).toBe(2);
    expect(summary.brief).toContain("Restore of version 1");

    // The WS event flows through the normal pipeline path.
    const event = await client.waitFor(
      (candidate) =>
        candidate.type === "artifact.version_created" &&
        candidate.payload.version.number === 3,
      "the restore's artifact.version_created",
      30_000,
    );
    expect(
      event.type === "artifact.version_created" && event.payload.artifactId,
    ).toBe(artId);

    // The new head is byte-identical to version 1 and the lineage holds.
    const detail = await http(
      fixture.base,
      "GET",
      `/api/workspaces/${wsId}/artifacts/${artId}`,
    );
    const artifact = detail.body as ArtifactDetail;
    expect(artifact.headVersion).toBe(3);
    const v1 = await http(
      fixture.base,
      "GET",
      `/api/workspaces/${wsId}/artifacts/${artId}/versions/1/svg`,
    );
    const v3 = await http(
      fixture.base,
      "GET",
      `/api/workspaces/${wsId}/artifacts/${artId}/versions/3/svg`,
    );
    expect(v3.body).toEqual(v1.body);
  }, 60_000);

  it("answers 404 for restoring a version that does not exist", async () => {
    const missing = await http(
      fixture.base,
      "POST",
      `/api/workspaces/${wsId}/artifacts/${artId}/versions/99/restore`,
    );
    expect(missing.status).toBe(404);
    expect((missing.body as ErrorResponse).error.code).toBe("version_not_found");
  });
});
