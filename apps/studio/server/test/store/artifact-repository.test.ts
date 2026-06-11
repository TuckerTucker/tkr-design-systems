/**
 * ArtifactRepository — version numbering, version-unit atomicity, head
 * moves, late compliance attach, and corrupt-version degradation against a
 * real temp directory.
 */
import { existsSync } from "node:fs";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { parse } from "yaml";
import { describe, expect, it } from "vitest";

import type { NewVersionInput, WorkspaceStore } from "@studio/contract";

import { TEMP_PREFIX } from "../../src/store/atomic-write.js";
import { expectFail, expectOk, dirSnapshot, makeStore, type StoreFixture } from "./store-helpers.js";

function versionInput(overrides: Partial<NewVersionInput> = {}): NewVersionInput {
  return {
    svg: '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>',
    spec: { system: "swiss", layout: "form-flow" },
    provenance: {
      parentVersion: null,
      brief: "wireframe a checkout screen",
      tool: "wf_generate",
      parameters: { system: "swiss", platform: "mobile" },
    },
    ...overrides,
  };
}

async function makeArtifactFixture(): Promise<StoreFixture & { artifactId: string }> {
  const fixture = makeStore();
  expectOk(await fixture.store.workspaces.create("Checkout Flow"));
  const artifact = expectOk(
    await fixture.store.artifacts.create("checkout-flow", {
      name: "Checkout (mobile)",
      system: "swiss",
      platform: "mobile",
    }),
  );
  return { ...fixture, artifactId: artifact.id };
}

function versionsDirOf(rootDir: string, artifactId: string): string {
  return path.join(rootDir, "checkout-flow", "artifacts", artifactId, "versions");
}

describe("ArtifactRepository artifacts", () => {
  it("creates an artifact with a null head and round-trips it", async () => {
    const { store, artifactId } = await makeArtifactFixture();

    expect(artifactId).toBe("checkout-mobile");
    const meta = expectOk(await store.artifacts.get("checkout-flow", artifactId));
    expect(meta).toMatchObject({
      id: "checkout-mobile",
      name: "Checkout (mobile)",
      system: "swiss",
      platform: "mobile",
      headVersion: null,
    });
    expect(expectOk(await store.artifacts.list("checkout-flow"))).toEqual([meta]);
  });

  it("resolves artifact slug collisions within the workspace", async () => {
    const { store } = await makeArtifactFixture();

    const second = expectOk(
      await store.artifacts.create("checkout-flow", {
        name: "Checkout (mobile)",
        system: "swiss",
        platform: "mobile",
      }),
    );
    expect(second.id).toBe("checkout-mobile-2");
  });

  it("guards workspace and artifact ids (missing and traversal) with not_found", async () => {
    const { store } = await makeArtifactFixture();

    expectFail(await store.artifacts.list("nope"), "not_found");
    expectFail(await store.artifacts.get("checkout-flow", "nope"), "not_found");
    expectFail(await store.artifacts.get("../escape", "x"), "not_found");
    expectFail(await store.artifacts.get("checkout-flow", "../escape"), "not_found");
    expectFail(
      await store.artifacts.createVersion("checkout-flow", "nope", versionInput()),
      "not_found",
    );
  });

  it("skips a corrupt artifact.yaml in listings while get() reports it as corrupt", async () => {
    const { store, rootDir } = await makeArtifactFixture();
    expectOk(
      await store.artifacts.create("checkout-flow", {
        name: "Broken",
        system: "swiss",
        platform: "desktop",
      }),
    );
    await writeFile(
      path.join(rootDir, "checkout-flow", "artifacts", "broken", "artifact.yaml"),
      "{ nope [\n",
    );

    const listed = expectOk(await store.artifacts.list("checkout-flow"));
    expect(listed.map((meta) => meta.id)).toEqual(["checkout-mobile"]);
    expectFail(await store.artifacts.get("checkout-flow", "broken"), "corrupt");
  });
});

