/**
 * Layout persistence over a REAL composed studio-server (the server test
 * composition: real Fastify on an ephemeral port, real workspace-store in
 * a temp dir). Covers: first-run defaults from GET, the debounced PUT
 * round-trip, reload-restores-the-exact-arrangement, and the server-side
 * validation accepting the shell's wire shape.
 */
import { lazy } from "react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { startApiServer, type ApiServerFixture } from "../../../server/test/api/api-helpers.js";

import { createApiClient, type ApiClient } from "../../src/api/apiClient.js";
import {
  fromLayoutPreference,
  toLayoutPreference,
} from "../../src/preferences/layoutMapping.js";
import { createLayoutPersistence } from "../../src/preferences/layoutPersistence.js";
import {
  createDockReducer,
  defaultDockState,
} from "../../src/shell/dockReducer.js";
import type { PanelDefinition } from "../../src/shell/types.js";

function testPanels(): PanelDefinition[] {
  const definition = (
    id: string,
    rail: "left" | "right",
  ): PanelDefinition => ({
    id,
    title: id,
    icon: () => null,
    component: lazy(async () => ({ default: () => null })),
    defaultPlacement: { rail, order: 0 },
    minWidth: 240,
  });
  return [definition("chat", "left"), definition("library", "right")];
}

describe("preferences round-trip against the real server", () => {
  let fixture: ApiServerFixture;
  let api: ApiClient;
  const panels = testPanels();

  beforeAll(async () => {
    fixture = await startApiServer();
    api = createApiClient({ baseUrl: fixture.base });
  });

  afterAll(async () => {
    await fixture.close();
  });

  it("GET before any PUT serves a shape-complete default that hydrates to first-run defaults", async () => {
    const stored = await api.getPreferences();
    expect(stored.ok).toBe(true);
    if (!stored.ok) {
      return;
    }
    expect(stored.value.schemaVersion).toBe(1);
    const hydrated = fromLayoutPreference(stored.value, panels);
    expect(hydrated).not.toBeNull();
    const reduce = createDockReducer(panels);
    const dock = reduce(hydrated!.dock, { type: "hydrate", state: hydrated!.dock });
    expect(dock.placements.map((p) => `${p.panelId}:${p.rail}`).sort()).toEqual([
      "chat:left",
      "library:right",
    ]);
  });

  it("a debounced arrangement burst lands as one accepted PUT and reloads exactly", async () => {
    const reduce = createDockReducer(panels);
    let dock = defaultDockState(panels);
    dock = reduce(dock, { type: "move", panelId: "library", rail: "left", order: 0 });
    dock = reduce(dock, { type: "collapse", panelId: "chat" });
    dock = reduce(dock, { type: "resizeRail", rail: "left", width: 420 });

    let puts = 0;
    const countingApi = {
      putPreferences: async (preference: Parameters<ApiClient["putPreferences"]>[0]) => {
        puts += 1;
        return api.putPreferences(preference);
      },
    };
    const persistence = createLayoutPersistence({
      api: countingApi,
      debounceMs: 25,
    });
    // A burst of changes → a single PUT (latest wins).
    persistence.schedule(toLayoutPreference(defaultDockState(panels), null));
    persistence.schedule(toLayoutPreference(dock, "ws-roundtrip"));
    await new Promise((resolve) => setTimeout(resolve, 60));
    await persistence.flush();
    expect(puts).toBe(1);
    expect(persistence.status()).toBe("synced");

    // "Reload": GET and hydrate — the exact arrangement returns.
    const reloaded = await api.getPreferences();
    expect(reloaded.ok).toBe(true);
    if (!reloaded.ok) {
      return;
    }
    const hydrated = fromLayoutPreference(reloaded.value, panels);
    expect(hydrated).not.toBeNull();
    const restored = reduce(hydrated!.dock, {
      type: "hydrate",
      state: hydrated!.dock,
    });
    expect(restored.placements).toEqual(dock.placements);
    expect(restored.activeTab).toEqual(dock.activeTab);
    expect(restored.railWidths).toEqual(dock.railWidths);
    expect(hydrated!.lastWorkspaceId).toBe("ws-roundtrip");
    persistence.dispose();
  });

  it("workspaces list/create works through the client (server auto-names)", async () => {
    const created = await api.createWorkspace({});
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.value.name).toMatch(/untitled workspace/i);
    const list = await api.listWorkspaces();
    expect(list.ok).toBe(true);
    if (list.ok) {
      expect(list.value.some((ws) => ws.id === created.value.id)).toBe(true);
    }
  });
});
