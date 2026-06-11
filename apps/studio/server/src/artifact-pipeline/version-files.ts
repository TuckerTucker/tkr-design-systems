/**
 * Version file resolution seam — the pipeline never composes filesystem
 * paths itself (architecture contract: path logic lives in the store).
 * It receives this resolver via IoC; the default implementation delegates
 * to the store's layout module, so the on-disk truth has one home.
 *
 * Resolved paths are used for exactly two read-only purposes:
 * - the artifact_path handed to ds_check_compliance (store-resolved,
 *   never client-supplied)
 * - the verbatim spec text read during restore (byte-identical copies)
 */
import path from "node:path";

import { SPEC_FILE, SVG_FILE, versionDir } from "../store/layout.js";

export type VersionFileKind = "svg" | "spec";

/** Absolute path to a persisted version file. */
export type VersionFileResolver = (
  workspaceId: string,
  artifactId: string,
  version: number,
  file: VersionFileKind,
) => string;

/** Default resolver over the store root (StudioConfig.workspacesDir). */
export function createStoreVersionFileResolver(
  rootDir: string,
): VersionFileResolver {
  return (workspaceId, artifactId, version, file) =>
    path.join(
      versionDir(rootDir, workspaceId, artifactId, version),
      file === "svg" ? SVG_FILE : SPEC_FILE,
    );
}
