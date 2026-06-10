/**
 * Process lifecycle: graceful shutdown sequencing, signal handling, and
 * fatal capture.
 *
 * Shutdown sequence (idempotent — concurrent callers await the same run):
 *   1. refuse new WS upgrades, close open WS connections with code 1001
 *   2. run registered shutdown hooks in reverse registration order
 *   3. close the Fastify instance (in-flight HTTP requests complete)
 * A deadline bounds the whole sequence; exceeding it logs the abandoned
 * hooks by name and force-exits non-zero. Hook failures are logged, do not
 * stop remaining hooks, and turn the eventual exit code non-zero.
 */
import type { FastifyInstance } from "fastify";

import type { Logger } from "../logging/create-logger.js";
import type { ConnectionGateway } from "../ws/connection-gateway.js";

export const DEFAULT_SHUTDOWN_DEADLINE_MS = 5000;

export type ExitFn = (code: number) => void;

/** Minimal shutdown surface the process handlers need (structurally
 * satisfied by Lifecycle and adapted from StudioServer by the composition
 * root). */
export interface ShutdownControl {
  shutdown(reason: string): Promise<void>;
  /** 0 until a completed shutdown recorded a hook failure; then 1. */
  exitCode(): number;
}

export interface Lifecycle extends ShutdownControl {
  registerShutdownHook(name: string, hook: () => Promise<void>): void;
}

export interface LifecycleOptions {
  app: FastifyInstance;
  logger: Logger;
  gateway: ConnectionGateway;
  /** Total budget for the shutdown sequence before force-exit. */
  deadlineMs?: number;
  /** Injected for testability; production defaults to process.exit. */
  exit?: ExitFn;
}

interface ShutdownHook {
  name: string;
  run: () => Promise<void>;
}

export function createLifecycle(options: LifecycleOptions): Lifecycle {
  const {
    app,
    logger,
    gateway,
    deadlineMs = DEFAULT_SHUTDOWN_DEADLINE_MS,
    exit = (code) => process.exit(code),
  } = options;

  const hooks: ShutdownHook[] = [];
  let shutdownPromise: Promise<void> | undefined;
  let failed = false;

  async function runShutdown(reason: string): Promise<void> {
    logger.info({ reason, deadlineMs }, "shutdown started");
    const completed = new Set<string>();

    const work = (async () => {
      gateway.refuseNewConnections();
      const open = gateway.openConnectionCount();
      if (open > 0) {
        logger.info({ open }, "closing websocket connections with code 1001");
      }
      gateway.closeAll(1001, "server is shutting down");

      for (const hook of [...hooks].reverse()) {
        try {
          await hook.run();
          completed.add(hook.name);
          logger.info({ hook: hook.name }, "shutdown hook completed");
        } catch (err) {
          failed = true;
          logger.error({ hook: hook.name, err }, "shutdown hook failed");
        }
      }

      try {
        await app.close();
      } catch (err) {
        failed = true;
        logger.error({ err }, "fastify close failed during shutdown");
      }
    })();

    let timer: NodeJS.Timeout | undefined;
    const deadline = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), deadlineMs);
    });

    const outcome = await Promise.race([
      work.then(() => "done" as const),
      deadline,
    ]);
    clearTimeout(timer);

    if (outcome === "timeout") {
      failed = true;
      const abandoned = hooks
        .filter((hook) => !completed.has(hook.name))
        .map((hook) => hook.name);
      logger.fatal(
        { abandoned, deadlineMs },
        "shutdown deadline exceeded; forcing exit",
      );
      exit(1);
      return;
    }

    logger.info({ reason }, "shutdown complete");
  }

  return {
    shutdown(reason) {
      if (shutdownPromise === undefined) {
        shutdownPromise = runShutdown(reason);
      }
      return shutdownPromise;
    },

    registerShutdownHook(name, hook) {
      if (shutdownPromise !== undefined) {
        logger.warn(
          { hook: name },
          "shutdown hook rejected: registration after shutdown began",
        );
        return;
      }
      hooks.push({ name, run: hook });
    },

    exitCode() {
      return failed ? 1 : 0;
    },
  };
}

/** Minimal process surface — injected so handlers are testable. */
export interface ProcessLike {
  on(event: "SIGINT" | "SIGTERM", listener: (signal: string) => void): unknown;
  on(event: "unhandledRejection", listener: (reason: unknown) => void): unknown;
  on(event: "uncaughtException", listener: (error: Error) => void): unknown;
}

export interface ProcessHandlerOptions {
  control: ShutdownControl;
  logger: Logger;
  /** Injected for testability; production defaults to process.exit. */
  exit?: ExitFn;
  /** Injected for testability; production defaults to process. */
  proc?: ProcessLike;
}

/**
 * Install SIGINT/SIGTERM and fatal-capture handlers. Called once by the
 * composition root — never by buildServer, so tests can compose servers
 * without touching global process state.
 *
 * - First signal: graceful shutdown, exit with the lifecycle's exit code.
 * - Second signal during shutdown: immediate force-exit non-zero.
 * - unhandledRejection / uncaughtException: fatal structured log with the
 *   stack, then a shutdown attempt — never a silent crash.
 */
export function installProcessHandlers(options: ProcessHandlerOptions): void {
  const {
    control,
    logger,
    exit = (code) => process.exit(code),
    proc = process,
  } = options;

  let signalled = false;
  const onSignal = (signal: string): void => {
    if (signalled) {
      logger.fatal({ signal }, "second signal received; forcing immediate exit");
      exit(1);
      return;
    }
    signalled = true;
    logger.info({ signal }, "signal received; shutting down");
    void control
      .shutdown(`signal:${signal}`)
      .then(() => exit(control.exitCode()));
  };
  proc.on("SIGINT", onSignal);
  proc.on("SIGTERM", onSignal);

  const onFatal = (kind: string, err: Error): void => {
    logger.fatal({ err, stack: err.stack }, kind);
    void control.shutdown(kind).then(
      () => exit(1),
      () => exit(1),
    );
  };
  proc.on("unhandledRejection", (reason) => {
    onFatal(
      "unhandled promise rejection",
      reason instanceof Error ? reason : new Error(String(reason)),
    );
  });
  proc.on("uncaughtException", (error) => {
    onFatal("uncaught exception", error);
  });
}
