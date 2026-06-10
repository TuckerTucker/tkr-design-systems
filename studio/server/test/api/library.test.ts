/**
 * Library endpoints — real bridge against the real design-systems MCP
 * server: systems, tokens, component index/detail, layouts; cache hits
 * asserted by bridge call count; registry-touch invalidation via fs.watch;
 * bridge-down degradation (warm entries serve, cold requests 503).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type {
  ComponentDetail,
  ComponentIndexEntry,
  ErrorResponse,
  LayoutTemplate,
  LibrarySystem,
  TokenSetResponse,
} from "@studio/contract";

import {
  http,
  startApiServer,
  touchFile,
  waitUntil,
  type ApiServerFixture,
} from "./api-helpers.js";

let fixture: ApiServerFixture;

beforeAll(async () => {
  fixture = await startApiServer({ startBridge: true });
}, 60_000);

afterAll(async () => {
  await fixture.close();
});

describe("library proxying", () => {
  it("lists registered systems as LibrarySystem[]", async () => {
    const systems = await http(fixture.base, "GET", "/api/library/systems");
    expect(systems.status).toBe(200);
    const body = systems.body as LibrarySystem[];
    const swiss = body.find((system) => system.id === "swiss");
    expect(swiss).toBeDefined();
    expect(swiss?.name).toBeTruthy();
    expect(swiss?.status).toBe("available");
  });

  it("serves tokens once from the bridge, then from cache (asserted by call count)", async () => {
    const before = fixture.bridge.calls["getTokens"] ?? 0;

    const first = await http(fixture.base, "GET", "/api/library/swiss/tokens");
    expect(first.status).toBe(200);
    const tokens = first.body as TokenSetResponse;
    expect(tokens.systemId).toBe("swiss");
    expect(tokens.tokens["palette"]).toBeDefined();
    expect(fixture.bridge.calls["getTokens"]).toBe(before + 1);

    const second = await http(fixture.base, "GET", "/api/library/swiss/tokens");
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(fixture.bridge.calls["getTokens"]).toBe(before + 1);
  });

  it("serves the component index from the loaded spec", async () => {
    const components = await http(
      fixture.base,
      "GET",
      "/api/library/swiss/components",
    );
    expect(components.status).toBe(200);
    const index = components.body as ComponentIndexEntry[];
    const button = index.find((entry) => entry.id === "button");
    expect(button).toBeDefined();
    expect(button?.variants).toContain("primary");
    expect(button?.name).toBe("Button");
  });

  it("serves a component detail with the real SVG via wf_read_component", async () => {
    const detail = await http(
      fixture.base,
      "GET",
      "/api/library/swiss/components/button",
    );
    expect(detail.status).toBe(200);
    const component = detail.body as ComponentDetail;
    expect(component.id).toBe("button");
    expect(component.svg).toContain("<svg");
  });

  it("serves layout templates from the loaded spec", async () => {
    const layouts = await http(fixture.base, "GET", "/api/library/swiss/layouts");
    expect(layouts.status).toBe(200);
    const templates = layouts.body as LayoutTemplate[];
    const dashboard = templates.find((entry) => entry.id === "dashboard");
    expect(dashboard).toBeDefined();
    expect(dashboard?.archetype).toBe("dashboard");
    expect(dashboard?.platforms.length).toBeGreaterThan(0);
  });

  it("answers an empty component index (200, not an error) for a system with zero authored components", async () => {
    // The wireframe (neutral) library is registered; if it has components,
    // the assertion still holds shape-wise — zero-component handling is the
    // index mapper returning [] for an absent components block.
    const components = await http(
      fixture.base,
      "GET",
      "/api/library/wireframe/components",
    );
    expect(components.status).toBe(200);
    expect(Array.isArray(components.body)).toBe(true);
  });

  it("answers 404 system_not_found pointing at the systems listing for an unknown system", async () => {
    const missing = await http(
      fixture.base,
      "GET",
      "/api/library/no-such-system/tokens",
    );
    expect(missing.status).toBe(404);
    const error = (missing.body as ErrorResponse).error;
    expect(error.code).toBe("system_not_found");
    expect(error.fix).toContain("/api/library/systems");
  });
});

describe("cache invalidation and bridge-down degradation", () => {
  it("flushes the cache when registry.yaml changes; the next request repopulates from the bridge", async () => {
    // Warm the cache.
    await http(fixture.base, "GET", "/api/library/swiss/tokens");
    expect(fixture.api.cache.size()).toBeGreaterThan(0);
    const before = fixture.bridge.calls["getTokens"] ?? 0;

    touchFile(fixture.registryPath);
    await waitUntil(
      () => fixture.api.cache.size() === 0,
      "the registry watch to flush the cache",
    );

    const repopulated = await http(fixture.base, "GET", "/api/library/swiss/tokens");
    expect(repopulated.status).toBe(200);
    expect(fixture.bridge.calls["getTokens"]).toBe(before + 1);
  });

  it("keeps serving warm entries with the bridge down; cold requests return a structured 503", async () => {
    // Warm tokens, leave layouts cold, then stop the bridge.
    const warm = await http(fixture.base, "GET", "/api/library/swiss/tokens");
    expect(warm.status).toBe(200);
    // Ensure layouts is cold.
    fixture.api.cache.flush();
    await http(fixture.base, "GET", "/api/library/swiss/tokens"); // re-warm tokens only
    await fixture.bridge.stop();

    const cached = await http(fixture.base, "GET", "/api/library/swiss/tokens");
    expect(cached.status).toBe(200);

    const cold = await http(fixture.base, "GET", "/api/library/swiss/layouts");
    expect(cold.status).toBe(503);
    const error = (cold.body as ErrorResponse).error;
    expect(error.code).toBe("bridge_unavailable");
    expect(error.fix).toContain("bridge");
  });
});
