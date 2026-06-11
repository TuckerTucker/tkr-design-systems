/**
 * Workspaces CRUD — GET/POST /api/workspaces, GET/PATCH/DELETE
 * /api/workspaces/:wsId. Auto-naming when the create request omits a name
 * ("Untitled Workspace N" — the user is never forced to invent one);
 * DELETE is workspace-store's soft-delete (trash-prefixed, recoverable).
 */
import type {
  WorkspaceMeta,
  WorkspacePatch,
  WorkspaceRepository,
  WorkspaceSettings,
  WorkspaceSummary,
} from "@studio/contract";
import type { FastifyInstance } from "fastify";

import type { Logger } from "../../logging/create-logger.js";
import { errorResponse, fromStoreError, httpStatusFor } from "../errors.js";
import {
  validateSlugParam,
  validateWorkspaceCreate,
  validateWorkspacePatch,
} from "../validation.js";

export interface WorkspaceRouteDeps {
  workspaces: WorkspaceRepository;
  logger: Logger;
}

const UNTITLED_BASE = "Untitled Workspace";
const UNTITLED_PATTERN = /^Untitled Workspace(?: (\d+))?$/;

function toSummary(meta: WorkspaceMeta): WorkspaceSummary {
  return {
    id: meta.id,
    name: meta.name,
    created: meta.created,
    updated: meta.updated,
    ...(meta.activeArtifactId !== null
      ? { activeArtifactId: meta.activeArtifactId }
      : {}),
    settings: meta.settings as WorkspaceSettings,
  };
}

export function registerWorkspaceRoutes(
  app: FastifyInstance,
  deps: WorkspaceRouteDeps,
): void {
  const log = deps.logger.child({ component: "api-workspaces" });

  app.get("/api/workspaces", async (_request, reply) => {
    const listed = await deps.workspaces.list();
    if (!listed.ok) {
      const error = fromStoreError(listed.error);
      return reply.code(httpStatusFor(error.code)).send(errorResponse(error));
    }
    const summaries: WorkspaceSummary[] = [];
    for (const entry of listed.value) {
      if (entry.ok) {
        summaries.push(toSummary(entry.workspace));
      } else {
        // Per-item degradation: a corrupt workspace.yaml costs that entry,
        // never the listing.
        log.warn({ workspaceId: entry.id, error: entry.error }, "workspace entry degraded");
      }
    }
    return reply.send(summaries);
  });

  app.post("/api/workspaces", async (request, reply) => {
    const body = validateWorkspaceCreate(request.body);
    if (!body.ok) {
      return reply.code(httpStatusFor(body.error.code)).send(errorResponse(body.error));
    }

    let name = body.value.name;
    if (name === undefined) {
      // Auto-naming: smallest "Untitled Workspace N" above every existing N.
      const listed = await deps.workspaces.list();
      let highest = 0;
      if (listed.ok) {
        for (const entry of listed.value) {
          if (!entry.ok) {
            continue;
          }
          const match = UNTITLED_PATTERN.exec(entry.workspace.name);
          if (match !== null) {
            highest = Math.max(highest, match[1] !== undefined ? Number(match[1]) : 1);
          }
        }
      }
      name = `${UNTITLED_BASE} ${highest + 1}`;
    }

    const created = await deps.workspaces.create(name);
    if (!created.ok) {
      const error = fromStoreError(created.error);
      return reply.code(httpStatusFor(error.code)).send(errorResponse(error));
    }
    return reply.code(201).send(toSummary(created.value));
  });

  app.get<{ Params: { wsId: string } }>(
    "/api/workspaces/:wsId",
    async (request, reply) => {
      const wsId = validateSlugParam(request.params.wsId, "wsId");
      if (!wsId.ok) {
        return reply.code(httpStatusFor(wsId.error.code)).send(errorResponse(wsId.error));
      }
      const meta = await deps.workspaces.get(wsId.value);
      if (!meta.ok) {
        const error = fromStoreError(meta.error);
        return reply.code(httpStatusFor(error.code)).send(errorResponse(error));
      }
      return reply.send(toSummary(meta.value));
    },
  );

  app.patch<{ Params: { wsId: string } }>(
    "/api/workspaces/:wsId",
    async (request, reply) => {
      const wsId = validateSlugParam(request.params.wsId, "wsId");
      if (!wsId.ok) {
        return reply.code(httpStatusFor(wsId.error.code)).send(errorResponse(wsId.error));
      }
      const body = validateWorkspacePatch(request.body);
      if (!body.ok) {
        return reply.code(httpStatusFor(body.error.code)).send(errorResponse(body.error));
      }
      const patch: WorkspacePatch = {
        ...(body.value.name !== undefined ? { name: body.value.name } : {}),
        ...(body.value.settings !== undefined
          ? { settings: body.value.settings as Record<string, unknown> }
          : {}),
      };
      const updated = await deps.workspaces.update(wsId.value, patch);
      if (!updated.ok) {
        const error = fromStoreError(updated.error);
        return reply.code(httpStatusFor(error.code)).send(errorResponse(error));
      }
      return reply.send(toSummary(updated.value));
    },
  );

  app.delete<{ Params: { wsId: string } }>(
    "/api/workspaces/:wsId",
    async (request, reply) => {
      const wsId = validateSlugParam(request.params.wsId, "wsId");
      if (!wsId.ok) {
        return reply.code(httpStatusFor(wsId.error.code)).send(errorResponse(wsId.error));
      }
      const deleted = await deps.workspaces.softDelete(wsId.value);
      if (!deleted.ok) {
        const error = fromStoreError(deleted.error);
        return reply.code(httpStatusFor(error.code)).send(errorResponse(error));
      }
      return reply.code(204).send();
    },
  );
}
