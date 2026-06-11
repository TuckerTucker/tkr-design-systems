/**
 * WorkspaceRepository — workspace lifecycle over <workspace-id>/workspace.yaml.
 *
 * Listing scans one workspace.yaml per directory (bounded by workspace
 * count); .trash- directories are excluded and recoverable; a corrupt
 * workspace.yaml degrades exactly that entry. Soft delete is a directory
 * rename — contents untouched, deletion immediately undoable.
 */
import { mkdir, readdir, rename, stat } from "node:fs/promises";

import type {
  StoreResult,
  WorkspaceListEntry,
  WorkspaceMeta,
  WorkspacePatch,
  WorkspaceRepository,
} from "@studio/contract";

import type { StoreContext } from "./context.js";
import {
  conflict,
  corrupt,
  fail,
  fromFsError,
  hasErrnoCode,
  notFound,
  ok,
} from "./errors.js";
import {
  TRASH_PREFIX,
  relPath,
  trashDir,
  workspaceDir,
  workspaceFile,
} from "./layout.js";
import { allocateSlug, isValidSlug, slugify } from "./slug.js";
import { readYamlFile, writeYamlFile } from "./yaml-io.js";

const SLUG_FALLBACK = "workspace";
const CREATE_QUEUE_KEY = "workspaces:create";

