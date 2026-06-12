/**
 * Canvas API fetchers — typed results over an injected fetch: SVG text
 * pass-through, spec boundary validation against the REAL fixture spec,
 * the compliance state vocabulary (pending/unavailable are states, not
 * failures), restore response validation, and network failures as typed
 * errors with a fix.
 */
import { describe, expect, it } from "vitest";

import { createCanvasApi, parseSpecResponse } from "../../src/canvas/api.js";
import { toComplianceBarModel } from "../../src/canvas/compliance.js";
import {
  ASSEMBLED_SVG_TEXT,
  assembledSpec,
  violatingComplianceResponse,
} from "./helpers/fixtures.js";

function fetchStub(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
): typeof fetch {
  return ((url: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(handler(String(url), init))) as typeof fetch;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("getVersionSvg", () => {
  it("returns the sanitized SVG text verbatim", async () => {
    const api = createCanvasApi({
      fetchImpl: fetchStub((url) => {
        expect(url).toBe("/api/workspaces/ws-1/artifacts/dash/versions/2/svg");
        return new Response(ASSEMBLED_SVG_TEXT, {
          status: 200,
          headers: { "content-type": "image/svg+xml" },
        });
      }),
    });
    const result = await api.getVersionSvg("ws-1", "dash", 2);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(ASSEMBLED_SVG_TEXT);
    }
  });

  it("maps a structured error body to the typed ApiError", async () => {
    const api = createCanvasApi({
      fetchImpl: fetchStub(() =>
        json(
          {
            error: {
              code: "version_not_found",
              message: "Version 9 does not exist.",
              fix: "Pick a version from the artifact lineage.",
            },
          },
          404,
        ),
      ),
    });
    const result = await api.getVersionSvg("ws-1", "dash", 9);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("version_not_found");
      expect(result.error.fix).toContain("lineage");
    }
  });

  it("returns a typed network error with a fix when fetch rejects", async () => {
    const api = createCanvasApi({
      fetchImpl: (() => Promise.reject(new Error("ECONNREFUSED"))) as typeof fetch,
    });
    const result = await api.getVersionSvg("ws-1", "dash", 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("ECONNREFUSED");
      expect(result.error.fix.length).toBeGreaterThan(0);
    }
  });
});

describe("getVersionSpec boundary validation", () => {
  it("accepts the real fixture spec", async () => {
    const api = createCanvasApi({
      fetchImpl: fetchStub(() => json(assembledSpec())),
    });
    const result = await api.getVersionSpec("ws-1", "dash", 1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.wireframe.platform).toBe("desktop");
      expect(result.value.wireframe.dimensions).toEqual({
        width: 1280,
        height: 800,
      });
      expect(result.value.design_system.components_used).toHaveLength(3);
    }
  });

  it("rejects a response that fails the contract shape", async () => {
    expect(parseSpecResponse({ wireframe: { platform: "tablet" } })).toBeNull();
    expect(parseSpecResponse(null)).toBeNull();
    const api = createCanvasApi({
      fetchImpl: fetchStub(() => json({ nonsense: true })),
    });
    const result = await api.getVersionSpec("ws-1", "dash", 1);
    expect(result.ok).toBe(false);
  });
});

describe("getVersionCompliance state vocabulary", () => {
  it("maps compliance_pending to the pending state, not a failure", async () => {
    const api = createCanvasApi({
      fetchImpl: fetchStub(() =>
        json(
          {
            error: {
              code: "compliance_pending",
              message: "Compliance has not completed.",
              fix: "Wait for the run to settle.",
            },
          },
          409,
        ),
      ),
    });
    expect(await api.getVersionCompliance("ws-1", "dash", 1)).toEqual({
      kind: "pending",
    });
  });

  it("maps compliance_unavailable to the unavailable state with the reason", async () => {
    const api = createCanvasApi({
      fetchImpl: fetchStub(() =>
        json(
          {
            error: {
              code: "compliance_unavailable",
              message: "The bridge was down.",
              fix: "Re-run compliance.",
            },
          },
          503,
        ),
      ),
    });
    const result = await api.getVersionCompliance("ws-1", "dash", 1);
    expect(result).toEqual({ kind: "unavailable", reason: "The bridge was down." });
  });

  it("returns the completed projection and maps it into the bar model", async () => {
    const api = createCanvasApi({
      fetchImpl: fetchStub(() => json(violatingComplianceResponse())),
    });
    const result = await api.getVersionCompliance("ws-1", "dash", 2);
    expect(result.kind).toBe("completed");
    if (result.kind !== "completed") {
      return;
    }
    const model = toComplianceBarModel(result.response);
    expect(model.overall).toBe("fail");
    const failing = model.rules.find((rule) => rule.status === "fail");
    expect(failing?.ruleId).toBe("swiss-fixed-type-scale");
    expect(failing?.nodeIds).toEqual(["main__banner-info_0"]);
    // A pass rule without a message gets a readable line, never undefined.
    const pass = model.rules.find((rule) => rule.status === "pass");
    expect(pass?.message).toBe("This rule passed.");
  });
});

describe("restoreVersion", () => {
  it("POSTs to the restore route and returns the new head's VersionSummary", async () => {
    const api = createCanvasApi({
      fetchImpl: fetchStub((url, init) => {
        expect(init?.method).toBe("POST");
        expect(url).toBe(
          "/api/workspaces/ws-1/artifacts/dash/versions/2/restore",
        );
        return json({
          number: 5,
          parent: 4,
          tool: "restore",
          brief: "restore of v2",
          created: "2026-06-10T12:00:00.000Z",
          compliance: { status: "pending" },
        });
      }),
    });
    const result = await api.restoreVersion("ws-1", "dash", 2);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.number).toBe(5);
      expect(result.value.tool).toBe("restore");
    }
  });

  it("rejects a malformed restore body", async () => {
    const api = createCanvasApi({
      fetchImpl: fetchStub(() => json({ nope: true })),
    });
    const result = await api.restoreVersion("ws-1", "dash", 2);
    expect(result.ok).toBe(false);
  });
});
