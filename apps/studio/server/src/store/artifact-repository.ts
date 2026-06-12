/**
 * ArtifactRepository — artifacts/<artifact-id>/artifact.yaml plus immutable
 * zero-padded version directories (versions/0001, 0002, …).
 *
 * Storage mechanics only: artifact-pipeline owns when versions exist and
 * when the head pointer moves; the store owns how they land on disk. A
 * version lands as a unit — files staged in a `.tmp-` sibling directory,
 * then a single rename — so a crash never leaves a directory that passes
 * for complete. Version directories are never rewritten or deleted;
 * setHead rewrites only artifact.yaml.
 */
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  ArtifactMeta,
  ArtifactRepository,
  NewArtifactInput,
  NewVersionInput,
  StoreResult,
  VersionMeta,
} from "@studio/contract";

import { TEMP_PREFIX, tempPathFor } from "./atomic-write.js";
import type { StoreContext } from "./context.js";
import {
  corrupt,
  fail,
  fromFsError,
  ioError,
  notFound,
  ok,
} from "./errors.js";
import {
  COMPLIANCE_FILE,
  SPEC_FILE,
  SVG_FILE,
  VERSION_FILE,
  artifactDir,
  artifactFile,
  artifactsDir,
  parseVersionDirName,
  relPath,
  versionDir,
  versionDirName,
  versionsDir,
  workspaceDir,
} from "./layout.js";
import { allocateSlug, isValidSlug, slugify } from "./slug.js";
import { readYamlFile, toYaml, writeYamlFile } from "./yaml-io.js";

const SLUG_FALLBACK = "artifact";
const PLATFORMS: readonly string[] = ["mobile", "desktop"];

