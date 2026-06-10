/**
 * Bridge lifecycle + typed-wrapper integration tests against the REAL
 * design-systems MCP server (testing policy: the server is never mocked).
 *
 * One shared bridge instance backs the suite (the python server takes a
 * moment to boot); tests that need their own lifecycle (not-started, stop,
 * drain) construct short-lived instances.
 */
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createMcpBridge, type McpBridge } from "../../src/mcp/bridge.js";
import { captureLogger } from "../helpers.js";
import { realBridgeConfig, realStudioConfig } from "./mcp-helpers.js";

const KNOWN_SYSTEMS = [
  "editorial",
  "prism",
  "revolt",
  "riso",
  "sketch",
  "swiss",
  "terminal",
  "wireframe",
];

const repoRoot = realStudioConfig().repoRoot;
const realSvgPath = path.join(
  repoRoot,
  "design-systems",
  "swiss-library",
  "components",
  "toggle-off.svg",
);

let bridge: McpBridge;

beforeAll(async () => {
  bridge = createMcpBridge(realBridgeConfig(), captureLogger().logger);
  await bridge.start();
  expect(bridge.status().state).toBe("up");
}, 30_000);

afterAll(async () => {
  await bridge.stop();
  expect(bridge.status().state).toBe("stopped");
}, 15_000);

