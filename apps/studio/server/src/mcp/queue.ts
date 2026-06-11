/**
 * FIFO call serialization over the single stdio transport — one in-flight
 * call at a time, per-call timeout, AbortSignal cancellation, and drain
 * semantics for shutdown/failure.
 *
 * Settlement is exactly-once by construction: every call carries a `settled`
 * latch; a result arriving after a timeout or abort is discarded (the MCP
 * server is stateless per call, so a late response is safe to drop and the
 * transport is never torn down for it).
 *
 * The queue does not know about bridge state. The bridge supplies and
 * removes the executor: while an executor is set, queued calls dispatch;
 * while it is unset (starting/restarting), submitted calls hold; `drain`
 * fails everything that is still pending (stop/failed).
 */
import type { BridgeError, BridgeResult } from "@studio/contract";

import {
  cancelledError,
  fail,
  ok,
  timeoutError,
  translateInvocationError,
} from "./errors.js";
import type { Logger } from "../logging/create-logger.js";

/** Per-call options on every bridge wrapper. */
export interface CallOptions {
  /** Overrides the configured default timeout for this call. */
  timeoutMs?: number;
  /** Cancels the call: queued calls never dispatch; in-flight calls settle "cancelled". */
  signal?: AbortSignal;
}

/**
 * Executes one tool call against the currently connected MCP client.
 * `signal` aborts the underlying SDK request when the bridge-level timeout
 * fires or the caller cancels.
 */
export type CallExecutor = (
  tool: string,
  args: Record<string, unknown>,
  signal: AbortSignal,
  timeoutMs: number,
) => Promise<unknown>;

export interface CallQueue {
  /**
   * Enqueue a tool call. Resolves the raw CallToolResult on success; all
   * failure modes resolve as typed errors — never rejects.
   */
  submit(
    tool: string,
    args: Record<string, unknown>,
    opts?: CallOptions,
  ): Promise<BridgeResult<unknown>>;
  /** Set (resume) or unset (hold) the dispatch target across restarts. */
  setExecutor(executor: CallExecutor | undefined): void;
  /** Settle every pending call (queued and in-flight) with `error`. */
  drain(error: BridgeError): void;
  /** Pending calls: queued plus in-flight. */
  depth(): number;
}

interface PendingCall {
  id: number;
  tool: string;
  args: Record<string, unknown>;
  timeoutMs: number;
  settled: boolean;
  settle(result: BridgeResult<unknown>): void;
  /** Set while in flight — aborts the underlying SDK request. */
  controller?: AbortController;
  /** External cancellation cleanup. */
  detachSignal?: () => void;
}

export interface CallQueueOptions {
  defaultTimeoutMs: number;
  logger: Logger;
}

export function createCallQueue(options: CallQueueOptions): CallQueue {
  const logger = options.logger.child({ subsystem: "queue" });
  const queued: PendingCall[] = [];
  let inFlight: PendingCall | undefined;
  let executor: CallExecutor | undefined;
  let nextCallId = 1;

  function depth(): number {
    return queued.length + (inFlight === undefined ? 0 : 1);
  }

  function pump(): void {
    if (inFlight !== undefined || executor === undefined) {
      return;
    }
    const call = queued.shift();
    if (call === undefined) {
      return;
    }
    dispatch(call, executor);
  }

  function dispatch(call: PendingCall, execute: CallExecutor): void {
    inFlight = call;
    const controller = new AbortController();
    call.controller = controller;
    const startedAt = Date.now();

    const timer = setTimeout(() => {
      call.settle(fail(timeoutError(call.tool, call.timeoutMs)));
      controller.abort();
    }, call.timeoutMs);

    logger.debug(
      { callId: call.id, tool: call.tool, queueDepth: depth() },
      "bridge call dispatched",
    );

    execute(call.tool, call.args, controller.signal, call.timeoutMs)
      .then((raw) => {
        if (call.settled) {
          logger.debug(
            { callId: call.id, tool: call.tool },
            "late tool response discarded",
          );
          return;
        }
        call.settle(ok(raw));
      })
      .catch((err: unknown) => {
        if (call.settled) {
          return; // abort propagation after timeout/cancel — already settled
        }
        call.settle(fail(translateInvocationError(call.tool, err)));
      })
      .finally(() => {
        clearTimeout(timer);
        if (inFlight === call) {
          inFlight = undefined;
        }
        logger.debug(
          {
            callId: call.id,
            tool: call.tool,
            durationMs: Date.now() - startedAt,
          },
          "bridge call finished",
        );
        pump();
      });
  }

  return {
    submit(tool, args, opts = {}) {
      const timeoutMs = opts.timeoutMs ?? options.defaultTimeoutMs;
      const signal = opts.signal;

      return new Promise<BridgeResult<unknown>>((resolve) => {
        const call: PendingCall = {
          id: nextCallId++,
          tool,
          args,
          timeoutMs,
          settled: false,
          settle(result) {
            if (call.settled) {
              return;
            }
            call.settled = true;
            call.detachSignal?.();
            logger.debug(
              {
                callId: call.id,
                tool: call.tool,
                outcome: result.ok ? "ok" : result.error.kind,
              },
              "bridge call settled",
            );
            resolve(result);
          },
        };

        if (signal?.aborted === true) {
          call.settle(fail(cancelledError(tool)));
          return;
        }

        if (signal !== undefined) {
          const onAbort = (): void => {
            const queuedIndex = queued.indexOf(call);
            if (queuedIndex !== -1) {
              queued.splice(queuedIndex, 1); // removed before dispatch
            }
            call.settle(fail(cancelledError(tool)));
            call.controller?.abort();
          };
          signal.addEventListener("abort", onAbort, { once: true });
          call.detachSignal = (): void => {
            signal.removeEventListener("abort", onAbort);
          };
        }

        queued.push(call);
        logger.debug(
          { callId: call.id, tool, queueDepth: depth() },
          "bridge call queued",
        );
        pump();
      });
    },

    setExecutor(next) {
      executor = next;
      if (executor !== undefined) {
        pump();
      }
    },

    drain(error) {
      const pending = [...queued];
      queued.length = 0;
      for (const call of pending) {
        call.settle(fail(error));
      }
      if (inFlight !== undefined) {
        const call = inFlight;
        call.settle(fail(error));
        call.controller?.abort();
      }
      if (pending.length > 0 || inFlight !== undefined) {
        logger.info(
          { drained: pending.length + (inFlight === undefined ? 0 : 1), kind: error.kind },
          "bridge queue drained",
        );
      }
    },

    depth,
  };
}
