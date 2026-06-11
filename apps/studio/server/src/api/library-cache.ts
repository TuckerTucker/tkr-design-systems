/**
 * Library response cache — in-memory, keyed by route + systemId, fully
 * flushed when systems/registry.yaml changes.
 *
 * The bridge exposes no registry-change signal, so studio-api watches the
 * registry file directly (fs.watch, path from studio-server config). The
 * watch is best-effort: a missing registry file logs a warning and the
 * cache simply never invalidates until the next process start — bridge
 * calls still work, they are just not deduplicated against a registry that
 * does not exist.
 */
import { watch, type FSWatcher } from "node:fs";

import type { Logger } from "../logging/create-logger.js";

export interface LibraryCache {
  get<T>(key: string): T | undefined;
  set(key: string, value: unknown): void;
  /** Drop every entry (registry change). */
  flush(): void;
  /** Entry count — diagnostics and tests. */
  size(): number;
  /** Stop watching the registry. */
  close(): void;
}

export interface LibraryCacheOptions {
  /** Absolute path to systems/registry.yaml (from config.repoRoot). */
  registryPath: string;
  logger: Logger;
}

export function createLibraryCache(options: LibraryCacheOptions): LibraryCache {
  const log = options.logger.child({ component: "library-cache" });
  const entries = new Map<string, unknown>();

  let watcher: FSWatcher | undefined;
  try {
    watcher = watch(options.registryPath, { persistent: false }, () => {
      if (entries.size > 0) {
        log.info(
          { registryPath: options.registryPath, flushed: entries.size },
          "registry changed; library cache flushed",
        );
      }
      entries.clear();
    });
    watcher.on("error", (err) => {
      log.warn({ err }, "registry watch failed; cache invalidation disabled");
    });
  } catch (err) {
    log.warn(
      { registryPath: options.registryPath, err },
      "registry watch could not start; cache invalidation disabled",
    );
  }

  return {
    get: <T>(key: string) => entries.get(key) as T | undefined,
    set(key, value) {
      entries.set(key, value);
    },
    flush() {
      entries.clear();
    },
    size: () => entries.size,
    close() {
      watcher?.close();
    },
  };
}
