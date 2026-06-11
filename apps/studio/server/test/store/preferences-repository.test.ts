/**
 * PreferencesRepository — absent-file null, opaque round-trip with
 * unknown-key preservation, and corrupt-then-repair against a real temp
 * directory.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { parse } from "yaml";
import { describe, expect, it } from "vitest";

import type { LayoutPreference } from "@studio/contract";

import { expectFail, expectOk, makeStore } from "./store-helpers.js";

const PREFS: LayoutPreference = {
  schemaVersion: 1,
  placements: [
    { panelId: "library", zone: "left-rail" },
    { panelId: "chat", zone: "right-rail" },
  ],
  activeTab: "chat",
  railWidths: { left: 280, right: 360 },
  lastWorkspaceId: "checkout-flow",
};

describe("PreferencesRepository", () => {
  it("reads null when no preferences.yaml exists — first launch needs no setup", async () => {
    const { store } = makeStore();

    expect(expectOk(await store.preferences.get())).toBeNull();
  });

  it("reads null from an empty preferences.yaml", async () => {
    const { store, rootDir } = makeStore();
    expectOk(await store.workspaces.list()); // initialize the root
    await writeFile(path.join(rootDir, "preferences.yaml"), "");

    expect(expectOk(await store.preferences.get())).toBeNull();
  });

  it("round-trips the whole document: placements, activeTab, railWidths, lastWorkspaceId", async () => {
    const { store, rootDir } = makeStore();

    expectOk(await store.preferences.put(PREFS));

    expect(expectOk(await store.preferences.get())).toEqual(PREFS);
    const onDisk = parse(
      await readFile(path.join(rootDir, "preferences.yaml"), "utf8"),
    );
    expect(onDisk).toEqual(PREFS);
  });

  it("preserves unknown keys verbatim across read/write round-trips (opaque persistence)", async () => {
    const { store } = makeStore();
    const withUnknown = {
      ...PREFS,
      futurePanel: { collapsed: true, order: [3, 1, 2] },
      theme: "high-contrast",
    } as unknown as LayoutPreference;

    expectOk(await store.preferences.put(withUnknown));
    const firstRead = expectOk(await store.preferences.get());
    expect(firstRead).toEqual(withUnknown);

    // Write back exactly what was read — the unknown keys survive again.
    expectOk(await store.preferences.put(firstRead as LayoutPreference));
    expect(expectOk(await store.preferences.get())).toEqual(withUnknown);
  });

  it("a corrupt preferences.yaml reads as corrupt and the next write repairs it", async () => {
    const { store, rootDir } = makeStore();
    expectOk(await store.preferences.put(PREFS));
    await writeFile(path.join(rootDir, "preferences.yaml"), "{ garbage [\n");

    const error = expectFail(await store.preferences.get(), "corrupt");
    expect(error.path).toBe("preferences.yaml");

    expectOk(await store.preferences.put(PREFS));
    expect(expectOk(await store.preferences.get())).toEqual(PREFS);
  });

  it("serializes concurrent puts; the file is always a complete document", async () => {
    const { store, rootDir } = makeStore();

    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        store.preferences.put({ ...PREFS, activeTab: `tab-${i}` }),
      ),
    );

    const doc = parse(
      await readFile(path.join(rootDir, "preferences.yaml"), "utf8"),
    ) as LayoutPreference;
    expect(doc.schemaVersion).toBe(1);
    expect(doc.activeTab).toMatch(/^tab-\d$/);
    expect(doc.railWidths).toEqual(PREFS.railWidths);
  });
});
