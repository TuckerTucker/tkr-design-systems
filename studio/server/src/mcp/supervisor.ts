/**
 * Subprocess supervision — the bridge state machine (starting, up,
 * restarting, failed, stopped), crash detection through the connection's
 * unexpected-close hook, restart with exponential backoff under a configured
 * budget, and status reporting with change listeners.
 *
 * State semantics (canonical in @studio/contract bridge.ts):
 * - start() resolves into "up" or "failed" — it never throws
 * - an unexpected close while up begins a restart episode: "restarting",
 *   then back to "up" on a successful respawn, or "failed" once the budget
 *   is exhausted (terminal until an explicit start())
 * - restartCount counts spawn attempts since process start and never resets
 * - stop() is always safe and lands in "stopped"
 */
import type { BridgeState, BridgeStatus } from "@studio/contract";

import type { BridgeConnection } from "./transport.js";
import type { Logger } from "../logging/create-logger.js";

/** Backoff/budget settings for crash-triggered restarts. */
export interface RestartPolicy {
  /** Spawn attempts per restart episode before the bridge fails. */
  maxAttempts: number;
  /** Delay before the first restart attempt; doubles per attempt. */
  initialDelayMs: number;
  /** Backoff ceiling. */
  maxDelayMs: number;
}

export interface BridgeSupervisorOptions {
  /** Opens a fresh connection (spawn + handshake + verification). */
  connect: () => Promise<BridgeConnection>;
  restart: RestartPolicy;
  logger: Logger;
  /**
   * Connection availability seam: invoked with the live connection on every
   * transition to "up" and with undefined whenever the connection is lost or
   * deliberately closed. The bridge maps this onto the call queue's executor.
   */
  onConnectionChange: (connection: BridgeConnection | undefined) => void;
  /**
   * Invoked on every transition into a dead state ("failed"/"stopped") —
   * the bridge drains held calls as bridge_down.
   */
  onTerminal: (status: BridgeStatus) => void;
}

export interface BridgeSupervisor {
  /** Spawn + handshake; resolves into "up" or "failed", never throws. */
  start(): Promise<void>;
  /** Close the connection, cancel restarts, land in "stopped". */
  stop(): Promise<void>;
  status(): BridgeStatus;
  /** Subscribe to every state transition; returns the unsubscribe. */
  onStatusChange(listener: (status: BridgeStatus) => void): () => void;
}

function backoffDelayMs(policy: RestartPolicy, attempt: number): number {
  return Math.min(
    policy.initialDelayMs * 2 ** (attempt - 1),
    policy.maxDelayMs,
  );
}

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const finish = (): void => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal.addEventListener("abort", finish, { once: true });
  });
}

export function createBridgeSupervisor(
  options: BridgeSupervisorOptions,
): BridgeSupervisor {
  const logger = options.logger.child({ subsystem: "supervisor" });
  const listeners = new Set<(status: BridgeStatus) => void>();

  let state: BridgeState = "stopped";
  let restartCount = 0;
  let lastError: string | undefined;
  let since = new Date().toISOString();
  let connection: BridgeConnection | undefined;
  let stopController = new AbortController();

  function snapshot(): BridgeStatus {
    return {
      state,
      restartCount,
      ...(lastError !== undefined ? { lastError } : {}),
      since,
    };
  }

  function emit(): void {
    const status = snapshot();
    for (const listener of listeners) {
      try {
        listener(status);
      } catch (err) {
        logger.warn(
          { err: err instanceof Error ? err.message : String(err) },
          "bridge status listener threw",
        );
      }
    }
  }

  function transition(next: BridgeState, error?: string): void {
    const previous = state;
    state = next;
    since = new Date().toISOString();
    if (error !== undefined) {
      lastError = error;
    }
    logger.info(
      { from: previous, to: next, restartCount, lastError },
      "bridge state transition",
    );
    emit();
    if (next === "failed" || next === "stopped") {
      options.onTerminal(snapshot());
    }
  }

  /** Adopt a live connection: track it, hook crash detection, go "up". */
  function adopt(conn: BridgeConnection): void {
    connection = conn;
    conn.setOnUnexpectedClose(() => {
      if (connection !== conn) {
        return; // stale connection — already replaced or closed
      }
      connection = undefined;
      options.onConnectionChange(undefined);
      if (state === "up") {
        transition(
          "restarting",
          "MCP server subprocess exited unexpectedly",
        );
        void restartLoop();
      }
    });
    transition("up");
    options.onConnectionChange(conn);
  }

  async function restartLoop(): Promise<void> {
    const policy = options.restart;
    const stopSignal = stopController.signal;

    for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
      await abortableSleep(backoffDelayMs(policy, attempt), stopSignal);
      if (stopSignal.aborted || state !== "restarting") {
        return; // stop() or an explicit start() superseded this episode
      }
      restartCount += 1;
      logger.info(
        { attempt, maxAttempts: policy.maxAttempts, restartCount },
        "bridge restart attempt",
      );
      try {
        const conn = await options.connect();
        if (stopSignal.aborted || state !== "restarting") {
          await conn.close();
          return;
        }
        adopt(conn);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        logger.warn(
          { attempt, err: lastError },
          "bridge restart attempt failed",
        );
        emit(); // restartCount/lastError visible per attempt
      }
    }

    transition(
      "failed",
      lastError ?? "MCP server restart budget exhausted",
    );
  }

  return {
    async start() {
      if (state === "starting" || state === "up" || state === "restarting") {
        logger.warn({ state }, "start() ignored — bridge is already running");
        return;
      }
      stopController = new AbortController();
      lastError = undefined;
      transition("starting");
      try {
        const conn = await options.connect();
        adopt(conn);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        transition("failed", message);
      }
    },

    async stop() {
      if (state === "stopped") {
        return;
      }
      stopController.abort(); // cancels any backoff sleep in flight
      const conn = connection;
      connection = undefined;
      options.onConnectionChange(undefined);
      if (conn !== undefined) {
        await conn.close();
      }
      transition("stopped");
    },

    status: snapshot,

    onStatusChange(listener) {
      listeners.add(listener);
      return (): void => {
        listeners.delete(listener);
      };
    },
  };
}
