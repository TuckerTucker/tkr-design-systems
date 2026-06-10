/**
 * workspace-store — plain-file persistence for everything the studio must
 * remember, behind the repository seam declared in @studio/contract.
 *
 * IoC factory: consumers (agent-orchestration, artifact-pipeline,
 * studio-api) receive the constructed WorkspaceStore and never compose
 * paths — path logic exists only inside this directory. The store root
 * comes from injected configuration (StudioConfig.workspacesDir), is
 * created on first use, and nothing outside it is ever written.
 *
 * Errors never cross the repository seam as exceptions: every method
 * resolves to a StoreResult.
 */
import type { StatusReport, WorkspaceStore } from "@studio/contract";

import type { AtomicWriteHooks } from "./atomic-write.js";
import { createArtifactRepository } from "./artifact-repository.js";
import { createStoreContext } from "./context.js";
import { createKeyedQueue } from "./keyed-queue.js";
import { createPreferencesRepository } from "./preferences-repository.js";
import { createTranscriptRepository } from "./transcript-repository.js";
import { createWorkspaceRepository } from "./workspace-repository.js";
import type { Logger } from "../logging/create-logger.js";

export { atomicWriteFile, sweepOrphans, TEMP_PREFIX, tempPathFor } from "./atomic-write.js";
export type { AtomicWriteHooks } from "./atomic-write.js";
export {
  conflict,
  corrupt,
  fail,
  fromFsError,
  hasErrnoCode,
  ioError,
  notFound,
  ok,
} from "./errors.js";
export type { StoreError, StoreErrorCode, StoreResult } from "./errors.js";
export { allocateSlug, isValidSlug, slugify } from "./slug.js";
export { readYamlFile, toYaml, writeYamlFile } from "./yaml-io.js";
export { TRASH_PREFIX, versionDirName } from "./layout.js";
export { createKeyedQueue } from "./keyed-queue.js";
export type { KeyedQueue } from "./keyed-queue.js";

export interface WorkspaceStoreOptions {
  /** Absolute store root — StudioConfig.workspacesDir; never hardcoded. */
  rootDir: string;
  /**
   * Test-only fault injection threaded into every atomic write; production
   * callers leave it unset.
   */
  hooks?: AtomicWriteHooks;
}

/**
 * The constructed store plus the status provider studio-server registers
 * on the health surface (StatusRegistry component "store").
 */
export interface WorkspaceStoreHandle extends WorkspaceStore {
  /**
   * Store health: "ok" with the root path once the root is initialized
   * (created if absent, orphaned temp entries swept), "failed" with the
   * actionable message otherwise. Suitable as a StatusProvider.
   */
  status(): Promise<StatusReport>;
}

/**
 * Construct the workspace store from configuration alone (IoC seam).
 *
 * Initialization is lazy and memoized: the first repository call (or
 * status query) creates the root and sweeps orphaned `.tmp-` entries left
 * by an interrupted write; a failed initialization is retried on the next
 * call.
 *
 * @param config - Store root (and test-only hooks).
 * @param logger - pino logger; each repository logs through a child.
 */
export function createWorkspaceStore(
  config: WorkspaceStoreOptions,
  logger: Logger,
): WorkspaceStoreHandle {
  const storeLogger = logger.child({ component: "store" });
  const ctx = createStoreContext({
    rootDir: config.rootDir,
    logger: storeLogger,
    queue: createKeyedQueue(),
    ...(config.hooks !== undefined ? { hooks: config.hooks } : {}),
  });

  return {
    workspaces: createWorkspaceRepository(ctx),
    transcripts: createTranscriptRepository(ctx),
    artifacts: createArtifactRepository(ctx),
    preferences: createPreferencesRepository(ctx),
    async status(): Promise<StatusReport> {
      const ready = await ctx.init();
      return ready.ok
        ? { status: "ok", detail: config.rootDir }
        : { status: "failed", detail: ready.error.message };
    },
  };
}