describe("lifecycle (slice 1)", () => {
  it("start() spawned the real server, completed the handshake, and verified the six tools", () => {
    const status = bridge.status();
    expect(status.state).toBe("up");
    expect(status.restartCount).toBe(0);
    expect(status.since).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("resolves bridge_down for a call before start()", async () => {
    const cold = createMcpBridge(realBridgeConfig(), captureLogger().logger);
    const result = await cold.listSystems();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("bridge_down");
    }
    expect(cold.status().state).toBe("stopped");
  });
});

describe("typed wrappers (slice 4)", () => {
  it("listSystems returns every registered system with descriptor fields populated", async () => {
    const result = await bridge.listSystems();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);
    const ids = result.value.map((descriptor) => descriptor.id);
    for (const known of KNOWN_SYSTEMS) {
      expect(ids).toContain(known);
    }
    expect(result.value.length).toBeGreaterThanOrEqual(8);
    const swiss = result.value.find((descriptor) => descriptor.id === "swiss");
    expect(swiss).toBeDefined();
    expect(typeof swiss?.name).toBe("string");
    expect(typeof swiss?.tagline).toBe("string");
    expect(typeof swiss?.status).toBe("string");
    expect(swiss).toHaveProperty("grammar_family");
    expect(swiss).toHaveProperty("version");
    expect(swiss).toHaveProperty("spec_version");
  });

  it("loadSystem('swiss') returns the full normalized spec", async () => {
    const result = await bridge.loadSystem({ systemId: "swiss" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const spec = result.value;
    expect(spec.system["id"]).toBe("swiss");
    expect(spec.tokens).toBeTypeOf("object");
    expect(spec.components).toBeTypeOf("object");
    expect(Array.isArray(spec.rulebook)).toBe(true);
    expect(typeof spec._meta.library_root).toBe("string");
    expect(spec._meta.library_root.length).toBeGreaterThan(0);
  });

  it("loadSystem with an unknown id resolves a typed SYSTEM_NOT_FOUND tool error (slice 3)", async () => {
    const result = await bridge.loadSystem({ systemId: "no-such-system" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("tool");
    expect(result.error.code).toBe("SYSTEM_NOT_FOUND");
    expect(result.error.message).toContain("no-such-system");
    expect(result.error.detail?.["system_id"]).toBe("no-such-system");
  });

  it("getRulebook returns entries with the derived scope field", async () => {
    const result = await bridge.getRulebook({ systemId: "swiss" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.length).toBeGreaterThan(0);
    for (const entry of result.value) {
      expect(typeof entry.id).toBe("string");
      expect(typeof entry.rule).toBe("string");
      expect(["global", "component"]).toContain(entry.scope);
      if (entry.check_scope === "component") {
        expect(entry.scope).toBe("component");
      } else {
        expect(entry.scope).toBe("global");
      }
    }
  });

  it("getTokens('swiss') returns the authoring vocabulary", async () => {
    const result = await bridge.getTokens({ systemId: "swiss" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const tokens = result.value;
    expect(tokens.system_id).toBe("swiss");
    expect(tokens.palette.length).toBeGreaterThan(0);
    for (const entry of tokens.palette) {
      expect(typeof entry.name).toBe("string");
      expect(typeof entry.value).toBe("string");
      expect(typeof entry.role).toBe("string");
      expect(typeof entry.usage_constraint).toBe("string");
    }
    expect(tokens.drawing_rules).toBeTypeOf("object");
    expect(tokens.typography).toBeTypeOf("object");
    expect(tokens.layout).toBeTypeOf("object");
  });

  it("readComponent resolves a bare family id to the canonical default variant", async () => {
    const result = await bridge.readComponent({
      systemId: "wireframe",
      componentId: "toggle",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.component_id).toBe("toggle-default");
    expect(result.value.svg_source).toContain("<svg");
    expect(result.value.viewBox.w).toBeGreaterThan(0);
    expect(result.value.viewBox.h).toBeGreaterThan(0);
    expect(typeof result.value.tier).toBe("string");
  });

  it("readComponents returns one ComponentRead per requested id in order", async () => {
    const result = await bridge.readComponents({
      systemId: "wireframe",
      componentIds: ["toggle-default", "button-primary", "card-default"],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((component) => component.component_id)).toEqual([
      "toggle-default",
      "button-primary",
      "card-default",
    ]);
    for (const component of result.value) {
      expect(component.svg_source).toContain("<svg");
    }
  });

  it("readComponents with one unknown id fails the whole batch as one tool error", async () => {
    const result = await bridge.readComponents({
      systemId: "wireframe",
      componentIds: ["toggle-default", "no-such-component"],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("tool");
    expect(result.error.message).toContain("no-such-component");
    expect(result.error.detail?.["failures"]).toBeDefined();
  });

  it("checkCompliance on a real library SVG returns structured rule details", async () => {
    const result = await bridge.checkCompliance({
      systemId: "swiss",
      artifactPath: realSvgPath,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const compliance = result.value;
    expect(compliance.system_id).toBe("swiss");
    expect(compliance.ruleset).toBe("swiss");
    expect(compliance.mechanical_only).toBe(true);
    expect(compliance.passed + compliance.failed + compliance.advisory).toBe(
      compliance.results.length,
    );
    expect(compliance.results.length).toBeGreaterThan(0);
    for (const rule of compliance.results) {
      expect(typeof rule.rule_id).toBe("string");
      expect(["pass", "fail", "advisory"]).toContain(rule.status);
      // The structured contract: a Record, never a JSON string.
      expect(typeof rule.detail).toBe("object");
      expect(rule.detail).not.toBeNull();
      expect(Array.isArray(rule.detail)).toBe(false);
    }
  }, 20_000);

  it("checkCompliance on a system without a mechanical ruleset returns ruleset null with a note", async () => {
    const result = await bridge.checkCompliance({
      systemId: "neutral",
      artifactPath: realSvgPath,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.ruleset).toBeNull();
    expect(result.value.results).toEqual([]);
    expect(result.value.passed).toBe(0);
    expect(typeof result.value.note).toBe("string");
  }, 20_000);

  it("checkCompliance rejects a relative artifact path before dispatch", async () => {
    const result = await bridge.checkCompliance({
      systemId: "swiss",
      artifactPath: "relative/path.svg",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("tool");
    expect(result.error.code).toBe("INVALID_PATH");
    expect(bridge.status().state).toBe("up");
  });
});

describe("call serialization, timeout, cancellation (slice 2)", () => {
  it("dispatches concurrent calls serially in FIFO order, each settling exactly once", async () => {
    const order: string[] = [];
    const [first, second, third] = await Promise.all([
      bridge.loadSystem({ systemId: "swiss" }).then((result) => {
        order.push("loadSystem");
        return result;
      }),
      bridge.getTokens({ systemId: "swiss" }).then((result) => {
        order.push("getTokens");
        return result;
      }),
      bridge.listSystems().then((result) => {
        order.push("listSystems");
        return result;
      }),
    ]);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(third.ok).toBe(true);
    // One in-flight call at a time means settlement order is submission order.
    expect(order).toEqual(["loadSystem", "getTokens", "listSystems"]);
  }, 20_000);

  it("resolves kind timeout when the per-call budget expires, and the bridge stays up", async () => {
    const result = await bridge.loadSystem(
      { systemId: "swiss" },
      { timeoutMs: 1 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("timeout");
      expect(result.error.message).toContain("1ms");
    }
    expect(bridge.status().state).toBe("up");
    const next = await bridge.listSystems();
    expect(next.ok).toBe(true);
  });

  it("aborting a queued call prevents dispatch and resolves kind cancelled", async () => {
    const controller = new AbortController();
    // First call occupies the single in-flight slot...
    const inFlight = bridge.loadSystem({ systemId: "swiss" });
    // ...so this one is queued; abort it before it can dispatch.
    const queuedCall = bridge.getTokens(
      { systemId: "swiss" },
      { signal: controller.signal },
    );
    controller.abort();
    const cancelled = await queuedCall;
    expect(cancelled.ok).toBe(false);
    if (!cancelled.ok) {
      expect(cancelled.error.kind).toBe("cancelled");
    }
    const first = await inFlight;
    expect(first.ok).toBe(true);
  }, 20_000);

  it("aborting an in-flight call resolves kind cancelled and leaves the bridge healthy", async () => {
    const controller = new AbortController();
    const inFlight = bridge.loadSystem(
      { systemId: "swiss" },
      { signal: controller.signal },
    );
    controller.abort(); // the call has dispatched (empty queue) but not responded
    const result = await inFlight;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("cancelled");
    }
    const next = await bridge.listSystems();
    expect(next.ok).toBe(true);
  });

  it("a signal already aborted at submission resolves cancelled without dispatch", async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await bridge.listSystems({ signal: controller.signal });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("cancelled");
    }
  });
});

describe("stop semantics (slices 1 + 2)", () => {
  it("stop() drains pending calls as bridge_down and later calls resolve bridge_down immediately", async () => {
    const own = createMcpBridge(realBridgeConfig(), captureLogger().logger);
    await own.start();
    expect(own.status().state).toBe("up");

    const pendingInFlight = own.loadSystem({ systemId: "swiss" });
    const pendingQueued = own.getTokens({ systemId: "swiss" });
    await own.stop();

    const [first, second] = await Promise.all([pendingInFlight, pendingQueued]);
    for (const result of [first, second]) {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe("bridge_down");
      }
    }
    expect(own.status().state).toBe("stopped");

    const afterStop = await own.listSystems();
    expect(afterStop.ok).toBe(false);
    if (!afterStop.ok) {
      expect(afterStop.error.kind).toBe("bridge_down");
    }
  }, 30_000);
});
