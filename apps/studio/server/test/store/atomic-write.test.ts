/**
 * Atomic write primitive — crash-window and rename-atomicity tests against
 * a real temp directory.
 */
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  TEMP_PREFIX,
  atomicWriteFile,
  sweepOrphans,
  tempPathFor,
} from "../../src/store/atomic-write.js";
import { captureLogger, makeTempDir } from "../helpers.js";

describe("atomicWriteFile", () => {
  it("writes new file content", async () => {
    const dir = makeTempDir("atomic");
    const target = path.join(dir, "doc.yaml");

    await atomicWriteFile(target, "hello: world\n");

    expect(await readFile(target, "utf8")).toBe("hello: world\n");
  });

  it("replaces existing content atomically and leaves no temp file behind", async () => {
    const dir = makeTempDir("atomic");
    const target = path.join(dir, "doc.yaml");
    await atomicWriteFile(target, "first: 1\n");

    await atomicWriteFile(target, "second: 2\n");

    expect(await readFile(target, "utf8")).toBe("second: 2\n");
    const names = await readdir(dir);
    expect(names).toEqual(["doc.yaml"]);
  });

  it("stages the temp file in the target's own directory", () => {
    const temp = tempPathFor("/store/ws/workspace.yaml");
    expect(path.dirname(temp)).toBe("/store/ws");
    expect(path.basename(temp).startsWith(TEMP_PREFIX)).toBe(true);
  });

  it("crash between temp write and rename leaves the target intact with prior content", async () => {
    const dir = makeTempDir("atomic");
    const target = path.join(dir, "doc.yaml");
    await atomicWriteFile(target, "saved: content\n");

    await expect(
      atomicWriteFile(target, "interrupted: true\n", {
        beforeRename: () => {
          throw new Error("simulated crash");
        },
      }),
    ).rejects.toThrow("simulated crash");

    // The rename never executed: the target holds the complete prior
    // content; only a .tmp- sibling remains.
    expect(await readFile(target, "utf8")).toBe("saved: content\n");
    const names = await readdir(dir);
    const orphans = names.filter((name) => name.startsWith(TEMP_PREFIX));
    expect(orphans).toHaveLength(1);
    expect(names).toContain("doc.yaml");
  });

  it("crash before the first write leaves no target file at all", async () => {
    const dir = makeTempDir("atomic");
    const target = path.join(dir, "doc.yaml");

    await expect(
      atomicWriteFile(target, "never: lands\n", {
        beforeRename: () => {
          throw new Error("simulated crash");
        },
      }),
    ).rejects.toThrow("simulated crash");

    const names = await readdir(dir);
    expect(names.filter((name) => !name.startsWith(TEMP_PREFIX))).toEqual([]);
  });
});

describe("sweepOrphans", () => {
  it("removes orphaned temp files and staging directories recursively and logs the sweep", async () => {
    const root = makeTempDir("sweep");
    const wsDir = path.join(root, "checkout-flow");
    const versionsDir = path.join(wsDir, "artifacts", "checkout", "versions");
    await mkdir(versionsDir, { recursive: true });
    await writeFile(path.join(root, `${TEMP_PREFIX}preferences.yaml-ab12`), "x");
    await writeFile(path.join(wsDir, `${TEMP_PREFIX}transcript.yaml-cd34`), "x");
    const stagingDir = path.join(versionsDir, `${TEMP_PREFIX}0001-ef56`);
    await mkdir(stagingDir);
    await writeFile(path.join(stagingDir, "wireframe.svg"), "<svg/>");
    await writeFile(path.join(wsDir, "workspace.yaml"), "id: checkout-flow\n");

    const { logger, lines } = captureLogger("debug");
    const swept = await sweepOrphans(root, logger);

    expect(swept).toBe(3);
    const remaining = await readdir(root);
    expect(remaining.some((name) => name.startsWith(TEMP_PREFIX))).toBe(false);
    expect(await readdir(versionsDir)).toEqual([]);
    // Real data is never swept.
    expect(await readFile(path.join(wsDir, "workspace.yaml"), "utf8")).toBe(
      "id: checkout-flow\n",
    );
    const sweepLogs = lines().filter((line) =>
      String(line.msg).includes("swept orphaned temp entry"),
    );
    expect(sweepLogs).toHaveLength(3);
  });

  it("is a no-op on a clean tree", async () => {
    const root = makeTempDir("sweep");
    await mkdir(path.join(root, "ws"), { recursive: true });

    const { logger } = captureLogger("debug");
    expect(await sweepOrphans(root, logger)).toBe(0);
  });
});
