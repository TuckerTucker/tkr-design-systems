/**
 * Inspect model against the REAL assembled fixture — the node map built
 * from the actual wireframe.spec.yaml must key exactly the stable
 * {region}__{component}_{idx} group ids present in the actual SVG, target
 * resolution must prefer the innermost mapped ancestor, and keyboard
 * cycling must wrap in both directions.
 */
import { describe, expect, it } from "vitest";

import {
  buildInspectTargets,
  nextInCycle,
  resolveTarget,
  unmappedTarget,
} from "../../src/canvas/inspect.js";
import { parseArtifactSvg } from "../../src/canvas/svgContent.js";
import {
  ASSEMBLED_NODE_IDS,
  ASSEMBLED_SVG_TEXT,
  assembledSpec,
} from "./helpers/fixtures.js";

describe("buildInspectTargets from the real spec metadata", () => {
  it("keys targets by the assembler's stable group ids", () => {
    const targets = buildInspectTargets(assembledSpec());
    expect([...targets.keys()]).toEqual([...ASSEMBLED_NODE_IDS]);
  });

  it("resolves component identity, variant, and placement from components_used", () => {
    const targets = buildInspectTargets(assembledSpec());
    const banner = targets.get("main__banner-info_0");
    expect(banner).toBeDefined();
    expect(banner?.componentId).toBe("banner-info");
    expect(banner?.componentName).toBe("banner");
    expect(banner?.variant).toBe("info");
    expect(banner?.region).toBe("main");
    expect(banner?.componentType).toBe("library");
    expect(banner?.position).toEqual({ x: 40, y: 40 });
  });

  it("counts indexes per region (main gets _0 and _1)", () => {
    const targets = buildInspectTargets(assembledSpec());
    expect(targets.has("main__badge-tag_1")).toBe(true);
    expect(targets.get("main__badge-tag_1")?.componentId).toBe("badge-tag");
  });
});

describe("resolveTarget over the real SVG DOM", () => {
  function realStage(): { root: Element } {
    const parsed = parseArtifactSvg(ASSEMBLED_SVG_TEXT);
    if (!parsed.ok) {
      throw new Error("fixture failed to parse");
    }
    const root = document.importNode(parsed.element, true);
    document.body.appendChild(root);
    return { root };
  }

  it("resolves a text node inside a mapped group to that group's target", () => {
    const { root } = realStage();
    const targets = buildInspectTargets(assembledSpec());
    const text = root.querySelector('[id="main__banner-info_0"] text');
    expect(text).not.toBeNull();
    const resolved = resolveTarget(text, root, targets);
    expect(resolved?.nodeId).toBe("main__banner-info_0");
    expect(resolved?.componentId).toBe("banner-info");
    root.remove();
  });

  it("falls back to the unmapped target for an id with no metadata", () => {
    const { root } = realStage();
    const group = root.querySelector('[id="header__breadcrumb-default_0"]');
    expect(group).not.toBeNull();
    const resolved = resolveTarget(group, root, new Map());
    expect(resolved).toEqual(unmappedTarget("header__breadcrumb-default_0"));
    root.remove();
  });

  it("returns null when no ancestor carries an id", () => {
    const { root } = realStage();
    const defs = root.querySelector("defs style");
    const resolved = resolveTarget(defs, root, buildInspectTargets(assembledSpec()));
    expect(resolved).toBeNull();
    root.remove();
  });
});

describe("keyboard cycling", () => {
  it("cycles forward and backward with wraparound", () => {
    const targets = buildInspectTargets(assembledSpec());
    const first = nextInCycle(targets, null, 1);
    expect(first).toBe("header__breadcrumb-default_0");
    expect(nextInCycle(targets, first, 1)).toBe("main__banner-info_0");
    expect(nextInCycle(targets, "main__badge-tag_1", 1)).toBe(
      "header__breadcrumb-default_0",
    );
    expect(nextInCycle(targets, null, -1)).toBe("main__badge-tag_1");
    expect(nextInCycle(new Map(), null, 1)).toBeNull();
  });
});
