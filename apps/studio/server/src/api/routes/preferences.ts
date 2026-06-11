/**
 * Preferences routes — GET/PUT /api/preferences with the LayoutPreference
 * document (preferences.ts, owned by docking-shell) persisted opaquely
 * through workspace-store. One shape on the wire and on disk.
 */
import type { LayoutPreference, PreferencesRepository } from "@studio/contract";
import type { FastifyInstance } from "fastify";

import type { Logger } from "../../logging/create-logger.js";
import { errorResponse, fromStoreError, httpStatusFor } from "../errors.js";
import { validatePreferences } from "../validation.js";

export interface PreferencesRouteDeps {
  preferences: PreferencesRepository;
  logger: Logger;
}

/**
 * Served before any PUT has happened — sensible defaults so the client
 * never has to branch on "no preferences yet". docking-shell refines its
 * own defaults in Phase 2; this document is shape-complete and harmless.
 */
export const DEFAULT_LAYOUT_PREFERENCE: LayoutPreference = {
  schemaVersion: 1,
  placements: [],
  activeTab: "library",
  railWidths: { left: 320, right: 360 },
  lastWorkspaceId: null,
};

export function registerPreferencesRoutes(
  app: FastifyInstance,
  deps: PreferencesRouteDeps,
): void {
  const log = deps.logger.child({ component: "api-preferences" });

  app.get("/api/preferences", async (_request, reply) => {
    const stored = await deps.preferences.get();
    if (!stored.ok) {
      const error = fromStoreError(stored.error);
      return reply.code(httpStatusFor(error.code)).send(errorResponse(error));
    }
    return reply.send(stored.value ?? DEFAULT_LAYOUT_PREFERENCE);
  });

  app.put("/api/preferences", async (request, reply) => {
    const body = validatePreferences(request.body);
    if (!body.ok) {
      return reply.code(httpStatusFor(body.error.code)).send(errorResponse(body.error));
    }
    const written = await deps.preferences.put(body.value);
    if (!written.ok) {
      const error = fromStoreError(written.error);
      return reply.code(httpStatusFor(error.code)).send(errorResponse(error));
    }
    log.debug("preferences persisted");
    return reply.send(body.value);
  });
}
