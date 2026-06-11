/**
 * Atomic write primitive — every store mutation writes a temp file (or
 * staging directory) inside the target's own directory, fsyncs, then
 * renames. A crash in the window leaves the target untouched and at most an
 * orphaned `.tmp-` entry, which the startup sweep removes. The
 * same-directory rename is a single filesystem operation with no
 * cross-device copy.
 */
import { randomBytes } from "node:crypto";
import { open, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";

import type { Logger } from "../logging/create-logger.js";

/** Orphan marker shared by temp files and version staging directories. */
export const TEMP_PREFIX = ".tmp-";

export interface AtomicWriteHooks {
  /**
   * Test-only fault injection: runs after the temp entry is durable and
   * before the rename. Throwing simulates a crash inside the window — the
   * target stays untouched and the orphaned temp entry remains for the
   * startup sweep, exactly as a real crash would leave it.
   */
  beforeRename?: (targetPath: string) => void | Promise<void>;
}

/** A unique sibling temp path for the given target. */
export function tempPathFor(targetPath: string): string {
  const dir = path.dirname(targetPath);
  const suffix = randomBytes(6).toString("hex");
  return path.join(
    dir,
    `${TEMP_PREFIX}${path.basename(targetPath)}-${suffix}`,
  );
}

/**
 * Write `content` to `targetPath` atomically. Rejects on filesystem
 * failure — callers above the repository seam translate rejections into
 * StoreResults.
 */
export async function atomicWriteFile(
  targetPath: string,
  content: string,
  hooks: AtomicWriteHooks = {},
): Promise<void> {
  const tempPath = tempPathFor(targetPath);
  const handle = await open(tempPath, "w");
  try {
    await handle.writeFile(content, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  if (hooks.beforeRename !== undefined) {
    await hooks.beforeRename(targetPath);
  }
  await rename(tempPath, targetPath);
}

/**
 * Remove orphaned `.tmp-` files and staging directories left by a crash.
 * Walks the whole store tree (including trashed workspaces); no orphan is
 * ever read as data, so sweeping is purely hygienic and always safe.
 *
 * @returns Number of orphaned entries removed.
 */
export async function sweepOrphans(
  rootDir: string,
  logger: Logger,
): Promise<number> {
  let swept = 0;

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return; // directory vanished or unreadable — nothing to sweep here
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.name.startsWith(TEMP_PREFIX)) {
        await rm(fullPath, { recursive: true, force: true });
        swept += 1;
        logger.warn(
          { path: fullPath },
          "swept orphaned temp entry left by an interrupted write",
        );
      } else if (entry.isDirectory()) {
        await walk(fullPath);
      }
    }
  }

  await walk(rootDir);
  logger.debug({ rootDir, swept }, "orphan sweep complete");
  return swept;
}
