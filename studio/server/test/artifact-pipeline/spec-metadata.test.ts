/**
 * wireframe.spec.yaml parsing — verified against the REAL documents the
 * wireframe skill emitted into the fixture set (see fixtures/README.md),
 * the neutral-library shape from emit.py, and synthesized text-branch
 * metadata.
 */
import { describe, expect, it } from "vitest";
import { stringify as toYaml } from "yaml";

import {
  parseSpecMetadata,
  synthesizeSpecDocument,
} from "../../src/artifact-pipeline/index.js";
import {
  ASSEMBLED_SPEC,
  ASSEMBLED_SVG,
  fixtureText,
  SWISS_DASHBOARD_SPEC,
} from "./pipeline-helpers.js";

describe("parseSpecMetadata", () => {
  it("parses the real swiss generation spec (system blocks populated)", () => {
    const result = parseSpecMetadata(fixtureText(SWISS_DASHBOARD_SPEC));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const metadata = result.value;
    expect(metadata.wireframe.brief).toBe(
      "analytics dashboard with stats and activity feed",
    );
    expect(metadata.wireframe.platform).toBe("desktop");
    expect(metadata.wireframe.dimensions).toEqual({ width: 1280, height: 800 });
    expect(metadata.wireframe.generator_version).toBe("3.0-deterministic");
    expect(metadata.wireframe.svg).toBe("wireframe.svg");
    expect(metadata.design_system.id).toBe("swiss");
    expect(metadata.design_system.layout_template_used).toBe("dashboard");
    expect(metadata.design_system.base_pattern).toBe("dashboard");
    const summary = metadata.design_system.rulebook_compliance;
    expect(summary).toBeDefined();
    expect(summary?.checked).toBe(
      (summary?.mechanical_passed ?? 0) +
        (summary?.mechanical_failed ?? 0) +
        (summary?.advisory_warnings ?? 0),
    );
    expect(summary?.ruleset).toBe("swiss");
  });

  it("parses the real assembled spec including components_used entries", () => {
    const result = parseSpecMetadata(fixtureText(ASSEMBLED_SPEC));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const components = result.value.design_system.components_used;
    expect(components).toHaveLength(3);
    expect(components[0]).toMatchObject({
      id: "breadcrumb-default",
      region: "header",
      type: "library",
    });
    expect(components.map((entry) => entry.region)).toEqual([
      "header",
      "main",
      "main",
    ]);
  });

  it("parses the neutral-library shape (id null + note) without error", () => {
    const neutral = {
      wireframe: {
        brief: "sign-in form",
        platform: "mobile",
        dimensions: { width: 375, height: 812 },
        generated_at: "2026-06-10T00:00:00+00:00",
        generator_version: "3.0-deterministic",
        svg: "wireframe.svg",
      },
      design_system: {
        id: null,
        note: "Generated against the built-in neutral templates; no system applied.",
      },
    };
    const result = parseSpecMetadata(toYaml(neutral));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.design_system.id).toBeNull();
    expect(result.value.design_system.note).toContain("neutral templates");
    expect(result.value.design_system.components_used).toEqual([]);
  });

  it("preserves unknown top-level keys (forward compatibility)", () => {
    const doc = `${fixtureText(ASSEMBLED_SPEC)}\nfuture_block:\n  key: value\n`;
    const result = parseSpecMetadata(doc);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.extra).toEqual({ future_block: { key: "value" } });
  });

  it("rejects unparseable YAML with a typed SPEC_INVALID error", () => {
    const result = parseSpecMetadata("wireframe: [unclosed");
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("SPEC_INVALID");
    expect(result.error.message).toContain("not parseable YAML");
  });

  it("names the missing field for a structurally invalid spec", () => {
    const result = parseSpecMetadata(
      toYaml({ wireframe: { brief: "x", platform: "tablet" } }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("SPEC_INVALID");
    expect(result.error.detail).toBeDefined();
  });

  it("names the malformed components_used entry", () => {
    const doc = {
      wireframe: {
        brief: "x",
        platform: "desktop",
        dimensions: { width: 1280, height: 800 },
        generated_at: "2026-06-10T00:00:00+00:00",
        generator_version: "3.0-deterministic",
        svg: "wireframe.svg",
      },
      design_system: {
        id: "swiss",
        components_used: [{ id: "banner-info" }],
      },
    };
    const result = parseSpecMetadata(toYaml(doc));
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.message).toContain("components_used[0]");
  });
});

describe("synthesizeSpecDocument", () => {
  it("round-trips through parseSpecMetadata with dimensions from the SVG", () => {
    const doc = synthesizeSpecDocument({
      brief: "assembled from blueprint",
      svgText: fixtureText(ASSEMBLED_SVG),
      parameters: { system: "swiss", platform: "desktop" },
    });
    const result = parseSpecMetadata(doc);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.wireframe.brief).toBe("assembled from blueprint");
    expect(result.value.wireframe.dimensions).toEqual({
      width: 1280,
      height: 800,
    });
    expect(result.value.design_system.id).toBe("swiss");
    expect(result.value.wireframe.generator_version).toBe(
      "studio-synthesized",
    );
  });

  it("defaults to a neutral system and desktop platform", () => {
    const doc = synthesizeSpecDocument({
      brief: "b",
      svgText: '<svg viewBox="0 0 375 812"></svg>',
      parameters: {},
    });
    const result = parseSpecMetadata(doc);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.design_system.id).toBeNull();
    expect(result.value.wireframe.platform).toBe("desktop");
    expect(result.value.wireframe.dimensions).toEqual({
      width: 375,
      height: 812,
    });
  });
});
