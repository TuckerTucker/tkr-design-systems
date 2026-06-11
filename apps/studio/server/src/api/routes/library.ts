/**
 * Library routes — read-only proxies over the mcp-bridge direct-call tools
 * with the registry-invalidated response cache:
 *
 *   GET /api/library/systems                      ds_list_systems
 *   GET /api/library/:systemId/tokens             wf_get_tokens
 *   GET /api/library/:systemId/components         component index (ds_load_system)
 *   GET /api/library/:systemId/components/:id     wf_read_component
 *   GET /api/library/:systemId/layouts            layout templates (ds_load_system)
 *
 * Cache discipline: hits never touch the bridge — warm entries keep
 * serving through a bridge outage; cold requests with the bridge down
 * return a structured 503. No MCP tool with write semantics is exposed.
 */
import type {
  BridgeResult,
  ComponentDetail,
  ComponentIndexEntry,
  LayoutTemplate,
  LibrarySystem,
  TokenSetResponse,
} from "@studio/contract";
import type { FastifyInstance, FastifyReply } from "fastify";

import type { McpBridge } from "../../mcp/index.js";
import type { LoadedSystemSpec } from "../../mcp/types.js";
import type { Logger } from "../../logging/create-logger.js";
import {
  apiError,
  errorResponse,
  fromBridgeError,
  httpStatusFor,
} from "../errors.js";
import type { LibraryCache } from "../library-cache.js";
import { validateSlugParam } from "../validation.js";

