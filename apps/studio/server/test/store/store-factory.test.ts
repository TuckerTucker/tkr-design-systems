/**
 * createWorkspaceStore — IoC factory, lazy root creation, startup orphan
 * sweep, status reporting, and the nothing-outside-the-root guarantee.
 */
import { existsSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { TEMP_PREFIX } from "../../src/store/atomic-write.js";
import { expectOk, makeStore } from "./store-helpers.js";

describe("createWorkspaceStore", () => {
  it("returns all four repositories and a status provider from config alone", () => {
    const { store } = makeStore();

    expect(store.workspaces).toBeDefined();
    expect(store.transcripts).toBeDefined();
    expect(store.artifacts).toBeDefined();
    expect(store.preferences).toBeDefined();
    expect(typeof store.status).toBe("function");
  });

  it("creates the store root on first use and writes nothing outside it", async () => {
    const { store, rootDir, parentDir } = makeStore();
    expect(existsSync(rootDir)).toBe(false);

    expectOk(await store.workspaces.create("Checkout Flow"));

    expect(existsSync(path.join(rootDir, "checkout-flow", "workspace.yaml"))).toBe(
      true,
    );
    // The parent temp directory contains only the store root.
    expect(await readdir(parentDir)).toEqual(["workspaces"]);
  });

  it("an empty root lists no workspaces and is not an error (first launch)", async () => {
    const { store } = makeStore();

    expect(expectOk(await store.workspaces.list())).toEqual([]);
    expect(expectOk(await store.preferences.get())).toBeNull();
  });

  it("sweeps orphaned temp entries on first use and logs the sweep", async () => {
    const { store, rootDir, log } = makeStore();
    await mkdir(path.join(rootDir, "old-ws"), { recursive: true });
    await writeFile(
      path.join(rootDir, "old-ws", `${TEMP_PREFIX}transcript.yaml-dead`),
      "partial",
    );
    await writeFile(path.join(rootDir, "old-ws", "workspace.yaml"), "id: old-ws\n");

    expectOk(await store.workspaces.list());

    expect(await readdir(path.join(rootDir, "old-ws"))).toEqual(["workspace.yaml"]);
    expect(
      log.lines().some((line) => String(line.msg).includes("swept orphaned temp entry")),
    ).toBe(true);
  });

  it("status reports ok with the root path once initialized", async () => {
    const { store, rootDir } = makeStore();

    expect(await store.status()).toEqual({ status: "ok", detail: rootDir });
  });

  it("status reports failed when the root cannot be created, then recovers on retry", async () => {
    const { parentDir } = makeStore();
    const blocker = path.join(parentDir, "blocker");
    await writeFile(blocker, "a file where a directory must go");
    const { store } = makeStore({ rootDir: path.join(blocker, "workspaces") });

    const failed = await store.status();
    expect(failed.status).toBe("failed");
    expect(failed.detail).toContain("blocker");

    // Subsequent calls retry naturally once the obstruction is gone.
    await rm(blocker);
    expect((await store.status()).status).toBe("ok");
  });

  it("repository calls against a failed root return io_error, never throw", async () => {
    const { parentDir } = makeStore();
    const blocker = path.join(parentDir, "blocker");
    await writeFile(blocker, "file");
    const { store } = makeStore({ rootDir: path.join(blocker, "workspaces") });

    const result = await store.workspaces.list();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("io_error");
    }
  });
});
