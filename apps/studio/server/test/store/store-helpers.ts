/**
 * Store test composition helpers — every suite runs against a real temp
 * directory (architecture testing policy: no filesystem mocks).
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import type { StoreError, StoreErrorCode, StoreResult } from "@studio/contract";

import {
  createWorkspaceStore,
  type AtomicWriteHooks,
  type WorkspaceStoreHandle,
} from "../../src/store/index.js";
import { captureLogger, makeTempDir, type CapturedLogger } from "../helpers.js";

export interface StoreFixture {
  /** Store root — a `workspaces` directory that does not exist yet. */
  rootDir: string;
  /** Parent temp directory, for nothing-written-outside-the-root checks. */
  parentDir: string;
  store: WorkspaceStoreHandle;
  log: CapturedLogger;
}

export function makeStore(
  options: { hooks?: AtomicWriteHooks; rootDir?: string } = {},
): StoreFixture {
  const parentDir = makeTempDir("studio-store");
  const rootDir = options.rootDir ?? path.join(parentDir, "workspaces");
  const log = captureLogger("debug");
  const store = createWorkspaceStore(
    { rootDir, ...(options.hooks !== undefined ? { hooks: options.hooks } : {}) },
    log.logger,
  );
  return { rootDir, parentDir, store, log };
}

/** Unwrap an ok result or fail the test with the error. */
export function expectOk<T>(result: StoreResult<T>, label = "result"): T {
  if (!result.ok) {
    throw new Error(
      `expected ok ${label}, got ${result.error.code}: ${result.error.message}`,
    );
  }
  return result.value;
}

/** Unwrap a failed result, optionally asserting the error code. */
export function expectFail<T>(
  result: StoreResult<T>,
  code?: StoreErrorCode,
  label = "result",
): StoreError {
  if (result.ok) {
    throw new Error(`expected failed ${label}, got ok`);
  }
  if (code !== undefined && result.error.code !== code) {
    throw new Error(
      `expected ${label} error code "${code}", got "${result.error.code}": ${result.error.message}`,
    );
  }
  return result.error;
}

/** Recursive relative-path → content snapshot for byte-identity assertions. */
export async function dirSnapshot(dir: string): Promise<Record<string, string>> {
  const snapshot: Record<string, string> = {};
  async function walk(current: string, prefix: string): Promise<void> {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      const rel = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) {
        await walk(fullPath, rel);
      } else {
        snapshot[rel] = await readFile(fullPath, "utf8");
      }
    }
  }
  await walk(dir, "");
  return snapshot;
}
