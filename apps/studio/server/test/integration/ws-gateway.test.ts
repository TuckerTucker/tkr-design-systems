import { rmSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";

import { createStatusRegistry } from "../../src/health/status-registry.js";
import { buildServer, type StudioServer } from "../../src/server/create-server.js";
import type {
  WsConnection,
  WsConnectionHandler,
} from "../../src/ws/connection-gateway.js";
import {
  boundPort,
  captureLogger,
  testConfig,
  type CapturedLogger,
} from "../helpers.js";

let active: { server: StudioServer; repoRoot: string } | undefined;
const clients: WebSocket[] = [];

async function startServer(options?: {
  handler?: WsConnectionHandler;
  heartbeatIntervalMs?: number;
}): Promise<{ server: StudioServer; captured: CapturedLogger; url: string }> {
  const captured = captureLogger("debug");
  const config = testConfig();
  const server = buildServer({
    config,
    logger: captured.logger,
    statusRegistry: createStatusRegistry({ logger: captured.logger }),
    connectionHandler: options?.handler,
    options: { heartbeatIntervalMs: options?.heartbeatIntervalMs },
  });
  await server.start();
  active = { server, repoRoot: config.repoRoot };
  return { server, captured, url: `ws://127.0.0.1:${boundPort(server)}/ws` };
}

function connect(url: string, options?: { autoPong?: boolean }): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const client = new WebSocket(url, { autoPong: options?.autoPong ?? true });
    clients.push(client);
    client.on("open", () => resolve(client));
    client.on("error", reject);
  });
}

function nextMessage(client: WebSocket): Promise<string> {
  return new Promise((resolve) => {
    client.once("message", (data) => resolve(String(data)));
  });
}

function closed(client: WebSocket): Promise<{ code: number; reason: string }> {
  return new Promise((resolve) => {
    client.once("close", (code, reason) =>
      resolve({ code, reason: reason.toString() }),
    );
  });
}

afterEach(async () => {
  for (const client of clients.splice(0)) {
    client.terminate();
  }
  if (active !== undefined) {
    await active.server.shutdown("test complete");
    rmSync(active.repoRoot, { recursive: true, force: true });
    active = undefined;
  }
});

describe("/ws connection gateway", () => {
  it("accepts a connection, assigns a connectionId, and logs open and close with the same id", async () => {
    const { captured, url } = await startServer();
    const client = await connect(url);

    await vi.waitFor(() => {
      expect(
        captured.lines().some((line) => line.msg === "websocket connection opened"),
      ).toBe(true);
    });

    client.close(1000, "done");
    await vi.waitFor(() => {
      expect(
        captured.lines().some((line) => line.msg === "websocket connection closed"),
      ).toBe(true);
    });

    const open = captured.lines().find((l) => l.msg === "websocket connection opened");
    const close = captured.lines().find((l) => l.msg === "websocket connection closed");
    expect(typeof open?.connectionId).toBe("string");
    expect(close?.connectionId).toBe(open?.connectionId);
    expect(close?.code).toBe(1000);
  });

  it("answers any message with a typed server.not_ready envelope while no handler is registered, keeping the connection open", async () => {
    const { url } = await startServer();
    const client = await connect(url);

    const reply = nextMessage(client);
    client.send("hello before studio-api exists");
    const envelope = JSON.parse(await reply) as {
      type: string;
      seq: number;
      payload: { message: string; detail: string };
    };

    expect(envelope.type).toBe("server.not_ready");
    expect(envelope.seq).toBe(0);
    expect(envelope.payload.message).toContain("handler");
    expect(envelope.payload.detail).toContain("studio-api");
    expect(client.readyState).toBe(WebSocket.OPEN);
  });

  it("hands a registered handler a WsConnection whose send/onMessage round-trip raw strings", async () => {
    const received: string[] = [];
    let handled: WsConnection | undefined;
    const handler: WsConnectionHandler = {
      onConnection(connection) {
        handled = connection;
        connection.onMessage((raw) => {
          received.push(raw);
          connection.send(raw);
        });
      },
    };
    const { url } = await startServer({ handler });
    const client = await connect(url);

    const echoed = nextMessage(client);
    client.send('{"type":"raw-string-roundtrip"}');

    expect(await echoed).toBe('{"type":"raw-string-roundtrip"}');
    expect(received).toEqual(['{"type":"raw-string-roundtrip"}']);
    expect(typeof handled?.connectionId).toBe("string");
  });

  it("terminates a client that never answers pings and logs the reason with its connectionId", async () => {
    const { captured, url } = await startServer({ heartbeatIntervalMs: 100 });
    const client = await connect(url, { autoPong: false });

    const { code } = await closed(client);
    expect(code).toBe(1006); // terminated, not a clean close

    const termination = captured
      .lines()
      .find((line) => String(line.msg ?? "").includes("heartbeat pong missed"));
    expect(termination).toBeDefined();
    expect(typeof termination?.connectionId).toBe("string");
  });

  it("keeps a responsive client alive across several heartbeat intervals", async () => {
    const { url } = await startServer({ heartbeatIntervalMs: 100 });
    const client = await connect(url); // autoPong on — answers every ping
    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(client.readyState).toBe(WebSocket.OPEN);
  });

  it("closes open connections with code 1001 during shutdown, before hooks run", async () => {
    const { server, captured, url } = await startServer();
    const client = await connect(url);
    // Ensure the server has registered the connection before shutting down.
    await vi.waitFor(() => {
      expect(
        captured.lines().some((line) => line.msg === "websocket connection opened"),
      ).toBe(true);
    });

    const closePromise = closed(client);
    let hookRan = false;
    server.registerShutdownHook("observer", async () => {
      hookRan = true;
    });

    await server.shutdown("test complete");
    const { code, reason } = await closePromise;

    expect(code).toBe(1001);
    expect(reason).toBe("server is shutting down");
    expect(hookRan).toBe(true);

    // The shutdown log records the 1001 close before any hook completion.
    const messages = captured.lines().map((line) => String(line.msg ?? ""));
    const closeIndex = messages.findIndex((msg) =>
      msg.includes("closing websocket connections with code 1001"),
    );
    const hookIndex = messages.findIndex((msg) => msg === "shutdown hook completed");
    expect(closeIndex).toBeGreaterThanOrEqual(0);
    expect(hookIndex).toBeGreaterThan(closeIndex);
  });
});
