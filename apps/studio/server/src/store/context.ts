/**
 * Shared store context — everything a repository implementation needs,
 * assembled once by createWorkspaceStore and injected (IoC). Repositories
 * never resolve configuration or construct their own infrastructure.
 */
import { mkdir, stat } from "node:fs/promises";

import { sweepOrphans, type AtomicWriteHooks } from "./atomic-write.js";
import { fail, ioError, ok, type StoreResult } from "./errors.js";
import type { KeyedQueue } from "./keyed-queue.js";
import type { Logger } from "../logging/create-logger.js";

export interface StoreContext {
  /** Absolute store root (StudioConfig.workspacesDir). */
  rootDir: string;
  logger: Logger;
  queue: KeyedQueue;
  /** Test-only fault injection, threaded into every atomic write. */
  hooks: AtomicWriteHooks;
  /**
   * Ensure the root exists and orphaned temp entries are swept. Memoized:
   * the work runs once per store on first use; a failure resets the memo so
   * subsequent calls retry naturally.
   */
  init(): Promise<StoreResult<void>>;
}

export interface StoreContextOptions {
  rootDir: string;
  logger: Logger;
  queue: KeyedQueue;
  hooks?: AtomicWriteHooks;
}

export function createStoreContext(options: StoreContextOptions): StoreContext {
  const { rootDir, logger, queue, hooks = {} } = options;

  let initPromise: Promise<StoreResult<void>> | undefined;

  async function initialize(): Promise<StoreResult<void>> {
    try {
      await mkdir(rootDir, { recursive: true });
      const rootStat = await stat(rootDir);
      if (!rootStat.isDirectory()) {
        return fail(
          ioError(
            `Store root ${rootDir} exists but is not a directory. Move the file aside or point STUDIO_WORKSPACES_DIR elsewhere.`,
          ),
        );
      }
      const swept = await sweepOrphans(rootDir, logger);
      logger.info({ rootDir, swept }, "workspace store initialized");
      return ok(undefined);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      logger.error({ rootDir, err }, "workspace store initialization failed");
      return fail(
        ioError(
          `Cannot initialize store root ${rootDir}: ${detail}. Check the path and its permissions, or set STUDIO_WORKSPACES_DIR to a writable location.`,
          err,
        ),
      );
    }
  }

  return {
    rootDir,
    logger,
    queue,
    hooks,
    init(): Promise<StoreResult<void>> {
      initPromise ??= initialize().then((result) => {
        if (!result.ok) {
          initPromise = undefined; // retry on the next call
        }
        return result;
      });
      return initPromise;
    },
  };
}
