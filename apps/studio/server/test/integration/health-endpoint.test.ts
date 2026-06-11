import { rmSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import type { HealthResponse } from "@studio/contract";

import {
  createStatusRegistry,
  type StatusRegistry,
} from "../../src/health/status-registry.js";
import { buildServer, type StudioServer } from "../../src/server/create-server.js";
import { baseUrl, captureLogger, testConfig } from "../helpers.js";

let active: { server: StudioServer; repoRoot: string } | undefined;

async function startServer(configure?: (registry: StatusRegistry) => void) {
  const captured = captureLogger();
  const config = testConfig();
  const registry = createStatusRegistry({
    logger: captured.logger,
    providerTimeoutMs: 200,
  });
  configure?.(registry);
  const server = buildServer({
    config,
    logger: captured.logger,
    statusRegistry: registry,
  });
  await server.start();
  active = { server, repoRoot: config.repoRoot };
  return server;
}

afterEach(async () => {
  if (active !== undefined) {
    await active.server.shutdown("test complete");
    rmSync(active.repoRoot, { recursive: true, force: true });
    active = undefined;
  }
});

async function getHealth(server: StudioServer): Promise<{
  status: number;
  body: HealthResponse;
}> {
  const response = await fetch(`${baseUrl(server)}/api/health`);
  return { status: response.status, body: (await response.json()) as HealthResponse };
}

describe("GET /api/health", () => {
  it("answers 200 ok with process info and unregistered placeholders on a fresh Wave 1 server", async () => {
    const server = await startServer();
    const { status, body } = await getHealth(server);

    expect(status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.process.pid).toBe(process.pid);
    expect(body.process.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(body.process.version).toBe(process.version);
    expect(body.bridge.status).toBe("unregistered");
    expect(body.store.status).toBe("unregistered");
    expect(body.auth.status).toBe("unregistered");
  });

  it("flips component fields when providers register, without degrading on healthy statuses", async () => {
    const server = await startServer((registry) => {
      registry.register("bridge", async () => ({ status: "up" }));
      registry.register("store", async () => ({ status: "ok" }));
      registry.register("auth", async () => ({ status: "configured" }));
    });
    const { body } = await getHealth(server);

    expect(body.status).toBe("ok");
    expect(body.bridge.status).toBe("up");
    expect(body.store.status).toBe("ok");
    expect(body.auth.status).toBe("configured");
  });

  it("degrades overall status when a registered provider reports unhealthy", async () => {
    const server = await startServer((registry) => {
      registry.register("bridge", async () => ({
        status: "failed",
        detail: "subprocess exited",
      }));
    });
    const { status, body } = await getHealth(server);

    expect(status).toBe(200);
    expect(body.status).toBe("degraded");
    expect(body.bridge.detail).toBe("subprocess exited");
    expect(body.store.status).toBe("unregistered");
  });

  it("isolates a throwing provider — only its component is unavailable; still 200", async () => {
    const server = await startServer((registry) => {
      registry.register("store", async () => {
        throw new Error("store exploded");
      });
      registry.register("bridge", async () => ({ status: "up" }));
    });
    const { status, body } = await getHealth(server);

    expect(status).toBe(200);
    expect(body.status).toBe("degraded");
    expect(body.store).toEqual({ status: "unavailable", detail: "store exploded" });
    expect(body.bridge.status).toBe("up");
  });

  it("times out a hanging provider and answers within the bounded budget", async () => {
    const server = await startServer((registry) => {
      registry.register("auth", () => new Promise(() => undefined));
    });

    const startedAt = Date.now();
    const { status, body } = await getHealth(server);
    const elapsed = Date.now() - startedAt;

    expect(status).toBe(200);
    expect(body.status).toBe("degraded");
    expect(body.auth.status).toBe("unavailable");
    expect(body.auth.detail).toContain("200ms");
    expect(elapsed).toBeLessThan(2000);
  });
});