export interface LibraryRouteDeps {
  bridge: McpBridge;
  cache: LibraryCache;
  logger: Logger;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** "list_item" → "List Item". */
function humanize(id: string): string {
  return id
    .split(/[_-]/)
    .filter((part) => part !== "")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function componentIndexFromSpec(spec: LoadedSystemSpec): ComponentIndexEntry[] {
  if (!isRecord(spec.components)) {
    return [];
  }
  const index: ComponentIndexEntry[] = [];
  for (const [id, entry] of Object.entries(spec.components)) {
    const variants: string[] = [];
    if (isRecord(entry) && Array.isArray(entry["variants"])) {
      for (const variant of entry["variants"]) {
        if (isRecord(variant) && typeof variant["id"] === "string") {
          variants.push(variant["id"]);
        }
      }
    }
    index.push({ id, name: humanize(id), variants });
  }
  return index;
}

function layoutsFromSpec(spec: LoadedSystemSpec): LayoutTemplate[] {
  const source = spec["layout_templates"] ?? spec.layouts;
  if (!isRecord(source)) {
    return [];
  }
  const layouts: LayoutTemplate[] = [];
  for (const [id, entry] of Object.entries(source)) {
    const description =
      isRecord(entry) && typeof entry["description"] === "string"
        ? entry["description"]
        : undefined;
    const platforms =
      isRecord(entry) && Array.isArray(entry["platforms"])
        ? entry["platforms"].filter(
            (p): p is "mobile" | "desktop" => p === "mobile" || p === "desktop",
          )
        : [];
    layouts.push({
      id,
      name: humanize(id),
      archetype: id,
      platforms: platforms.length > 0 ? platforms : ["mobile", "desktop"],
      ...(description !== undefined ? { description } : {}),
    });
  }
  return layouts;
}

export function registerLibraryRoutes(
  app: FastifyInstance,
  deps: LibraryRouteDeps,
): void {
  const log = deps.logger.child({ component: "api-library" });

  function sendBridgeFailure(
    reply: FastifyReply,
    error: Parameters<typeof fromBridgeError>[0],
  ): FastifyReply {
    const mapped = fromBridgeError(error);
    return reply.code(httpStatusFor(mapped.code)).send(errorResponse(mapped));
  }

  /**
   * Cache-through helper: serve the cached payload when warm; otherwise
   * call the bridge, project, cache, and serve. Bridge failures map to
   * 404/503 structured errors — warm entries never reach this branch.
   */
  async function cacheThrough<TRaw, TResponse>(
    reply: FastifyReply,
    key: string,
    call: () => Promise<BridgeResult<TRaw>>,
    project: (value: TRaw) => TResponse,
  ): Promise<FastifyReply> {
    const cached = deps.cache.get<TResponse>(key);
    if (cached !== undefined) {
      log.debug({ key }, "library cache hit");
      return reply.send(cached);
    }
    const result = await call();
    if (!result.ok) {
      return sendBridgeFailure(reply, result.error);
    }
    const response = project(result.value);
    deps.cache.set(key, response);
    return reply.send(response);
  }

  /** Load (and cache) the full system spec — components/layouts share it. */
  async function loadSpec(
    systemId: string,
  ): Promise<
    | { ok: true; spec: LoadedSystemSpec }
    | { ok: false; error: Parameters<typeof fromBridgeError>[0] }
  > {
    const key = `spec:${systemId}`;
    const cached = deps.cache.get<LoadedSystemSpec>(key);
    if (cached !== undefined) {
      return { ok: true, spec: cached };
    }
    const loaded = await deps.bridge.loadSystem({ systemId });
    if (!loaded.ok) {
      return { ok: false, error: loaded.error };
    }
    deps.cache.set(key, loaded.value);
    return { ok: true, spec: loaded.value };
  }

  app.get("/api/library/systems", async (_request, reply) => {
    return cacheThrough(
      reply,
      "systems",
      () => deps.bridge.listSystems(),
      (systems): LibrarySystem[] =>
        systems.map((system) => ({
          id: system.id,
          name: system.name,
          ...(system.tagline !== "" ? { tagline: system.tagline } : {}),
          status: system.status,
        })),
    );
  });

  app.get<{ Params: { systemId: string } }>(
    "/api/library/:systemId/tokens",
    async (request, reply) => {
      const systemId = validateSlugParam(request.params.systemId, "systemId");
      if (!systemId.ok) {
        return reply
          .code(httpStatusFor(systemId.error.code))
          .send(errorResponse(systemId.error));
      }
      return cacheThrough(
        reply,
        `tokens:${systemId.value}`,
        () => deps.bridge.getTokens({ systemId: systemId.value }),
        (tokens): TokenSetResponse => ({
          systemId: systemId.value,
          tokens: tokens as unknown as Record<string, unknown>,
        }),
      );
    },
  );

  app.get<{ Params: { systemId: string } }>(
    "/api/library/:systemId/components",
    async (request, reply) => {
      const systemId = validateSlugParam(request.params.systemId, "systemId");
      if (!systemId.ok) {
        return reply
          .code(httpStatusFor(systemId.error.code))
          .send(errorResponse(systemId.error));
      }
      const key = `components:${systemId.value}`;
      const cached = deps.cache.get<ComponentIndexEntry[]>(key);
      if (cached !== undefined) {
        return reply.send(cached);
      }
      const spec = await loadSpec(systemId.value);
      if (!spec.ok) {
        return sendBridgeFailure(reply, spec.error);
      }
      const index = componentIndexFromSpec(spec.spec);
      deps.cache.set(key, index);
      return reply.send(index);
    },
  );

  app.get<{ Params: { systemId: string; componentId: string } }>(
    "/api/library/:systemId/components/:componentId",
    async (request, reply) => {
      const systemId = validateSlugParam(request.params.systemId, "systemId");
      if (!systemId.ok) {
        return reply
          .code(httpStatusFor(systemId.error.code))
          .send(errorResponse(systemId.error));
      }
      const componentId = validateSlugParam(
        request.params.componentId,
        "componentId",
      );
      if (!componentId.ok) {
        return reply
          .code(httpStatusFor(componentId.error.code))
          .send(errorResponse(componentId.error));
      }
      const key = `component:${systemId.value}:${componentId.value}`;
      const cached = deps.cache.get<ComponentDetail>(key);
      if (cached !== undefined) {
        return reply.send(cached);
      }

      const spec = await loadSpec(systemId.value);
      if (!spec.ok) {
        return sendBridgeFailure(reply, spec.error);
      }
      const index = componentIndexFromSpec(spec.spec);
      const entry = index.find((candidate) => candidate.id === componentId.value);
      if (entry === undefined) {
        const error = apiError(
          "component_not_found",
          `System "${systemId.value}" has no component "${componentId.value}".`,
          `List components via GET /api/library/${systemId.value}/components.`,
        );
        return reply.code(httpStatusFor(error.code)).send(errorResponse(error));
      }

      const read = await deps.bridge.readComponent({
        systemId: systemId.value,
        componentId: componentId.value,
      });
      if (!read.ok) {
        return sendBridgeFailure(reply, read.error);
      }
      const detail: ComponentDetail = { ...entry, svg: read.value.svg_source };
      deps.cache.set(key, detail);
      return reply.send(detail);
    },
  );

  app.get<{ Params: { systemId: string } }>(
    "/api/library/:systemId/layouts",
    async (request, reply) => {
      const systemId = validateSlugParam(request.params.systemId, "systemId");
      if (!systemId.ok) {
        return reply
          .code(httpStatusFor(systemId.error.code))
          .send(errorResponse(systemId.error));
      }
      const key = `layouts:${systemId.value}`;
      const cached = deps.cache.get<LayoutTemplate[]>(key);
      if (cached !== undefined) {
        return reply.send(cached);
      }
      const spec = await loadSpec(systemId.value);
      if (!spec.ok) {
        return sendBridgeFailure(reply, spec.error);
      }
      const layouts = layoutsFromSpec(spec.spec);
      deps.cache.set(key, layouts);
      return reply.send(layouts);
    },
  );
}
