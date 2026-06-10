import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createStatusRegistry } from "../../src/health/status-registry.js";
import { buildServer, type StudioServer } from "../../src/server/create-server.js";
import { CLIENT_BUILD_COMMAND } from "../../src/static/client-hosting.js";
import {
  baseUrl,
  captureLogger,
  makeTempDir,
  testConfig,
  type CapturedLogger,
} from "../helpers.js";

const INDEX_HTML = "<!doctype html><title>studio client</title><div id=root></div>";

function makeBuiltDist(): string {
  const dist = makeTempDir("studio-dist");
  writeFileSync(path.join(dist, "index.html"), INDEX_HTML);
  mkdirSync(path.join(dist, "assets"));
  writeFileSync(
    path.join(dist, "assets", "app-Bx3kQ9aZ.js"),
    "console.log('studio');",
  );
  return dist;
}

let active:
  | { server: StudioServer; repoRoot: string; dist: string; captured: CapturedLogger }
  | undefined;

async function startServer(clientDistDir: string) {
  const captured = captureLogger();
  const config = testConfig({ clientDistDir });
  const server = buildServer({
    config,
    logger: captured.logger,
    statusRegistry: createStatusRegistry({ logger: captured.logger }),
  });
  await server.start();
  active = { server, repoRoot: config.repoRoot, dist: clientDistDir, captured };
  return { server, captured };
}

afterEach(async () => {
  if (active !== undefined) {
    await active.server.shutdown("test complete");
    rmSync(active.repoRoot, { recursive: true, force: true });
    rmSync(active.dist, { recursive: true, force: true });
    active = undefined;
  }
});

describe("static hosting with a built client", () => {
  it("serves index.html at / with no-cache", async () => {
    const { server } = await startServer(makeBuiltDist());
    const response = await fetch(`${baseUrl(server)}/`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(INDEX_HTML);
    expect(response.headers.get("cache-control")).toBe("no-cache");
  });

  it("serves hashed assets with immutable cache headers", async () => {
    const { server } = await startServer(makeBuiltDist());
    const response = await fetch(`${baseUrl(server)}/assets/app-Bx3kQ9aZ.js`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
  });

  it("falls back to index.html for extensionless client routes (SPA refresh)", async () => {
    const { server } = await startServer(makeBuiltDist());
    const response = await fetch(`${baseUrl(server)}/workspace/my-project`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(INDEX_HTML);
    expect(response.headers.get("cache-control")).toBe("no-cache");
  });

  it("returns 404 (not index.html) for missing paths with a file extension", async () => {
    const { server } = await startServer(makeBuiltDist());
    const response = await fetch(`${baseUrl(server)}/logo-missing.png`);
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("Not Found");
  });

  it("gives /api precedence over the SPA fallback — JSON 404 for unknown API routes", async () => {
    const { server } = await startServer(makeBuiltDist());

    const health = await fetch(`${baseUrl(server)}/api/health`);
    expect(health.headers.get("content-type")).toContain("application/json");

    const unknown = await fetch(`${baseUrl(server)}/api/unknown`);
    expect(unknown.status).toBe(404);
    expect(unknown.headers.get("content-type")).toContain("application/json");
    expect(await unknown.text()).not.toContain("studio client");
  });
});

describe("static hosting without a client build", () => {
  it("serves a plain instruction page at / naming the build command, with a startup warning", async () => {
    const missingDist = path.join(makeTempDir("studio-nodist"), "dist");
    const { server, captured } = await startServer(missingDist);

    const response = await fetch(`${baseUrl(server)}/`);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain(CLIENT_BUILD_COMMAND);

    const warning = captured
      .lines()
      .find((line) => String(line.msg ?? "").includes("client build not found"));
    expect(warning).toBeDefined();
  });

  it("keeps /api/health fully functional and 404s other paths", async () => {
    const missingDist = path.join(makeTempDir("studio-nodist"), "dist");
    const { server } = await startServer(missingDist);

    const health = await fetch(`${baseUrl(server)}/api/health`);
    expect(health.status).toBe(200);

    const route = await fetch(`${baseUrl(server)}/workspace/my-project`);
    expect(route.status).toBe(404);
  });

  it("treats a dist directory without index.html (partial build) as missing", async () => {
    const partial = makeTempDir("studio-partial");
    writeFileSync(path.join(partial, "stale.js"), "// leftover");
    const { server } = await startServer(partial);

    const response = await fetch(`${baseUrl(server)}/`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain(CLIENT_BUILD_COMMAND);
  });
});
