/**
 * Static hosting of the built Vite client.
 *
 * Behavior with a build present (clientDistDir contains index.html):
 * - assets served from clientDistDir (@fastify/static, traversal-safe)
 * - index.html served no-cache so new builds appear on reload
 * - files under assets/ (Vite's hashed output) served immutable
 * - SPA fallback: extensionless unknown GET paths serve index.html so
 *   client-side routes survive a refresh; /api and /ws never fall back
 * - unknown paths WITH a file extension are a real 404, not index.html
 *
 * Behavior without a build (the client arrives with docking-shell, Phase 2):
 * - GET / serves a plain instruction page naming the build command
 * - everything else 404s; /api and /ws are unaffected
 * - a warning is logged at startup
 *
 * Build presence is checked once at registration — index.html missing from
 * an existing dist directory (partial build) counts as missing.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { Logger } from "../logging/create-logger.js";

export const CLIENT_BUILD_COMMAND = "npm run build --workspace @studio/client";

const PLACEHOLDER_PAGE = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Studio</title></head>
<body>
<h1>Studio client not built</h1>
<p>The server is running, but no client build was found.</p>
<p>Build it with <code>${CLIENT_BUILD_COMMAND}</code> from the studio/ directory,
then reload. (The client package arrives with the docking-shell capability.)</p>
<p>The API is available either way — try <a href="/api/health">/api/health</a>.</p>
</body>
</html>
`;

export interface ClientHostingOptions {
  clientDistDir: string;
  logger: Logger;
}

function isApiOrWsPath(pathname: string): boolean {
  return (
    pathname === "/api" ||
    pathname.startsWith("/api/") ||
    pathname === "/ws" ||
    pathname.startsWith("/ws/")
  );
}

function send404(reply: FastifyReply, pathname: string): FastifyReply {
  return reply
    .code(404)
    .send({ error: "Not Found", statusCode: 404, path: pathname });
}

export function registerClientHosting(
  app: FastifyInstance,
  options: ClientHostingOptions,
): void {
  const { clientDistDir, logger } = options;
  const buildPresent = existsSync(path.join(clientDistDir, "index.html"));

  if (buildPresent) {
    app.register(fastifyStatic, {
      root: clientDistDir,
      wildcard: true,
      // cache-control is owned by setHeaders below — the plugin's built-in
      // cacheControl/maxAge would overwrite it.
      cacheControl: false,
      setHeaders: (res, filePath) => {
        if (path.basename(filePath) === "index.html") {
          res.setHeader("cache-control", "no-cache");
        } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          // Vite emits content-hashed filenames under assets/.
          res.setHeader("cache-control", "public, max-age=31536000, immutable");
        }
      },
    });
  } else {
    logger.warn(
      { clientDistDir, fix: CLIENT_BUILD_COMMAND },
      "client build not found; serving an instruction page at /",
    );
    app.get("/", (_request, reply) => {
      return reply
        .type("text/html; charset=utf-8")
        .header("cache-control", "no-cache")
        .send(PLACEHOLDER_PAGE);
    });
  }

  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    const pathname = (request.raw.url ?? "/").split("?")[0] ?? "/";

    // API and WS namespaces never fall back to the SPA; non-GETs are 404s.
    if (isApiOrWsPath(pathname) || request.method !== "GET") {
      return send404(reply, pathname);
    }

    // Paths with a file extension are missing assets, not client routes.
    if (path.extname(pathname) !== "") {
      return send404(reply, pathname);
    }

    if (!buildPresent) {
      return send404(reply, pathname);
    }

    // SPA fallback: let the client router resume the route after a refresh.
    return reply
      .type("text/html; charset=utf-8")
      .header("cache-control", "no-cache")
      .sendFile("index.html");
  });
}
