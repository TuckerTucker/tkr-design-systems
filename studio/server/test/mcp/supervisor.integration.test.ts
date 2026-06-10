/**
 * Crash supervision integration tests against the REAL design-systems MCP
 * server subprocess (slice 5): kill mid-call, observe restarting → up with
 * held-call replay, exhaust the restart budget into failed, spawn-failure
 * into failed, orphan-free shutdown, and the StatusProvider registered into
 * a real studio-server StatusRegistry.
 *
 * The restart-budget test uses a tiny launcher script that EXECs the real
 * server while a sentinel file exists and exits non-zero once it is removed
 * — the up phase always runs the real MCP server; only respawn failure is
 * provoked. The server itself is never mocked.
 */
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createBridgeStatusProvider,
  createMcpBridge,
} from "../../src/mcp/bridge.js";
import { openBridgeConnection } from "../../src/mcp/transport.js";
import { createStatusRegistry } from "../../src/health/status-registry.js";
import type { BridgeState } from "@studio/contract";
import { captureLogger } from "../helpers.js";
import {
  processGone,
  realBridgeConfig,
  realStudioConfig,
  subprocessPidFromLogs,
  waitFor,
} from "./mcp-helpers.js";

const FAST_RESTART = { maxAttempts: 2, initialDelayMs: 25, maxDelayMs: 100 };

describe("transport shutdown (slice 1)", () => {
  it("close() terminates the subprocess — no orphan python3 process remains", async () => {
    const captured = captureLogger("debug");
    const connection = await openBridgeConnection(
      realBridgeConfig(),
      captured.logger,
    );
    const pid = connection.pid;
    expect(pid).not.toBeNull();
    if (pid === null) return;
    expect(processGone(pid)).toBe(false);

    await connection.close();
    await waitFor(() => processGone(pid), `pid ${pid} to exit`, 10_000);
  }, 30_000);
});

describe("spawn and handshake failure (slice 5)", () => {
  it("start() with a nonexistent command resolves into failed — never throws", async () => {
    const bridge = createMcpBridge(
      realBridgeConfig({ command: "/nonexistent/python3" }),
      captureLogger().logger,
    );
    await bridge.start();
    const status = bridge.status();
    expect(status.state).toBe("failed");
    expect(status.lastError).toBeDefined();

    const result = await bridge.listSystems();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("bridge_down");
    }
    await bridge.stop();
  });
});

