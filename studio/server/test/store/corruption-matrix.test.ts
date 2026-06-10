/**
 * Store-wide corruption tolerance — slice 5 verification matrix: a damaged
 * preferences.yaml, workspace.yaml, transcript.yaml, and version file each
 * degrade exactly one item while every sibling stays readable.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { LayoutPreference } from "@studio/contract";

import { expectFail, expectOk, makeStore, type StoreFixture } from "./store-helpers.js";

const GARBAGE = "{ this is : not [ valid yaml\n";

const PREFS: LayoutPreference = {
  schemaVersion: 1,
  placements: [{ panelId: "library", zone: "left-rail" }],
  activeTab: "chat",
  railWidths: { left: 280, right: 360 },
  lastWorkspaceId: "alpha-flow",
};

/**
 * A populated store: two workspaces; alpha has a transcript and an artifact
 * with three versions; preferences are saved.
 */
async function populatedStore(): Promise<StoreFixture & { artifactId: string }> {
  const fixture = makeStore();
  const { store } = fixture;
  expectOk(await store.workspaces.create("Alpha Flow"));
  expectOk(await store.workspaces.create("Beta Flow"));
  expectOk(
    await store.transcripts.append("alpha-flow", {
      id: "msg-0001",
      kind: "message",
      timestamp: "2026-06-10T17:05:00.000Z",
      payload: { role: "user", text: "wireframe a checkout screen" },
    }),
  );
  const artifact = expectOk(
    await store.artifacts.create("alpha-flow", {
      name: "Checkout",
      system: "swiss",
      platform: "mobile",
    }),
  );
  for (let i = 0; i < 3; i += 1) {
    expectOk(
      await store.artifacts.createVersion("alpha-flow", artifact.id, {
        svg: "<svg/>",
        spec: { layout: "form-flow" },
        provenance: {
          parentVersion: i === 0 ? null : i,
          brief: "checkout",
          tool: "wf_generate",
          parameters: {},
        },
      }),
    );
  }
  expectOk(await store.preferences.put(PREFS));
  return { ...fixture, artifactId: artifact.id };
}

describe("store-wide corruption tolerance", () => {
  it("each damaged file degrades exactly one item while every sibling read succeeds", async () => {
    const { store, rootDir, artifactId } = await populatedStore();

    // Damage one file of every kind.
    await writeFile(path.join(rootDir, "beta-flow", "workspace.yaml"), GARBAGE);
    await writeFile(path.join(rootDir, "alpha-flow", "transcript.yaml"), GARBAGE);
    await writeFile(
      path.join(
        rootDir,
        "alpha-flow",
        "artifacts",
        artifactId,
        "versions",
        "0002",
        "version.yaml",
      ),
      GARBAGE,
    );
    await writeFile(path.join(rootDir, "preferences.yaml"), GARBAGE);

    // workspace.yaml: beta degrades in the list; alpha lists and reads fine.
    const entries = expectOk(await store.workspaces.list());
    expect(entries).toHaveLength(2);
    const beta = entries.find((entry) => !entry.ok);
    if (beta === undefined || beta.ok) {
      throw new Error("expected beta-flow to degrade");
    }
    expect(beta.id).toBe("beta-flow");
    expect(beta.error.code).toBe("corrupt");
    expect(beta.error.path).toBe(path.join("beta-flow", "workspace.yaml"));
    expect(expectOk(await store.workspaces.get("alpha-flow")).name).toBe("Alpha Flow");

    // transcript.yaml: only the transcript degrades; alpha metadata and
    // artifacts read normally.
    expectFail(await store.transcripts.read("alpha-flow"), "corrupt");
    expect(expectOk(await store.artifacts.list("alpha-flow"))).toHaveLength(1);

    // version file: only version 2 degrades; 1 and 3 read fine; the SVG of
    // the damaged version is still servable (the damage is version.yaml).
    const versions = expectOk(await store.artifacts.listVersions("alpha-flow", artifactId));
    expect(versions.map((meta) => meta.number)).toEqual([1, 3]);
    expectOk(await store.artifacts.readSpec("alpha-flow", artifactId, 1));
    expectOk(await store.artifacts.readSpec("alpha-flow", artifactId, 3));
    expectOk(await store.artifacts.readSvg("alpha-flow", artifactId, 2));
    // setHead to a healthy version recovers the canvas.
    expect(
      expectOk(await store.artifacts.setHead("alpha-flow", artifactId, 3)).headVersion,
    ).toBe(3);

    // preferences.yaml: degrades to a typed corrupt result (defaults apply)…
    expectFail(await store.preferences.get(), "corrupt");
    // …and the next write repairs it without a restart.
    expectOk(await store.preferences.put(PREFS));
    expect(expectOk(await store.preferences.get())).toEqual(PREFS);
  });

  it("fixing a damaged file on disk recovers it on the next read — no restart, no migration", async () => {
    const { store, rootDir } = await populatedStore();
    await writeFile(path.join(rootDir, "alpha-flow", "transcript.yaml"), GARBAGE);
    expectFail(await store.transcripts.read("alpha-flow"), "corrupt");

    await writeFile(
      path.join(rootDir, "alpha-flow", "transcript.yaml"),
      "records:\n  - id: msg-0001\n    kind: message\n    timestamp: 2026-06-10T17:05:00.000Z\n    payload:\n      text: repaired\n",
    );

    const records = expectOk(await store.transcripts.read("alpha-flow"));
    expect(records).toHaveLength(1);
    expect(records[0]?.id).toBe("msg-0001");
  });
});
