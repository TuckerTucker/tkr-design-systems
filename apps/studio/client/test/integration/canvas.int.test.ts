/**
 * Canvas data seams over a REAL composed studio-server — the typed canvas
 * fetchers against real routes (sanitized SVG with stable node IDs, parsed
 * spec metadata, the real ds_check_compliance projection including the
 * violating fixture's known violation-to-node mapping), the restore
 * round-trip (restore-as-new-head + RestoreResponse + the
 * artifact.version_created event observed live on /ws), and the canvas's
 * boundary validation against real payloads.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  ASSEMBLED_SPEC,
  ASSEMBLED_SVG,
  VIOLATING_SVG,
  fixtureText,
} from "../../../server/test/artifact-pipeline/pipeline-helpers.js";
import {
  attachWorkspace,
  awaitCompliance,
  connectWs,
  http,
  startApiServer,
  type ApiServerFixture,
  type TestWsClient,
} from "../../../server/test/api/api-helpers.js";

import type { VersionCreatedPayload, WorkspaceSummary } from "@studio/contract";

import { createCanvasApi, type CanvasApi } from "../../src/canvas/api.js";

let fixture: ApiServerFixture;
let canvasApi: CanvasApi;
let wsId: string;
let artId: string;
const clients: TestWsClient[] = [];

beforeAll(async () => {
  fixture = await startApiServer({ startBridge: true });
  canvasApi = createCanvasApi({ baseUrl: fixture.base });

  const created = await http(fixture.base, "POST", "/api/workspaces", {
    name: "Canvas Integration",
  });
  expect(created.status).toBe(201);
  wsId = (created.body as WorkspaceSummary).id;

  // v1: the assembled fixture (real wf_assemble_from_blueprint output —
  // stable {region}__{component}_{idx} ids + populated components_used).
  const first = await fixture.pipeline.ingest({
    workspaceId: wsId,
    source: {
      kind: "paths",
      svgPath: ASSEMBLED_SVG,
      specPath: ASSEMBLED_SPEC,
    },
    provenance: {
      brief: "assembled dashboard header with banner and badge",
      tool: "wf_assemble_from_blueprint",
      parameters: { system: "swiss", platform: "desktop" },
    },
  });
  if (!first.ok) {
    throw new Error(`seed ingest failed: ${first.error.code} ${first.error.message}`);
  }
  artId = first.value.artifactId;

  // v2: the violating fixture (assembled + an off-scale font-size 17 in
  // main__banner-info_0 — a deterministic swiss-fixed-type-scale failure).
  const second = await fixture.pipeline.ingest({
    workspaceId: wsId,
    artifactId: artId,
    source: {
      kind: "text",
      svgText: fixtureText(VIOLATING_SVG),
      specYaml: fixtureText(ASSEMBLED_SPEC),
    },
    provenance: {
      brief: "add an off-scale annotation",
      tool: "wf_apply_substitutions",
      parameters: {},
    },
  });
  if (!second.ok) {
    throw new Error(`second ingest failed: ${second.error.code}`);
  }

  await awaitCompliance(fixture, wsId, artId, 1);
  await awaitCompliance(fixture, wsId, artId, 2);
}, 180_000);

afterAll(async () => {
  for (const client of clients.splice(0)) {
    client.terminate();
  }
  await fixture.close();
});

describe("artifact listing and lineage through the canvas fetchers", () => {
  it("lists the artifact summary the canvas selects from", async () => {
    const listed = await canvasApi.listArtifacts(wsId);
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      return;
    }
    expect(listed.value).toHaveLength(1);
    expect(listed.value[0]?.id).toBe(artId);
    expect(listed.value[0]?.platform).toBe("desktop");
    expect(listed.value[0]?.headVersion).toBe(2);
  });

  it("serves the full version lineage for the filmstrip", async () => {
    const detail = await canvasApi.getArtifactDetail(wsId, artId);
    expect(detail.ok).toBe(true);
    if (!detail.ok) {
      return;
    }
    expect(detail.value.versions.map((version) => version.number)).toEqual([1, 2]);
    expect(detail.value.versions[0]?.parent).toBeNull();
    expect(detail.value.versions[1]?.parent).toBe(1);
  });
});

describe("sanitized SVG with stable node IDs", () => {
  it("serves real vector text the canvas renders inline, ids intact", async () => {
    const svg = await canvasApi.getVersionSvg(wsId, artId, 1);
    expect(svg.ok).toBe(true);
    if (!svg.ok) {
      return;
    }
    expect(svg.value).toContain("<svg");
    expect(svg.value).toContain('id="header__breadcrumb-default_0"');
    expect(svg.value).toContain('id="main__banner-info_0"');
    expect(svg.value).toContain('id="main__badge-tag_1"');
    expect(svg.value).not.toContain("<script");
    expect(svg.value).not.toMatch(/\son[a-z]+=/i);
  });
});

describe("spec metadata for the inspect overlay", () => {
  it("passes the canvas's boundary validation with the real components_used", async () => {
    const spec = await canvasApi.getVersionSpec(wsId, artId, 1);
    expect(spec.ok).toBe(true);
    if (!spec.ok) {
      return;
    }
    expect(spec.value.wireframe.platform).toBe("desktop");
    expect(spec.value.wireframe.dimensions).toEqual({ width: 1280, height: 800 });
    expect(
      spec.value.design_system.components_used.map((component) => component.id),
    ).toEqual(["breadcrumb-default", "banner-info", "badge-tag"]);
  });
});

describe("compliance projection with violation-to-node mapping", () => {
  it("serves a completed result for the clean version", async () => {
    const result = await canvasApi.getVersionCompliance(wsId, artId, 1);
    expect(result.kind).toBe("completed");
    if (result.kind !== "completed") {
      return;
    }
    expect(result.response.rules.length).toBeGreaterThan(0);
  });

  it("maps the violating version's type-scale failure to main__banner-info_0", async () => {
    const result = await canvasApi.getVersionCompliance(wsId, artId, 2);
    expect(result.kind).toBe("completed");
    if (result.kind !== "completed") {
      return;
    }
    expect(result.response.status).toBe("fail");
    const failing = result.response.rules.find(
      (rule) => rule.ruleId === "swiss-fixed-type-scale",
    );
    expect(failing?.status).toBe("fail");
    expect(failing?.nodeIds).toContain("main__banner-info_0");
  });
});

describe("restore round-trip with the live event", () => {
  it("restores v1 as a new head, returns the RestoreResponse, and emits artifact.version_created", async () => {
    const client = await connectWs(fixture.wsUrl);
    clients.push(client);
    await attachWorkspace(client, wsId);

    const restored = await canvasApi.restoreVersion(wsId, artId, 1);
    expect(restored.ok).toBe(true);
    if (!restored.ok) {
      return;
    }
    // The new head's VersionSummary — the inline Undo reads this number.
    expect(restored.value.number).toBe(3);
    expect(restored.value.tool).toBe("restore");
    expect(restored.value.parent).toBe(2);

    // The same landing reaches the canvas live, identical to generation
    // (the attach snapshot may replay earlier landings first — the canvas
    // reducer de-duplicates; here we await the v3 event specifically).
    const event = await client.waitFor(
      (candidate) =>
        candidate.type === "artifact.version_created" &&
        (candidate.payload as VersionCreatedPayload).version.number === 3,
      "the version 3 artifact.version_created event",
    );
    const payload = event.payload as VersionCreatedPayload;
    expect(payload.artifactId).toBe(artId);

    // Prior versions remain on disk; the head pointer moved.
    const detail = await canvasApi.getArtifactDetail(wsId, artId);
    expect(detail.ok).toBe(true);
    if (detail.ok) {
      expect(detail.value.headVersion).toBe(3);
      expect(detail.value.versions.map((version) => version.number)).toEqual([
        1, 2, 3,
      ]);
    }

    // The restored head serves v1's content (the off-scale text is gone).
    const svg = await canvasApi.getVersionSvg(wsId, artId, 3);
    expect(svg.ok).toBe(true);
    if (svg.ok) {
      expect(svg.value).not.toContain("Off-scale annotation");
      expect(svg.value).toContain('id="main__banner-info_0"');
    }
  });

  it("serves compliance for the restored head once its run settles", async () => {
    await awaitCompliance(fixture, wsId, artId, 3);
    const result = await canvasApi.getVersionCompliance(wsId, artId, 3);
    expect(result.kind).toBe("completed");
    if (result.kind === "completed") {
      // v3 is v1's clean content — the type-scale failure is gone.
      const typeScale = result.response.rules.find(
        (rule) => rule.ruleId === "swiss-fixed-type-scale",
      );
      expect(typeScale?.status).not.toBe("fail");
    }
  });
});