describe("ArtifactRepository versions", () => {
  it("lands the first version as versions/0001 with all three files; the store assigns number 1", async () => {
    const { store, rootDir, artifactId } = await makeArtifactFixture();

    const version = expectOk(
      await store.artifacts.createVersion("checkout-flow", artifactId, versionInput()),
    );

    expect(version.number).toBe(1);
    expect(version.parentVersion).toBeNull();
    const dir = path.join(versionsDirOf(rootDir, artifactId), "0001");
    expect((await readdir(dir)).sort()).toEqual([
      "version.yaml",
      "wireframe.spec.yaml",
      "wireframe.svg",
    ]);
    const provenance = parse(await readFile(path.join(dir, "version.yaml"), "utf8"));
    expect(provenance).toEqual({ ...version });
    // The head pointer is artifact-pipeline's to move; landing does not move it.
    expect(
      expectOk(await store.artifacts.get("checkout-flow", artifactId)).headVersion,
    ).toBeNull();
  });

  it("allocates zero-padded sequential directories 0002, 0003", async () => {
    const { store, rootDir, artifactId } = await makeArtifactFixture();

    for (const expected of [1, 2, 3]) {
      const version = expectOk(
        await store.artifacts.createVersion("checkout-flow", artifactId, versionInput()),
      );
      expect(version.number).toBe(expected);
    }

    expect((await readdir(versionsDirOf(rootDir, artifactId))).sort()).toEqual([
      "0001",
      "0002",
      "0003",
    ]);
  });

  it("allocates max + 1 after a hand-deleted gap, never gap-filling", async () => {
    const { store, rootDir, artifactId } = await makeArtifactFixture();
    for (let i = 0; i < 3; i += 1) {
      expectOk(await store.artifacts.createVersion("checkout-flow", artifactId, versionInput()));
    }
    await rm(path.join(versionsDirOf(rootDir, artifactId), "0002"), {
      recursive: true,
    });

    const next = expectOk(
      await store.artifacts.createVersion("checkout-flow", artifactId, versionInput()),
    );

    expect(next.number).toBe(4);
    const listed = expectOk(await store.artifacts.listVersions("checkout-flow", artifactId));
    expect(listed.map((meta) => meta.number)).toEqual([1, 3, 4]);
  });

  it("allocates unique sequential numbers under concurrent createVersion calls", async () => {
    const { store, rootDir, artifactId } = await makeArtifactFixture();

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        store.artifacts.createVersion("checkout-flow", artifactId, versionInput()),
      ),
    );

    const numbers = results.map((result) => expectOk(result).number).sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2, 3, 4, 5]);
    expect((await readdir(versionsDirOf(rootDir, artifactId))).sort()).toEqual([
      "0001",
      "0002",
      "0003",
      "0004",
      "0005",
    ]);
  });

  it("an interrupted version write never leaves a directory that passes for complete", async () => {
    let interrupt = true;
    const fixture = makeStore({
      hooks: {
        beforeRename: (targetPath: string) => {
          if (interrupt && path.basename(targetPath) === "0001") {
            throw new Error("simulated crash");
          }
        },
      },
    });
    const { store, rootDir } = fixture;
    expectOk(await store.workspaces.create("Checkout Flow"));
    const artifact = expectOk(
      await store.artifacts.create("checkout-flow", {
        name: "Checkout (mobile)",
        system: "swiss",
        platform: "mobile",
      }),
    );

    const failed = await store.artifacts.createVersion(
      "checkout-flow",
      artifact.id,
      versionInput(),
    );

    expectFail(failed, "io_error");
    const dir = versionsDirOf(rootDir, artifact.id);
    expect(existsSync(path.join(dir, "0001"))).toBe(false);
    // The orphaned staging directory is exactly what a crash leaves behind…
    const names = await readdir(dir);
    expect(names.every((name) => name.startsWith(TEMP_PREFIX))).toBe(true);
    // …and is invisible to reads.
    expect(expectOk(await store.artifacts.listVersions("checkout-flow", artifact.id))).toEqual([]);

    // The next attempt succeeds with a clean number.
    interrupt = false;
    const version = expectOk(
      await store.artifacts.createVersion("checkout-flow", artifact.id, versionInput()),
    );
    expect(version.number).toBe(1);
    expect(existsSync(path.join(dir, "0001"))).toBe(true);
  });

  it("serves SVG and spec by version number", async () => {
    const { store, artifactId } = await makeArtifactFixture();
    expectOk(
      await store.artifacts.createVersion("checkout-flow", artifactId, versionInput()),
    );

    expect(expectOk(await store.artifacts.readSvg("checkout-flow", artifactId, 1))).toBe(
      versionInput().svg,
    );
    expect(expectOk(await store.artifacts.readSpec("checkout-flow", artifactId, 1))).toEqual({
      system: "swiss",
      layout: "form-flow",
    });
  });

  it("writes a string spec verbatim as YAML text", async () => {
    const { store, rootDir, artifactId } = await makeArtifactFixture();
    const specYaml = "system: swiss\nlayout: form-flow\nregions:\n  - header\n  - form\n";

    expectOk(
      await store.artifacts.createVersion(
        "checkout-flow",
        artifactId,
        versionInput({ spec: specYaml }),
      ),
    );

    const onDisk = await readFile(
      path.join(versionsDirOf(rootDir, artifactId), "0001", "wireframe.spec.yaml"),
      "utf8",
    );
    expect(onDisk).toBe(specYaml);
    expect(expectOk(await store.artifacts.readSpec("checkout-flow", artifactId, 1))).toEqual({
      system: "swiss",
      layout: "form-flow",
      regions: ["header", "form"],
    });
  });

  it("rejects invalid version addresses with not_found", async () => {
    const { store, artifactId } = await makeArtifactFixture();
    expectOk(await store.artifacts.createVersion("checkout-flow", artifactId, versionInput()));

    expectFail(await store.artifacts.readSvg("checkout-flow", artifactId, 2), "not_found");
    expectFail(await store.artifacts.readSvg("checkout-flow", artifactId, 0), "not_found");
    expectFail(await store.artifacts.readSvg("checkout-flow", artifactId, -1), "not_found");
    expectFail(await store.artifacts.readSvg("checkout-flow", artifactId, 1.5), "not_found");
  });
});