describe("crash recovery (slice 5)", () => {
  it("kill mid-call → in-flight fails protocol, status up → restarting → up, held call replays", async () => {
    const captured = captureLogger("debug");
    const bridge = createMcpBridge(
      realBridgeConfig({ restart: { ...FAST_RESTART, maxAttempts: 5 } }),
      captured.logger,
    );
    const states: BridgeState[] = [];
    const unsubscribe = bridge.onStatusChange((status) => {
      states.push(status.state);
    });

    await bridge.start();
    expect(bridge.status().state).toBe("up");
    const firstPid = subprocessPidFromLogs(captured);

    // Dispatch a call, then SIGKILL the subprocess in the same tick — the
    // server cannot have responded yet, so the call is in flight at crash.
    const inFlight = bridge.loadSystem({ systemId: "swiss" });
    process.kill(firstPid, "SIGKILL");

    const crashed = await inFlight;
    expect(crashed.ok).toBe(false);
    if (!crashed.ok) {
      expect(crashed.error.kind).toBe("protocol");
    }

    await waitFor(
      () => bridge.status().state === "restarting",
      "state restarting",
      5_000,
    );
    // Submitted while restarting: holds in the queue, replays after recovery.
    const held = bridge.getTokens({ systemId: "swiss" });

    await waitFor(() => bridge.status().state === "up", "state up", 20_000);
    expect(bridge.status().restartCount).toBeGreaterThanOrEqual(1);

    const replayed = await held;
    expect(replayed.ok).toBe(true);

    const secondPid = subprocessPidFromLogs(captured);
    expect(secondPid).not.toBe(firstPid);

    expect(states).toContain("restarting");
    expect(states.indexOf("restarting")).toBeLessThan(
      states.lastIndexOf("up"),
    );

    unsubscribe();
    await bridge.stop();
    await waitFor(() => processGone(secondPid), "subprocess exit", 10_000);
  }, 60_000);

  it("exhausting the restart budget reaches failed; held and new calls resolve bridge_down", async () => {
    const studioConfig = realStudioConfig();
    const fixtureDir = mkdtempSync(path.join(tmpdir(), "bridge-flaky-"));
    const sentinelPath = path.join(fixtureDir, "sentinel");
    const launcherPath = path.join(fixtureDir, "launcher.py");
    const serverPath = path.join(
      studioConfig.repoRoot,
      "design-systems",
      "mcp-server",
      "server.py",
    );
    // Launcher EXECs the real MCP server while the sentinel exists; once the
    // sentinel is removed every respawn exits non-zero immediately.
    writeFileSync(
      launcherPath,
      [
        "import os, sys",
        "if not os.path.exists(sys.argv[1]):",
        "    sys.exit(1)",
        "os.execv(sys.executable, [sys.executable, sys.argv[2]])",
        "",
      ].join("\n"),
    );
    writeFileSync(sentinelPath, "");

    const captured = captureLogger("debug");
    const bridge = createMcpBridge(
      realBridgeConfig({
        args: [launcherPath, sentinelPath, serverPath],
        restart: FAST_RESTART,
      }),
      captured.logger,
    );
    const states: BridgeState[] = [];
    bridge.onStatusChange((status) => {
      states.push(status.state);
    });

    try {
      await bridge.start();
      expect(bridge.status().state).toBe("up");
      const pid = subprocessPidFromLogs(captured);

      unlinkSync(sentinelPath); // every respawn now fails
      process.kill(pid, "SIGKILL");

      await waitFor(
        () => bridge.status().state === "restarting",
        "state restarting",
        5_000,
      );
      const held = bridge.listSystems();

      await waitFor(
        () => bridge.status().state === "failed",
        "state failed",
        20_000,
      );

      const status = bridge.status();
      expect(status.restartCount).toBe(FAST_RESTART.maxAttempts);
      expect(status.lastError).toBeDefined();

      const heldResult = await held;
      expect(heldResult.ok).toBe(false);
      if (!heldResult.ok) {
        expect(heldResult.error.kind).toBe("bridge_down");
      }

      const fresh = await bridge.getTokens({ systemId: "swiss" });
      expect(fresh.ok).toBe(false);
      if (!fresh.ok) {
        expect(fresh.error.kind).toBe("bridge_down");
      }

      expect(states).toContain("up");
      expect(states).toContain("restarting");
      expect(states[states.length - 1]).toBe("failed");
    } finally {
      await bridge.stop();
      rmSync(fixtureDir, { recursive: true, force: true });
    }
  }, 60_000);
});

describe("health registry integration (slice 5)", () => {
  it("the registered StatusProvider feeds /api/health-shaped output that tracks bridge state", async () => {
    const captured = captureLogger();
    const bridge = createMcpBridge(realBridgeConfig(), captured.logger);
    const registry = createStatusRegistry({ logger: captured.logger });
    registry.register("bridge", createBridgeStatusProvider(bridge));

    const beforeStart = await registry.snapshot();
    expect(beforeStart.bridge.status).toBe("stopped");

    await bridge.start();
    const whileUp = await registry.snapshot();
    expect(whileUp.bridge.status).toBe("up");

    await bridge.stop();
    const afterStop = await registry.snapshot();
    expect(afterStop.bridge.status).toBe("stopped");
  }, 30_000);

  it("onStatusChange delivers every transition and unsubscribing stops delivery", async () => {
    const bridge = createMcpBridge(
      realBridgeConfig(),
      captureLogger().logger,
    );
    const seen: BridgeState[] = [];
    const unsubscribe = bridge.onStatusChange((status) => {
      seen.push(status.state);
    });

    await bridge.start();
    expect(seen).toEqual(["starting", "up"]);

    unsubscribe();
    await bridge.stop();
    expect(seen).toEqual(["starting", "up"]); // nothing after unsubscribe
    expect(bridge.status().state).toBe("stopped");
  }, 30_000);
});
