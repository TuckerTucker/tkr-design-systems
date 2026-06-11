/**
 * Workspaces CRUD and preferences over real HTTP — auto-naming, rename,
 * settings, soft-delete (trash-prefixed, recoverable, invisible to the
 * API), and the LayoutPreference round-trip surviving a server restart on
 * the same store root.
 */
import { existsSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type {
  ErrorResponse,
  LayoutPreference,
  WorkspaceSummary,
} from "@studio/contract";

import { http, startApiServer, type ApiServerFixture } from "./api-helpers.js";

let fixture: ApiServerFixture | undefined;

afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});

describe("workspaces CRUD", () => {
  it("auto-names workspaces when the create request omits a name", async () => {
    fixture = await startApiServer();

    const first = await http(fixture.base, "POST", "/api/workspaces", {});
    expect(first.status).toBe(201);
    const firstWorkspace = first.body as WorkspaceSummary;
    expect(firstWorkspace.name).toBe("Untitled Workspace 1");
    expect(firstWorkspace.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(firstWorkspace.created).toBeTruthy();

    const second = await http(fixture.base, "POST", "/api/workspaces", {});
    expect((second.body as WorkspaceSummary).name).toBe("Untitled Workspace 2");
  });

  it("creates, lists, reads, renames, and patches settings", async () => {
    fixture = await startApiServer();

    const created = await http(fixture.base, "POST", "/api/workspaces", {
      name: "Podcast App",
    });
    expect(created.status).toBe(201);
    const workspace = created.body as WorkspaceSummary;

    const listed = await http(fixture.base, "GET", "/api/workspaces");
    expect(listed.status).toBe(200);
    expect(
      (listed.body as WorkspaceSummary[]).map((entry) => entry.id),
    ).toContain(workspace.id);

    const read = await http(fixture.base, "GET", `/api/workspaces/${workspace.id}`);
    expect((read.body as WorkspaceSummary).name).toBe("Podcast App");

    const patched = await http(
      fixture.base,
      "PATCH",
      `/api/workspaces/${workspace.id}`,
      { name: "Podcast Studio", settings: { defaultSystem: "swiss", defaultPlatform: "mobile" } },
    );
    expect(patched.status).toBe(200);
    const updated = patched.body as WorkspaceSummary;
    expect(updated.name).toBe("Podcast Studio");
    expect(updated.settings).toEqual({
      defaultSystem: "swiss",
      defaultPlatform: "mobile",
    });
    expect(Date.parse(updated.updated)).toBeGreaterThanOrEqual(
      Date.parse(workspace.updated),
    );
  });

  it("soft-deletes: 204, then 404 with a structured error, while the data stays recoverable on disk", async () => {
    fixture = await startApiServer();
    const created = await http(fixture.base, "POST", "/api/workspaces", {
      name: "Doomed",
    });
    const workspace = created.body as WorkspaceSummary;

    const deleted = await http(
      fixture.base,
      "DELETE",
      `/api/workspaces/${workspace.id}`,
    );
    expect(deleted.status).toBe(204);

    const gone = await http(fixture.base, "GET", `/api/workspaces/${workspace.id}`);
    expect(gone.status).toBe(404);
    const error = (gone.body as ErrorResponse).error;
    expect(error.code).toBe("workspace_not_found");
    expect(error.fix).toContain("GET /api/workspaces");

    // Trash-prefixed directory remains — recoverable at the store level.
    expect(existsSync(path.join(fixture.storeRoot, `.trash-${workspace.id}`))).toBe(true);

    // Soft-deleted workspaces are invisible: a second DELETE is a 404.
    const again = await http(
      fixture.base,
      "DELETE",
      `/api/workspaces/${workspace.id}`,
    );
    expect(again.status).toBe(404);

    const listed = await http(fixture.base, "GET", "/api/workspaces");
    expect(
      (listed.body as WorkspaceSummary[]).map((entry) => entry.id),
    ).not.toContain(workspace.id);
  });
});

describe("preferences", () => {
  const PREFS: LayoutPreference = {
    schemaVersion: 1,
    placements: [
      { panelId: "library", zone: "left-rail" },
      { panelId: "chat", zone: "right-rail" },
      { panelId: "future-panel", zone: "left-rail" },
    ],
    activeTab: "chat",
    railWidths: { left: 280, right: 400 },
    lastWorkspaceId: null,
  };

  it("serves defaults before any PUT, then round-trips the LayoutPreference document", async () => {
    fixture = await startApiServer();

    const initial = await http(fixture.base, "GET", "/api/preferences");
    expect(initial.status).toBe(200);
    expect((initial.body as LayoutPreference).schemaVersion).toBe(1);

    const put = await http(fixture.base, "PUT", "/api/preferences", PREFS);
    expect(put.status).toBe(200);

    const read = await http(fixture.base, "GET", "/api/preferences");
    expect(read.body).toEqual(PREFS);
  });

  it("persists across a server restart on the same store root", async () => {
    fixture = await startApiServer();
    const storeRoot = fixture.storeRoot;
    await http(fixture.base, "PUT", "/api/preferences", PREFS);
    await fixture.close();

    fixture = await startApiServer({ storeRoot });
    const read = await http(fixture.base, "GET", "/api/preferences");
    expect(read.status).toBe(200);
    expect(read.body).toEqual(PREFS);
  });
});
