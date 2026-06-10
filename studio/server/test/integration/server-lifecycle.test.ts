import { rmSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { createStatusRegistry } from "../../src/health/status-registry.js";
import { buildServer } from "../../src/server/create-server.js";
import { installProcessHandlers, type ProcessLike } from "../../src/server/lifecycle.js";
import {
  baseUrl,
  boundPort,
  captureLogger,
  testConfig,
  type CapturedLogger,
} from "../helpers.js";

function compose(options?: {
  level?: "info" | "debug";
  shutdownDeadlineMs?: number;
  exit?: (code: number) => void;
}) {
  const captured: CapturedLogger = captureLogger(options?.level ?? "info");
  const config = testConfig();
  const server = buildServer({
    config,
    logger: captured.logger,
    statusRegistry: createStatusRegistry({ logger: captured.logger }),
    options: {
      shutdownDeadlineMs: options?.shutdownDeadlineMs,
      exit: options?.exit,
    },
  });
  const cleanup = () => rmSync(config.repoRoot, { recursive: true, force: true });
  return { server, captured, config, cleanup };
}

describe("server lifecycle over real HTTP", () => {
  it("starts on 127.0.0.1, answers, and shuts down cleanly", async () => {
    const { server, cleanup } = compose();
    await server.start();
    const address = server.app.server.address();
    expect(address).not.toBeNull();
    if (address === null || typeof address === "string") throw new Error("no port");
    expect(address.address).toBe("127.0.0.1");

    const response = await fetch(`${baseUrl(server)}/api/health`);
    expect(response.status).toBe(200);

    await server.shutdown("test complete");
    expect(server.shutdownExitCode()).toBe(0);
    cleanup();
  });

  it("reports EADDRINUSE with the STUDIO_PORT fix and rejects start", async () => {
    const first = compose();
    await first.server.start();
    const port = boundPort(first.server);

    const second = compose();
    const blocked = buildServer({
      config: { ...testConfig(), port },
      logger: second.captured.logger,
      statusRegistry: createStatusRegistry({ logger: second.captured.logger }),
    });

    await expect(blocked.start()).rejects.toMatchObject({ code: "EADDRINUSE" });
    const fatal = second.captured
      .lines()
      .find((line) => String(line.msg ?? "").includes("already in use"));
    expect(fatal?.fix).toContain("STUDIO_PORT");
    expect(fatal?.port).toBe(port);

    await first.server.shutdown("test complete");
    first.cleanup();
    second.cleanup();
  });

  it("runs shutdown hooks in reverse registration order, logged by name", async () => {
    const { server, captured, cleanup } = compose();
    await server.start();

    const order: string[] = [];
    server.registerShutdownHook("hook-a", async () => {
      order.push("hook-a");
    });
    server.registerShutdownHook("hook-b", async () => {
      order.push("hook-b");
    });

    await server.shutdown("test complete");
    expect(order).toEqual(["hook-b", "hook-a"]);
    const hookLines = captured
      .lines()
      .filter((line) => line.msg === "shutdown hook completed")
      .map((line) => line.hook);
    expect(hookLines).toEqual(["hook-b", "hook-a"]);
    expect(server.shutdownExitCode()).toBe(0);
    cleanup();
  });

  it("logs a rejecting hook, still runs remaining hooks, and reports a non-zero exit code", async () => {
    const { server, captured, cleanup } = compose();
    await server.start();

    const order: string[] = [];
    server.registerShutdownHook("survivor", async () => {
      order.push("survivor");
    });
    server.registerShutdownHook("breaker", async () => {
      throw new Error("teardown failed");
    });

    await server.shutdown("test complete");
    expect(order).toEqual(["survivor"]);
    const failure = captured
      .lines()
      .find((line) => line.msg === "shutdown hook failed");
    expect(failure?.hook).toBe("breaker");
    expect(server.shutdownExitCode()).toBe(1);
    cleanup();
  });

  it("is idempotent — concurrent shutdown calls share one run", async () => {
    const { server, cleanup } = compose();
    await server.start();

    let runs = 0;
    server.registerShutdownHook("counter", async () => {
      runs += 1;
    });

    await Promise.all([server.shutdown("first"), server.shutdown("second")]);
    expect(runs).toBe(1);
    cleanup();
  });

  it("rejects hook registration once shutdown has begun, with a logged warning", async () => {
    const { server, captured, cleanup } = compose();
    await server.start();

    const shutdownDone = server.shutdown("test complete");
    let ran = false;
    server.registerShutdownHook("late", async () => {
      ran = true;
    });
    await shutdownDone;

    expect(ran).toBe(false);
    const warning = captured
      .lines()
      .find((line) =>
        String(line.msg ?? "").includes("registration after shutdown began"),
      );
    expect(warning?.hook).toBe("late");
    cleanup();
  });

  it("force-exits non-zero when the shutdown deadline is exceeded, naming abandoned hooks", async () => {
    const exit = vi.fn();
    const { server, captured, cleanup } = compose({
      shutdownDeadlineMs: 100,
      exit,
    });
    await server.start();
    server.registerShutdownHook("hanger", () => new Promise(() => undefined));

    await server.shutdown("test complete");
    expect(exit).toHaveBeenCalledWith(1);
    const fatal = captured
      .lines()
      .find((line) => String(line.msg ?? "").includes("deadline exceeded"));
    expect(fatal?.abandoned).toEqual(["hanger"]);

    await server.app.close();
    cleanup();
  });
});

describe("structured logging over real HTTP", () => {
  it("binds one requestId across a request's log lines and logs completion with the status code", async () => {
    const { server, captured, cleanup } = compose();
    await server.start();
    await fetch(`${baseUrl(server)}/api/health`);

    const requestLines = captured
      .lines()
      .filter((line) => typeof line.requestId === "string");
    expect(requestLines.length).toBeGreaterThanOrEqual(2);
    const requestIds = new Set(requestLines.map((line) => line.requestId));
    expect(requestIds.size).toBe(1);

    const completion = requestLines.find(
      (line) => line.msg === "request completed",
    );
    expect(completion).toBeDefined();
    expect((completion?.res as { statusCode: number }).statusCode).toBe(200);

    await server.shutdown("test complete");
    cleanup();
  });

  it("redacts ANTHROPIC_API_KEY and authorization values, including via child loggers", async () => {
    const { captured } = compose();
    const secret = "sk-ant-super-secret-value";
    captured.logger.info({ ANTHROPIC_API_KEY: secret }, "direct");
    captured.logger.info({ env: { ANTHROPIC_API_KEY: secret } }, "nested");
    captured.logger.info({ headers: { authorization: `Bearer ${secret}` } }, "auth header");
    captured.logger
      .child({ component: "bridge" })
      .info({ ANTHROPIC_API_KEY: secret }, "child");

    expect(captured.raw()).not.toContain(secret);
    expect(captured.raw()).toContain("[REDACTED]");
  });

  it("carries component bindings on child loggers in valid JSON", async () => {
    const { captured } = compose();
    captured.logger.child({ component: "bridge" }).info("bridge line");
    const line = captured.lines().find((entry) => entry.msg === "bridge line");
    expect(line?.component).toBe("bridge");
  });
});

describe("process handlers (injected process surface)", () => {
  function fakeProcess() {
    const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
    const proc: ProcessLike = {
      on(event: string, listener: (...args: unknown[]) => void) {
        const existing = listeners.get(event) ?? [];
        existing.push(listener);
        listeners.set(event, existing);
        return proc;
      },
    } as ProcessLike;
    return {
      proc,
      emit(event: string, ...args: unknown[]) {
        for (const listener of listeners.get(event) ?? []) {
          listener(...args);
        }
      },
    };
  }

  it("SIGTERM triggers a graceful shutdown and exit 0", async () => {
    const { server, cleanup } = compose();
    await server.start();
    const { proc, emit } = fakeProcess();
    const exit = vi.fn();
    const captured = captureLogger();
    installProcessHandlers({
      control: {
        shutdown: (reason) => server.shutdown(reason),
        exitCode: () => server.shutdownExitCode(),
      },
      logger: captured.logger,
      exit,
      proc,
    });

    emit("SIGTERM", "SIGTERM");
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    cleanup();
  });

  it("a second signal during shutdown force-exits non-zero immediately", async () => {
    const { server, cleanup } = compose();
    await server.start();
    server.registerShutdownHook(
      "slow",
      () => new Promise((resolve) => setTimeout(resolve, 300)),
    );
    const { proc, emit } = fakeProcess();
    const exit = vi.fn();
    const captured = captureLogger();
    installProcessHandlers({
      control: {
        shutdown: (reason) => server.shutdown(reason),
        exitCode: () => server.shutdownExitCode(),
      },
      logger: captured.logger,
      exit,
      proc,
    });

    emit("SIGINT", "SIGINT");
    emit("SIGINT", "SIGINT");
    expect(exit).toHaveBeenCalledWith(1);
    const forced = captured
      .lines()
      .find((line) => String(line.msg ?? "").includes("forcing immediate exit"));
    expect(forced).toBeDefined();

    await server.shutdown("drain");
    cleanup();
  });

  it("an unhandled rejection produces a fatal structured log then a shutdown attempt", async () => {
    const { server, cleanup } = compose();
    await server.start();
    const { proc, emit } = fakeProcess();
    const exit = vi.fn();
    const captured = captureLogger();
    installProcessHandlers({
      control: {
        shutdown: (reason) => server.shutdown(reason),
        exitCode: () => server.shutdownExitCode(),
      },
      logger: captured.logger,
      exit,
      proc,
    });

    emit("unhandledRejection", new Error("dangling promise"));
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
    const fatal = captured
      .lines()
      .find((line) => line.msg === "unhandled promise rejection");
    expect(fatal).toBeDefined();
    expect(JSON.stringify(fatal)).toContain("dangling promise");
    cleanup();
  });
});
