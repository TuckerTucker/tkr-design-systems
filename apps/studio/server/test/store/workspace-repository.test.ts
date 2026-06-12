/**
 * WorkspaceRepository — lifecycle, soft-delete/restore, slug collisions,
 * traversal defense, and corrupt-file degradation against a real temp
 * directory.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { parse } from "yaml";
import { describe, expect, it } from "vitest";

import { expectFail, expectOk, dirSnapshot, makeStore } from "./store-helpers.js";

describe("WorkspaceRepository lifecycle", () => {
  it("create → list → get round-trips every field through workspace.yaml", async () => {
    const { store, rootDir } = makeStore();

    const created = expectOk(await store.workspaces.create("Checkout Flow"));
    expect(created).toMatchObject({
      id: "checkout-flow",
      name: "Checkout Flow",
      activeArtifactId: null,
      settings: {},
    });
    expect(created.created).toBe(created.updated);

    const onDisk = parse(
      await readFile(path.join(rootDir, "checkout-flow", "workspace.yaml"), "utf8"),
    ) as Record<string, unknown>;
    expect(onDisk).toEqual({ ...created });

    const listed = expectOk(await store.workspaces.list());
    expect(listed).toEqual([{ ok: true, workspace: created }]);

    expect(expectOk(await store.workspaces.get("checkout-flow"))).toEqual(created);
  });

  it("resolves duplicate display names with -2/-3 suffixes, never an error", async () => {
    const { store } = makeStore();

    expect(expectOk(await store.workspaces.create("Checkout Flow")).id).toBe(
      "checkout-flow",
    );
    expect(expectOk(await store.workspaces.create("Checkout Flow")).id).toBe(
      "checkout-flow-2",
    );
    expect(expectOk(await store.workspaces.create("Checkout Flow")).id).toBe(
      "checkout-flow-3",
    );
  });

  it("falls back for names that slug to empty", async () => {
    const { store } = makeStore();

    expect(expectOk(await store.workspaces.create("🎉🎉")).id).toBe("workspace");
    expect(expectOk(await store.workspaces.create("!!!")).id).toBe("workspace-2");
  });

  it("allocates unique slugs under concurrent creates", async () => {
    const { store } = makeStore();

    const results = await Promise.all(
      Array.from({ length: 5 }, () => store.workspaces.create("Same Name")),
    );
    const ids = results.map((result) => expectOk(result).id);
    expect(new Set(ids).size).toBe(5);
  });

  it("rejects unknown and traversal ids with typed not_found, never throwing", async () => {
    const { store, rootDir, parentDir } = makeStore();
    expectOk(await store.workspaces.create("Checkout Flow"));

    expectFail(await store.workspaces.get("nope"), "not_found");
    expectFail(await store.workspaces.get("../escape"), "not_found");
    expectFail(await store.workspaces.get("/etc/passwd"), "not_found");
    expectFail(await store.workspaces.update("../escape", { name: "x" }), "not_found");
    expectFail(await store.workspaces.softDelete("../escape"), "not_found");
    expectFail(await store.workspaces.restore("../escape"), "not_found");

    // Traversal input never reached the filesystem outside the root.
    expect(await readdir(parentDir)).toEqual(["workspaces"]);
    expect(existsSync(path.join(rootDir, "..", "escape"))).toBe(false);
  });

  it("update renames without changing id, created, or the directory", async () => {
    const { store, rootDir } = makeStore();
    const created = expectOk(await store.workspaces.create("Checkout Flow"));

    const updated = expectOk(
      await store.workspaces.update("checkout-flow", { name: "Checkout v2" }),
    );

    expect(updated.name).toBe("Checkout v2");
    expect(updated.id).toBe(created.id);
    expect(updated.created).toBe(created.created);
    expect(updated.updated >= created.updated).toBe(true);
    expect(updated.settings).toEqual(created.settings);
    expect(existsSync(path.join(rootDir, "checkout-flow"))).toBe(true);
  });

  it("patch semantics: settings-only update leaves name and activeArtifactId untouched", async () => {
    const { store } = makeStore();
    expectOk(await store.workspaces.create("Checkout Flow"));
    expectOk(
      await store.workspaces.update("checkout-flow", {
        activeArtifactId: "checkout-mobile",
      }),
    );

    const updated = expectOk(
      await store.workspaces.update("checkout-flow", {
        settings: { gridSnap: true },
      }),
    );

    expect(updated.name).toBe("Checkout Flow");
    expect(updated.activeArtifactId).toBe("checkout-mobile");
    expect(updated.settings).toEqual({ gridSnap: true });

    const cleared = expectOk(
      await store.workspaces.update("checkout-flow", { activeArtifactId: null }),
    );
    expect(cleared.activeArtifactId).toBeNull();
    expect(cleared.settings).toEqual({ gridSnap: true });
  });
});

describe("WorkspaceRepository soft delete and recovery", () => {
  it("softDelete renames to .trash-<id> with contents untouched and hides it from list()", async () => {
    const { store, rootDir } = makeStore();
    expectOk(await store.workspaces.create("Checkout Flow"));
    const before = await dirSnapshot(path.join(rootDir, "checkout-flow"));

    expectOk(await store.workspaces.softDelete("checkout-flow"));

    expect(existsSync(path.join(rootDir, "checkout-flow"))).toBe(false);
    const trashed = await dirSnapshot(path.join(rootDir, ".trash-checkout-flow"));
    expect(trashed).toEqual(before);
    expect(expectOk(await store.workspaces.list())).toEqual([]);
    expect(expectOk(await store.workspaces.listDeleted())).toEqual([
      "checkout-flow",
    ]);
  });

  it("restore brings the workspace back byte-identical, including transcript and artifacts", async () => {
    const { store, rootDir } = makeStore();
    expectOk(await store.workspaces.create("Checkout Flow"));
    expectOk(
      await store.transcripts.append("checkout-flow", {
        id: "msg-0001",
        kind: "message",
        timestamp: "2026-06-10T17:05:00.000Z",
        payload: { role: "user", text: "wireframe a checkout screen" },
      }),
    );
    const artifact = expectOk(
      await store.artifacts.create("checkout-flow", {
        name: "Checkout (mobile)",
        system: "swiss",
        platform: "mobile",
      }),
    );
    expectOk(
      await store.artifacts.createVersion("checkout-flow", artifact.id, {
        svg: "<svg/>",
        spec: { layout: "form-flow" },
        provenance: { parentVersion: null, brief: "b", tool: "wf_generate", parameters: {} },
      }),
    );
    const before = await dirSnapshot(path.join(rootDir, "checkout-flow"));

    expectOk(await store.workspaces.softDelete("checkout-flow"));
    const restored = expectOk(await store.workspaces.restore("checkout-flow"));

    expect(restored.id).toBe("checkout-flow");
    expect(await dirSnapshot(path.join(rootDir, "checkout-flow"))).toEqual(before);
    const listed = expectOk(await store.workspaces.list());
    expect(listed).toHaveLength(1);
    expect(expectOk(await store.workspaces.listDeleted())).toEqual([]);
  });

  it("restore into a reused slug returns conflict and leaves both directories untouched", async () => {
    const { store, rootDir } = makeStore();
    expectOk(await store.workspaces.create("Checkout Flow"));
    expectOk(await store.workspaces.softDelete("checkout-flow"));
    expectOk(await store.workspaces.create("Checkout Flow")); // reuses the slug
    const liveBefore = await dirSnapshot(path.join(rootDir, "checkout-flow"));
    const trashBefore = await dirSnapshot(path.join(rootDir, ".trash-checkout-flow"));

    const error = expectFail(await store.workspaces.restore("checkout-flow"), "conflict");

    expect(error.message).toContain(".trash-checkout-flow");
    expect(await dirSnapshot(path.join(rootDir, "checkout-flow"))).toEqual(liveBefore);
    expect(await dirSnapshot(path.join(rootDir, ".trash-checkout-flow"))).toEqual(
      trashBefore,
    );
  });

  it("a .trash- directory from a previous session is never listed as a workspace", async () => {
    const { store, rootDir } = makeStore();
    await mkdir(path.join(rootDir, ".trash-old-project"), { recursive: true });
    await writeFile(
      path.join(rootDir, ".trash-old-project", "workspace.yaml"),
      "id: old-project\nname: Old\ncreated: 2026-01-01T00:00:00.000Z\nupdated: 2026-01-01T00:00:00.000Z\n",
    );

    expect(expectOk(await store.workspaces.list())).toEqual([]);
    expect(expectOk(await store.workspaces.listDeleted())).toEqual(["old-project"]);
  });

  it("softDelete of a missing workspace is typed not_found", async () => {
    const { store } = makeStore();
    expectFail(await store.workspaces.softDelete("nope"), "not_found");
    expectFail(await store.workspaces.restore("nope"), "not_found");
  });
});

describe("WorkspaceRepository corruption tolerance", () => {
  it("a corrupt workspace.yaml degrades that entry only; siblings list normally", async () => {
    const { store, rootDir } = makeStore();
    expectOk(await store.workspaces.create("Healthy One"));
    expectOk(await store.workspaces.create("Broken One"));
    await writeFile(
      path.join(rootDir, "broken-one", "workspace.yaml"),
      "{ this is : not [ valid yaml\n",
    );

    const entries = expectOk(await store.workspaces.list());

    expect(entries).toHaveLength(2);
    const broken = entries.find((entry) => !entry.ok);
    const healthy = entries.find((entry) => entry.ok);
    expect(healthy).toBeDefined();
    if (broken === undefined || broken.ok) {
      throw new Error("expected a degraded entry");
    }
    expect(broken.id).toBe("broken-one");
    expect(broken.error.code).toBe("corrupt");
    expect(broken.error.path).toBe(path.join("broken-one", "workspace.yaml"));
    expect(broken.error.message).toContain("workspace.yaml");
  });

  it("a schema mismatch (missing fields) also degrades as corrupt", async () => {
    const { store, rootDir } = makeStore();
    expectOk(await store.workspaces.create("Truncated"));
    await writeFile(
      path.join(rootDir, "truncated", "workspace.yaml"),
      "id: truncated\n",
    );

    const error = expectFail(await store.workspaces.get("truncated"), "corrupt");
    expect(error.message).toContain("name");
  });

  it("a fixed file reads ok on the next call — no restart, no migration", async () => {
    const { store, rootDir } = makeStore();
    const created = expectOk(await store.workspaces.create("Fix Me"));
    const file = path.join(rootDir, "fix-me", "workspace.yaml");
    const good = await readFile(file, "utf8");
    await writeFile(file, "{ broken [\n");
    expectFail(await store.workspaces.get("fix-me"), "corrupt");

    await writeFile(file, good);

    expect(expectOk(await store.workspaces.get("fix-me"))).toEqual(created);
  });
});