function nowIso(): string {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validate a parsed workspace.yaml; shape mismatch degrades as corrupt. */
function parseWorkspaceMeta(
  doc: unknown,
  fileRelPath: string,
): StoreResult<WorkspaceMeta> {
  if (!isRecord(doc)) {
    return fail(corrupt(fileRelPath, "expected a YAML mapping"));
  }
  for (const field of ["id", "name", "created", "updated"] as const) {
    if (typeof doc[field] !== "string") {
      return fail(corrupt(fileRelPath, `missing or invalid "${field}" field`));
    }
  }
  const activeArtifactId = doc.activeArtifactId;
  if (activeArtifactId !== undefined && activeArtifactId !== null && typeof activeArtifactId !== "string") {
    return fail(corrupt(fileRelPath, 'invalid "activeArtifactId" field'));
  }
  const settings = doc.settings;
  if (settings !== undefined && settings !== null && !isRecord(settings)) {
    return fail(corrupt(fileRelPath, 'invalid "settings" field'));
  }
  return ok({
    id: doc.id as string,
    name: doc.name as string,
    created: doc.created as string,
    updated: doc.updated as string,
    activeArtifactId: typeof activeArtifactId === "string" ? activeArtifactId : null,
    settings: isRecord(settings) ? settings : {},
  });
}

export function createWorkspaceRepository(
  ctx: StoreContext,
): WorkspaceRepository {
  const logger = ctx.logger.child({ repository: "workspaces" });

  async function readMeta(id: string): Promise<StoreResult<WorkspaceMeta>> {
    const filePath = workspaceFile(ctx.rootDir, id);
    const fileRelPath = relPath(ctx.rootDir, filePath);
    const doc = await readYamlFile(filePath, fileRelPath);
    if (!doc.ok) {
      if (doc.error.code === "not_found") {
        return fail(notFound(`Workspace "${id}" not found`, fileRelPath));
      }
      return doc;
    }
    return parseWorkspaceMeta(doc.value, fileRelPath);
  }

  async function writeMeta(meta: WorkspaceMeta): Promise<StoreResult<void>> {
    const filePath = workspaceFile(ctx.rootDir, meta.id);
    return writeYamlFile(
      filePath,
      meta,
      relPath(ctx.rootDir, filePath),
      ctx.hooks,
    );
  }

  /** Live (non-trash, slug-valid) workspace directory names at the root. */
  async function liveDirNames(): Promise<StoreResult<string[]>> {
    try {
      const entries = await readdir(ctx.rootDir, { withFileTypes: true });
      return ok(
        entries
          .filter((entry) => entry.isDirectory() && isValidSlug(entry.name))
          .map((entry) => entry.name)
          .sort(),
      );
    } catch (err) {
      return fail(fromFsError(err, `Cannot scan store root ${ctx.rootDir}`));
    }
  }

  async function exists(dirPath: string): Promise<boolean> {
    try {
      await stat(dirPath);
      return true;
    } catch {
      return false;
    }
  }

  return {
    async list(): Promise<StoreResult<WorkspaceListEntry[]>> {
      const ready = await ctx.init();
      if (!ready.ok) {
        return ready;
      }
      const names = await liveDirNames();
      if (!names.ok) {
        return names;
      }
      const entries: WorkspaceListEntry[] = [];
      for (const name of names.value) {
        const meta = await readMeta(name);
        if (meta.ok) {
          entries.push({ ok: true, workspace: meta.value });
        } else {
          logger.warn(
            { workspaceId: name, code: meta.error.code, path: meta.error.path },
            "workspace entry degraded",
          );
          entries.push({ ok: false, id: name, error: meta.error });
        }
      }
      return ok(entries);
    },

    async create(name: string): Promise<StoreResult<WorkspaceMeta>> {
      // Serialize slug allocation so concurrent creates never collide.
      return ctx.queue.run(CREATE_QUEUE_KEY, async () => {
        const ready = await ctx.init();
        if (!ready.ok) {
          return ready;
        }
        const names = await liveDirNames();
        if (!names.ok) {
          return names;
        }
        const id = allocateSlug(
          slugify(name, SLUG_FALLBACK),
          new Set(names.value),
        );
        const dirPath = workspaceDir(ctx.rootDir, id);
        try {
          await mkdir(dirPath);
        } catch (err) {
          return fail(
            fromFsError(err, `Cannot create workspace directory for "${id}"`, id),
          );
        }
        const stamp = nowIso();
        const meta: WorkspaceMeta = {
          id,
          name,
          created: stamp,
          updated: stamp,
          activeArtifactId: null,
          settings: {},
        };
        const written = await writeMeta(meta);
        if (!written.ok) {
          return written;
        }
        logger.info({ workspaceId: id }, "workspace created");
        return ok(meta);
      });
    },

    async get(id: string): Promise<StoreResult<WorkspaceMeta>> {
      const ready = await ctx.init();
      if (!ready.ok) {
        return ready;
      }
      if (!isValidSlug(id)) {
        return fail(notFound(`Workspace "${id}" not found`));
      }
      return readMeta(id);
    },

    async update(
      id: string,
      patch: WorkspacePatch,
    ): Promise<StoreResult<WorkspaceMeta>> {
      if (!isValidSlug(id)) {
        return fail(notFound(`Workspace "${id}" not found`));
      }
      // Serialize per workspace.yaml so concurrent patches never interleave.
      return ctx.queue.run(workspaceFile(ctx.rootDir, id), async () => {
        const ready = await ctx.init();
        if (!ready.ok) {
          return ready;
        }
        const current = await readMeta(id);
        if (!current.ok) {
          return current;
        }
        const meta: WorkspaceMeta = {
          ...current.value,
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...("activeArtifactId" in patch
            ? { activeArtifactId: patch.activeArtifactId ?? null }
            : {}),
          ...(patch.settings !== undefined ? { settings: patch.settings } : {}),
          updated: nowIso(),
        };
        const written = await writeMeta(meta);
        if (!written.ok) {
          return written;
        }
        logger.info({ workspaceId: id }, "workspace updated");
        return ok(meta);
      });
    },

    async softDelete(id: string): Promise<StoreResult<void>> {
      const ready = await ctx.init();
      if (!ready.ok) {
        return ready;
      }
      if (!isValidSlug(id)) {
        return fail(notFound(`Workspace "${id}" not found`));
      }
      const livePath = workspaceDir(ctx.rootDir, id);
      const trashPath = trashDir(ctx.rootDir, id);
      if (!(await exists(livePath))) {
        return fail(notFound(`Workspace "${id}" not found`, id));
      }
      if (await exists(trashPath)) {
        return fail(
          conflict(
            `Cannot delete workspace "${id}": ${TRASH_PREFIX}${id} already exists in the store root. Remove or rename that directory first.`,
            `${TRASH_PREFIX}${id}`,
          ),
        );
      }
      try {
        await rename(livePath, trashPath);
      } catch (err) {
        return fail(fromFsError(err, `Cannot delete workspace "${id}"`, id));
      }
      logger.info({ workspaceId: id }, "workspace soft-deleted");
      return ok(undefined);
    },

    async listDeleted(): Promise<StoreResult<string[]>> {
      const ready = await ctx.init();
      if (!ready.ok) {
        return ready;
      }
      try {
        const entries = await readdir(ctx.rootDir, { withFileTypes: true });
        return ok(
          entries
            .filter(
              (entry) =>
                entry.isDirectory() && entry.name.startsWith(TRASH_PREFIX),
            )
            .map((entry) => entry.name.slice(TRASH_PREFIX.length))
            .filter((id) => isValidSlug(id))
            .sort(),
        );
      } catch (err) {
        return fail(fromFsError(err, `Cannot scan store root ${ctx.rootDir}`));
      }
    },

    async restore(id: string): Promise<StoreResult<WorkspaceMeta>> {
      const ready = await ctx.init();
      if (!ready.ok) {
        return ready;
      }
      if (!isValidSlug(id)) {
        return fail(notFound(`Workspace "${id}" not found in trash`));
      }
      const livePath = workspaceDir(ctx.rootDir, id);
      const trashPath = trashDir(ctx.rootDir, id);
      if (!(await exists(trashPath))) {
        return fail(
          notFound(`Workspace "${id}" not found in trash`, `${TRASH_PREFIX}${id}`),
        );
      }
      if (await exists(livePath)) {
        return fail(
          conflict(
            `Cannot restore workspace "${id}": a live workspace already uses that id. Rename or delete it, then restore from ${TRASH_PREFIX}${id}.`,
            `${TRASH_PREFIX}${id}`,
          ),
        );
      }
      try {
        await rename(trashPath, livePath);
      } catch (err) {
        if (hasErrnoCode(err, "ENOTEMPTY") || hasErrnoCode(err, "EEXIST")) {
          return fail(
            conflict(
              `Cannot restore workspace "${id}": a live workspace already uses that id. Rename or delete it, then restore from ${TRASH_PREFIX}${id}.`,
              `${TRASH_PREFIX}${id}`,
            ),
          );
        }
        return fail(fromFsError(err, `Cannot restore workspace "${id}"`, id));
      }
      logger.info({ workspaceId: id }, "workspace restored from trash");
      return readMeta(id);
    },
  };
}
