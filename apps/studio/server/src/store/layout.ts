/**
 * On-disk layout — the single place path composition exists (binding "Data
 * on disk" layout in _planning/architecture.md). Every function takes ids
 * that have already passed slug validation; nothing outside the store root
 * is ever composed.
 *
 * ```
 * <rootDir>/
 *   preferences.yaml
 *   <workspace-id>/
 *     workspace.yaml
 *     transcript.yaml
 *     artifacts/<artifact-id>/
 *       artifact.yaml
 *       versions/<NNNN>/
 *         wireframe.svg
 *         wireframe.spec.yaml
 *         compliance.yaml
 *         version.yaml
 * ```
 */
import path from "node:path";

export const TRASH_PREFIX = ".trash-";
export const WORKSPACE_FILE = "workspace.yaml";
export const TRANSCRIPT_FILE = "transcript.yaml";
export const PREFERENCES_FILE = "preferences.yaml";
export const ARTIFACTS_DIR = "artifacts";
export const ARTIFACT_FILE = "artifact.yaml";
export const VERSIONS_DIR = "versions";
export const VERSION_FILE = "version.yaml";
export const SVG_FILE = "wireframe.svg";
export const SPEC_FILE = "wireframe.spec.yaml";
export const COMPLIANCE_FILE = "compliance.yaml";

/** Zero-padded version directory names: at least 4 digits, growing past 9999. */
const VERSION_DIR_PATTERN = /^\d{4,}$/;

export function workspaceDir(rootDir: string, workspaceId: string): string {
  return path.join(rootDir, workspaceId);
}

export function trashDir(rootDir: string, workspaceId: string): string {
  return path.join(rootDir, `${TRASH_PREFIX}${workspaceId}`);
}

export function workspaceFile(rootDir: string, workspaceId: string): string {
  return path.join(rootDir, workspaceId, WORKSPACE_FILE);
}

export function transcriptFile(rootDir: string, workspaceId: string): string {
  return path.join(rootDir, workspaceId, TRANSCRIPT_FILE);
}

export function preferencesFile(rootDir: string): string {
  return path.join(rootDir, PREFERENCES_FILE);
}

export function artifactsDir(rootDir: string, workspaceId: string): string {
  return path.join(rootDir, workspaceId, ARTIFACTS_DIR);
}

export function artifactDir(
  rootDir: string,
  workspaceId: string,
  artifactId: string,
): string {
  return path.join(rootDir, workspaceId, ARTIFACTS_DIR, artifactId);
}

export function artifactFile(
  rootDir: string,
  workspaceId: string,
  artifactId: string,
): string {
  return path.join(artifactDir(rootDir, workspaceId, artifactId), ARTIFACT_FILE);
}

export function versionsDir(
  rootDir: string,
  workspaceId: string,
  artifactId: string,
): string {
  return path.join(artifactDir(rootDir, workspaceId, artifactId), VERSIONS_DIR);
}

/** Zero-padding is a minimum width, not a cap — 10000 grows naturally. */
export function versionDirName(version: number): string {
  return String(version).padStart(4, "0");
}

export function versionDir(
  rootDir: string,
  workspaceId: string,
  artifactId: string,
  version: number,
): string {
  return path.join(
    versionsDir(rootDir, workspaceId, artifactId),
    versionDirName(version),
  );
}

/** Parse a directory entry name as a version number; null when not one. */
export function parseVersionDirName(name: string): number | null {
  if (!VERSION_DIR_PATTERN.test(name)) {
    return null;
  }
  return Number.parseInt(name, 10);
}

/** Store-root-relative path for error messages. */
export function relPath(rootDir: string, absolutePath: string): string {
  return path.relative(rootDir, absolutePath);
}