describe("ArtifactRepository compliance and head pointer", () => {
  async function withVersions(count: number): Promise<{
    store: WorkspaceStore;
    rootDir: string;
    artifactId: string;
  }> {
    const fixture = await makeArtifactFixture();
    for (let i = 0; i < count; i += 1) {
      expectOk(
        await fixture.store.artifacts.createVersion(
          "checkout-flow",
          fixture.artifactId,
          versionInput(),
        ),
      );
    }
    return fixture;
  }

  it("readCompliance before delivery is not_found (distinct from corrupt); writeCompliance attaches late", async () => {
    const { store, artifactId } = await withVersions(1);

    expectFail(await store.artifacts.readCompliance("checkout-flow", artifactId, 1), "not_found");

    const report = { status: "completed", passed: 12, failed: 1, rules: [{ id: "color" }] };
    expectOk(await store.artifacts.writeCompliance("checkout-flow", artifactId, 1, report));
    expect(
      expectOk(await store.artifacts.readCompliance("checkout-flow", artifactId, 1)),
    ).toEqual(report);
  });

  it("writeCompliance to a missing version is not_found", async () => {
    const { store, artifactId } = await withVersions(1);
    expectFail(
      await store.artifacts.writeCompliance("checkout-flow", artifactId, 7, {}),
      "not_found",
    );
  });

  it("setHead moves only the pointer in artifact.yaml; version directories stay byte-identical", async () => {
    const { store, rootDir, artifactId } = await withVersions(2);
    expectOk(await store.artifacts.setHead("checkout-flow", artifactId, 2));
    const before = await dirSnapshot(versionsDirOf(rootDir, artifactId));

    const meta = expectOk(await store.artifacts.setHead("checkout-flow", artifactId, 1));

    expect(meta.headVersion).toBe(1);
    expect(await dirSnapshot(versionsDirOf(rootDir, artifactId))).toEqual(before);
    expect(
      expectOk(await store.artifacts.get("checkout-flow", artifactId)).headVersion,
    ).toBe(1);
  });

  it("setHead transitions null → 1 → N and validates the target version", async () => {
    const { store, artifactId } = await withVersions(3);
    expect(
      expectOk(await store.artifacts.get("checkout-flow", artifactId)).headVersion,
    ).toBeNull();

    expect(
      expectOk(await store.artifacts.setHead("checkout-flow", artifactId, 1)).headVersion,
    ).toBe(1);
    expect(
      expectOk(await store.artifacts.setHead("checkout-flow", artifactId, 3)).headVersion,
    ).toBe(3);

    // A missing target leaves the pointer unchanged.
    expectFail(await store.artifacts.setHead("checkout-flow", artifactId, 9), "not_found");
    expect(
      expectOk(await store.artifacts.get("checkout-flow", artifactId)).headVersion,
    ).toBe(3);
  });

  it("a corrupt file in one version degrades only that version", async () => {
    const { store, rootDir, artifactId } = await withVersions(3);
    await writeFile(
      path.join(versionsDirOf(rootDir, artifactId), "0002", "version.yaml"),
      "{ broken [\n",
    );
    await writeFile(
      path.join(versionsDirOf(rootDir, artifactId), "0002", "wireframe.spec.yaml"),
      "{ broken [\n",
    );

    // Siblings and artifact metadata read fine.
    expectOk(await store.artifacts.get("checkout-flow", artifactId));
    expectOk(await store.artifacts.readSpec("checkout-flow", artifactId, 1));
    expectOk(await store.artifacts.readSpec("checkout-flow", artifactId, 3));
    // The damaged version reads as corrupt and is skipped in listings.
    expectFail(await store.artifacts.readSpec("checkout-flow", artifactId, 2), "corrupt");
    const listed = expectOk(await store.artifacts.listVersions("checkout-flow", artifactId));
    expect(listed.map((meta) => meta.number)).toEqual([1, 3]);
    // setHead to a healthy version recovers the canvas.
    expect(
      expectOk(await store.artifacts.setHead("checkout-flow", artifactId, 3)).headVersion,
    ).toBe(3);
  });
});
