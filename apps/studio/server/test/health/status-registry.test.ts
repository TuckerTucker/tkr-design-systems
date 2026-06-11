import { describe, expect, it } from "vitest";

import { createStatusRegistry } from "../../src/health/status-registry.js";
import { captureLogger } from "../helpers.js";

function makeRegistry(providerTimeoutMs = 100) {
  const captured = captureLogger("debug");
  return {
    registry: createStatusRegistry({
      logger: captured.logger,
      providerTimeoutMs,
    }),
    captured,
  };
}

describe("status registry", () => {
  it("reports unregistered placeholders for all components before any provider exists", async () => {
    const { registry } = makeRegistry();
    const snapshot = await registry.snapshot();
    expect(snapshot.bridge.status).toBe("unregistered");
    expect(snapshot.store.status).toBe("unregistered");
    expect(snapshot.auth.status).toBe("unregistered");
  });

  it("resolves a registered provider's report", async () => {
    const { registry } = makeRegistry();
    registry.register("bridge", async () => ({ status: "up" }));
    const snapshot = await registry.snapshot();
    expect(snapshot.bridge).toEqual({ status: "up" });
    expect(snapshot.store.status).toBe("unregistered");
  });

  it("isolates a throwing provider as unavailable with the error message as detail", async () => {
    const { registry } = makeRegistry();
    registry.register("store", async () => {
      throw new Error("disk fell off");
    });
    registry.register("bridge", async () => ({ status: "up" }));
    const snapshot = await registry.snapshot();
    expect(snapshot.store.status).toBe("unavailable");
    expect(snapshot.store.detail).toBe("disk fell off");
    expect(snapshot.bridge.status).toBe("up");
  });

  it("isolates a synchronously-throwing provider the same way", async () => {
    const { registry } = makeRegistry();
    registry.register("auth", (() => {
      throw new Error("sync boom");
    }) as unknown as () => Promise<never>);
    const snapshot = await registry.snapshot();
    expect(snapshot.auth.status).toBe("unavailable");
    expect(snapshot.auth.detail).toBe("sync boom");
  });

  it("times out a hanging provider and keeps latency bounded", async () => {
    const { registry } = makeRegistry(100);
    registry.register("auth", () => new Promise(() => undefined));
    const startedAt = Date.now();
    const snapshot = await registry.snapshot();
    const elapsed = Date.now() - startedAt;
    expect(snapshot.auth.status).toBe("unavailable");
    expect(snapshot.auth.detail).toContain("100ms");
    expect(elapsed).toBeLessThan(1000);
  });

  it("replaces a provider on re-registration", async () => {
    const { registry } = makeRegistry();
    registry.register("auth", async () => ({ status: "missing" }));
    registry.register("auth", async () => ({ status: "configured" }));
    const snapshot = await registry.snapshot();
    expect(snapshot.auth.status).toBe("configured");
  });
});