function nowIso(): string {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseArtifactMeta(
  doc: unknown,
  fileRelPath: string,
): StoreResult<ArtifactMeta> {
  if (!isRecord(doc)) {
    return fail(corrupt(fileRelPath, "expected a YAML mapping"));
  }
  for (const field of ["id", "name", "system", "created", "updated"] as const) {
    if (typeof doc[field] !== "string") {
      return fail(corrupt(fileRelPath, `missing or invalid "${field}" field`));
    }
  }
  if (typeof doc.platform !== "string" || !PLATFORMS.includes(doc.platform)) {
    return fail(corrupt(fileRelPath, 'missing or invalid "platform" field'));
  }
  const headVersion = doc.headVersion;
  if (
    headVersion !== null &&
    headVersion !== undefined &&
    !(Number.isInteger(headVersion) && (headVersion as number) >= 1)
  ) {
    return fail(corrupt(fileRelPath, 'invalid "headVersion" field'));
  }
  return ok({
    id: doc.id as string,
    name: doc.name as string,
    system: doc.system as string,
    platform: doc.platform as ArtifactMeta["platform"],
    headVersion: typeof headVersion === "number" ? headVersion : null,
    created: doc.created as string,
    updated: doc.updated as string,
  });
}

function parseVersionMeta(
  doc: unknown,
  fileRelPath: string,
): StoreResult<VersionMeta> {
  if (!isRecord(doc)) {
    return fail(corrupt(fileRelPath, "expected a YAML mapping"));
  }
  if (!(Number.isInteger(doc.number) && (doc.number as number) >= 1)) {
    return fail(corrupt(fileRelPath, 'missing or invalid "number" field'));
  }
  const parentVersion = doc.parentVersion;
  if (
    parentVersion !== null &&
    parentVersion !== undefined &&
    !(Number.isInteger(parentVersion) && (parentVersion as number) >= 1)
  ) {
    return fail(corrupt(fileRelPath, 'invalid "parentVersion" field'));
  }
  for (const field of ["brief", "tool", "created"] as const) {
    if (typeof doc[field] !== "string") {
      return fail(corrupt(fileRelPath, `missing or invalid "${field}" field`));
    }
  }
  return ok({
    number: doc.number as number,
    parentVersion: typeof parentVersion === "number" ? parentVersion : null,
    brief: doc.brief as string,
    tool: doc.tool as string,
    parameters: isRecord(doc.parameters) ? doc.parameters : {},
    created: doc.created as string,
  });
}

function isValidVersionNumber(version: number): boolean {
  return Number.isInteger(version) && version >= 1;
}

export function createArtifactRepository(ctx: StoreContext): ArtifactRepository {
  const logger = ctx.logger.child({ repository: "artifacts" });

  async function isDirectory(dirPath: string): Promise<boolean> {
    try {
      return (await stat(dirPath)).isDirectory();
    } catch {
      return false;
    }
  }

  /** init + workspace and (optionally) artifact id/grammar guards. */
  async function guard(
    workspaceId: string,
    artifactId?: string,
  ): Promise<StoreResult<void>> {
    const ready = await ctx.init();
    if (!ready.ok) {
      return ready;
    }
    if (
      !isValidSlug(workspaceId) ||
      !(await isDirectory(workspaceDir(ctx.rootDir, workspaceId)))
    ) {
      return fail(notFound(`Workspace "${workspaceId}" not found`));
    }
    if (artifactId !== undefined && !isValidSlug(artifactId)) {
      return fail(notFound(`Artifact "${artifactId}" not found`));
    }
    return ok(undefined);
  }

  async function readMeta(
    workspaceId: string,
    artifactId: string,
  ): Promise<StoreResult<ArtifactMeta>> {
    const filePath = artifactFile(ctx.rootDir, workspaceId, artifactId);
    const fileRelPath = relPath(ctx.rootDir, filePath);
    const doc = await readYamlFile(filePath, fileRelPath);
    if (!doc.ok) {
      if (doc.error.code === "not_found") {
        return fail(
          notFound(
            `Artifact "${artifactId}" not found in workspace "${workspaceId}"`,
            fileRelPath,
          ),
        );
      }
      return doc;
    }
    return parseArtifactMeta(doc.value, fileRelPath);
  }

  async function writeMeta(
    workspaceId: string,
    meta: ArtifactMeta,
  ): Promise<StoreResult<void>> {
    const filePath = artifactFile(ctx.rootDir, workspaceId, meta.id);
    return writeYamlFile(filePath, meta, relPath(ctx.rootDir, filePath), ctx.hooks);
  }

  /** Existing version numbers from the versions/ directory listing. */
  async function listVersionNumbers(
    workspaceId: string,
    artifactId: string,
  ): Promise<StoreResult<number[]>> {
    const dirPath = versionsDir(ctx.rootDir, workspaceId, artifactId);
    let entries;
    try {
      entries = await readdir(dirPath, { withFileTypes: true });
    } catch (err) {
      const error = fromFsError(err, `Cannot scan ${relPath(ctx.rootDir, dirPath)}`);
      if (error.code === "not_found") {
        return ok([]); // no versions yet
      }
      return fail(error);
    }
    const numbers: number[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const parsed = parseVersionDirName(entry.name);
      if (parsed !== null) {
        numbers.push(parsed);
      }
    }
    return ok(numbers.sort((a, b) => a - b));
  }

  /** Guard that the addressed version directory exists. */
  async function guardVersion(
    workspaceId: string,
    artifactId: string,
    version: number,
  ): Promise<StoreResult<string>> {
    if (!isValidVersionNumber(version)) {
      return fail(
        notFound(`Version ${version} of artifact "${artifactId}" not found`),
      );
    }
    const dirPath = versionDir(ctx.rootDir, workspaceId, artifactId, version);
    if (!(await isDirectory(dirPath))) {
      return fail(
        notFound(
          `Version ${version} of artifact "${artifactId}" not found`,
          relPath(ctx.rootDir, dirPath),
        ),
      );
    }
    return ok(dirPath);
  }

  return {
    async list(workspaceId: string): Promise<StoreResult<ArtifactMeta[]>> {
      const guarded = await guard(workspaceId);
      if (!guarded.ok) {
        return guarded;
      }
      const dirPath = artifactsDir(ctx.rootDir, workspaceId);
      let entries;
      try {
        entries = await readdir(dirPath, { withFileTypes: true });
      } catch (err) {
        const error = fromFsError(err, `Cannot scan ${relPath(ctx.rootDir, dirPath)}`);
        if (error.code === "not_found") {
          return ok([]); // no artifacts yet
        }
        return fail(error);
      }
      const metas: ArtifactMeta[] = [];
      for (const entry of entries) {
        if (!entry.isDirectory() || !isValidSlug(entry.name)) {
          continue;
        }
        const meta = await readMeta(workspaceId, entry.name);
        if (meta.ok) {
          metas.push(meta.value);
        } else {
          // Per-item degradation: a damaged artifact.yaml costs that
          // artifact in the listing; get() surfaces the typed error.
          logger.warn(
            { workspaceId, artifactId: entry.name, path: meta.error.path },
            "artifact entry skipped in listing (degraded)",
          );
        }
      }
      return ok(metas.sort((a, b) => a.id.localeCompare(b.id)));
    },

    async create(
      workspaceId: string,
      init: NewArtifactInput,
    ): Promise<StoreResult<ArtifactMeta>> {
      const guarded = await guard(workspaceId);
      if (!guarded.ok) {
        return guarded;
      }
      const parentDir = artifactsDir(ctx.rootDir, workspaceId);
      // Serialize slug allocation per workspace.
      return ctx.queue.run(parentDir, async () => {
        try {
          await mkdir(parentDir, { recursive: true });
        } catch (err) {
          return fail(
            fromFsError(err, `Cannot create ${relPath(ctx.rootDir, parentDir)}`),
          );
        }
        let taken: Set<string>;
        try {
          const entries = await readdir(parentDir, { withFileTypes: true });
          taken = new Set(
            entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name),
          );
        } catch (err) {
          return fail(
            fromFsError(err, `Cannot scan ${relPath(ctx.rootDir, parentDir)}`),
          );
        }
        const id = allocateSlug(slugify(init.name, SLUG_FALLBACK), taken);
        const dirPath = artifactDir(ctx.rootDir, workspaceId, id);
        try {
          await mkdir(dirPath);
        } catch (err) {
          return fail(
            fromFsError(err, `Cannot create artifact directory for "${id}"`),
          );
        }
        const stamp = nowIso();
        const meta: ArtifactMeta = {
          id,
          name: init.name,
          system: init.system,
          platform: init.platform,
          headVersion: null,
          created: stamp,
          updated: stamp,
        };
        const written = await writeMeta(workspaceId, meta);
        if (!written.ok) {
          return written;
        }
        logger.info({ workspaceId, artifactId: id }, "artifact created");
        return ok(meta);
      });
    },

    async get(
      workspaceId: string,
      artifactId: string,
    ): Promise<StoreResult<ArtifactMeta>> {
      const guarded = await guard(workspaceId, artifactId);
      if (!guarded.ok) {
        return guarded;
      }
      return readMeta(workspaceId, artifactId);
    },

    async listVersions(
      workspaceId: string,
      artifactId: string,
    ): Promise<StoreResult<VersionMeta[]>> {
      const guarded = await guard(workspaceId, artifactId);
      if (!guarded.ok) {
        return guarded;
      }
      const artifact = await readMeta(workspaceId, artifactId);
      if (!artifact.ok) {
        return artifact;
      }
      const numbers = await listVersionNumbers(workspaceId, artifactId);
      if (!numbers.ok) {
        return numbers;
      }
      const versions: VersionMeta[] = [];
      for (const number of numbers.value) {
        const filePath = path.join(
          versionDir(ctx.rootDir, workspaceId, artifactId, number),
          VERSION_FILE,
        );
        const fileRelPath = relPath(ctx.rootDir, filePath);
        const doc = await readYamlFile(filePath, fileRelPath);
        const meta = doc.ok ? parseVersionMeta(doc.value, fileRelPath) : doc;
        if (meta.ok) {
          versions.push(meta.value);
        } else {
          // Per-item degradation: the damaged version is skipped here and
          // surfaces its typed error on direct reads by number.
          logger.warn(
            { workspaceId, artifactId, version: number, path: fileRelPath },
            "version entry skipped in listing (degraded)",
          );
        }
      }
      return ok(versions);
    },

    async createVersion(
      workspaceId: string,
      artifactId: string,
      input: NewVersionInput,
    ): Promise<StoreResult<VersionMeta>> {
      const guarded = await guard(workspaceId, artifactId);
      if (!guarded.ok) {
        return guarded;
      }
      const artifact = await readMeta(workspaceId, artifactId);
      if (!artifact.ok) {
        return artifact;
      }
      const parentDir = versionsDir(ctx.rootDir, workspaceId, artifactId);
      // Serialize allocation + landing per artifact: concurrent creates get
      // sequential numbers with no duplicates and no contention gaps.
      return ctx.queue.run(parentDir, async () => {
        try {
          await mkdir(parentDir, { recursive: true });
        } catch (err) {
          return fail(
            fromFsError(err, `Cannot create ${relPath(ctx.rootDir, parentDir)}`),
          );
        }
        const numbers = await listVersionNumbers(workspaceId, artifactId);
        if (!numbers.ok) {
          return numbers;
        }
        // Next is max + 1 — never gap-filling for hand-deleted directories.
        const number = (numbers.value[numbers.value.length - 1] ?? 0) + 1;
        const targetDir = path.join(parentDir, versionDirName(number));
        const stagingDir = tempPathFor(targetDir);
        const meta: VersionMeta = {
          number,
          parentVersion: input.provenance.parentVersion,
          brief: input.provenance.brief,
          tool: input.provenance.tool,
          parameters: input.provenance.parameters,
          created: nowIso(),
        };
        const specText =
          typeof input.spec === "string" ? input.spec : toYaml(input.spec);
        try {
          await mkdir(stagingDir);
          await writeFile(path.join(stagingDir, SVG_FILE), input.svg, "utf8");
          await writeFile(path.join(stagingDir, SPEC_FILE), specText, "utf8");
          await writeFile(path.join(stagingDir, VERSION_FILE), toYaml(meta), "utf8");
        } catch (err) {
          // Incomplete staging never becomes versions/<NNNN>/ — remove it
          // and report; the number is reallocated on the next attempt.
          await rm(stagingDir, { recursive: true, force: true });
          return fail(
            fromFsError(
              err,
              `Cannot stage version ${number} of artifact "${artifactId}"`,
              relPath(ctx.rootDir, targetDir),
            ),
          );
        }
        if (ctx.hooks.beforeRename !== undefined) {
          try {
            await ctx.hooks.beforeRename(targetDir);
          } catch (err) {
            // Simulated crash inside the window: the staging directory is
            // left behind exactly as a real crash would leave it (the
            // startup sweep removes it); the target never appeared.
            return fail(
              ioError(
                `Version write interrupted before landing (${TEMP_PREFIX} staging directory left for the startup sweep)`,
                err,
                relPath(ctx.rootDir, targetDir),
              ),
            );
          }
        }
        try {
          await rename(stagingDir, targetDir);
        } catch (err) {
          await rm(stagingDir, { recursive: true, force: true });
          return fail(
            fromFsError(
              err,
              `Cannot land version ${number} of artifact "${artifactId}"`,
              relPath(ctx.rootDir, targetDir),
            ),
          );
        }
        logger.info(
          { workspaceId, artifactId, version: number, tool: meta.tool },
          "artifact version created",
        );
        return ok(meta);
      });
    },

    async readSvg(
      workspaceId: string,
      artifactId: string,
      version: number,
    ): Promise<StoreResult<string>> {
      const guarded = await guard(workspaceId, artifactId);
      if (!guarded.ok) {
        return guarded;
      }
      const dir = await guardVersion(workspaceId, artifactId, version);
      if (!dir.ok) {
        return dir;
      }
      const filePath = path.join(dir.value, SVG_FILE);
      try {
        return ok(await readFile(filePath, "utf8"));
      } catch (err) {
        return fail(
          fromFsError(
            err,
            `Cannot read ${relPath(ctx.rootDir, filePath)}`,
            relPath(ctx.rootDir, filePath),
          ),
        );
      }
    },

    async readSpec(
      workspaceId: string,
      artifactId: string,
      version: number,
    ): Promise<StoreResult<unknown>> {
      const guarded = await guard(workspaceId, artifactId);
      if (!guarded.ok) {
        return guarded;
      }
      const dir = await guardVersion(workspaceId, artifactId, version);
      if (!dir.ok) {
        return dir;
      }
      const filePath = path.join(dir.value, SPEC_FILE);
      return readYamlFile(filePath, relPath(ctx.rootDir, filePath));
    },

    async readCompliance(
      workspaceId: string,
      artifactId: string,
      version: number,
    ): Promise<StoreResult<unknown>> {
      const guarded = await guard(workspaceId, artifactId);
      if (!guarded.ok) {
        return guarded;
      }
      const dir = await guardVersion(workspaceId, artifactId, version);
      if (!dir.ok) {
        return dir;
      }
      const filePath = path.join(dir.value, COMPLIANCE_FILE);
      const result = await readYamlFile(filePath, relPath(ctx.rootDir, filePath));
      if (!result.ok && result.error.code === "not_found") {
        // Distinct from corrupt: the pipeline may not have delivered it yet.
        return fail(
          notFound(
            `Compliance report for version ${version} of artifact "${artifactId}" has not been delivered yet`,
            relPath(ctx.rootDir, filePath),
          ),
        );
      }
      return result;
    },

    async writeCompliance(
      workspaceId: string,
      artifactId: string,
      version: number,
      report: unknown,
    ): Promise<StoreResult<void>> {
      const guarded = await guard(workspaceId, artifactId);
      if (!guarded.ok) {
        return guarded;
      }
      const dir = await guardVersion(workspaceId, artifactId, version);
      if (!dir.ok) {
        return dir;
      }
      const filePath = path.join(dir.value, COMPLIANCE_FILE);
      const written = await writeYamlFile(
        filePath,
        report,
        relPath(ctx.rootDir, filePath),
        ctx.hooks,
      );
      if (written.ok) {
        logger.info(
          { workspaceId, artifactId, version },
          "compliance report attached",
        );
      }
      return written;
    },

    async setHead(
      workspaceId: string,
      artifactId: string,
      version: number,
    ): Promise<StoreResult<ArtifactMeta>> {
      const guarded = await guard(workspaceId, artifactId);
      if (!guarded.ok) {
        return guarded;
      }
      const filePath = artifactFile(ctx.rootDir, workspaceId, artifactId);
      // Serialize per artifact.yaml so concurrent pointer moves never race.
      return ctx.queue.run(filePath, async () => {
        const current = await readMeta(workspaceId, artifactId);
        if (!current.ok) {
          return current;
        }
        const dir = await guardVersion(workspaceId, artifactId, version);
        if (!dir.ok) {
          return dir;
        }
        const meta: ArtifactMeta = {
          ...current.value,
          headVersion: version,
          updated: nowIso(),
        };
        const written = await writeMeta(workspaceId, meta);
        if (!written.ok) {
          return written;
        }
        logger.info(
          { workspaceId, artifactId, headVersion: version },
          "artifact head moved",
        );
        return ok(meta);
      });
    },
  };
}
