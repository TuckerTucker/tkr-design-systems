/**
 * Pluggable status registry — the seam through which mcp-bridge,
 * workspace-store, and agent-orchestration report health without
 * studio-server importing any of them.
 *
 * Provider isolation: a throwing provider degrades only its own component
 * ("unavailable" + the error message as detail); a hanging provider is
 * converted to "unavailable" by a per-provider timeout. The snapshot always
 * resolves.
 */
import type { StatusReport } from "@studio/contract";

import type { Logger } from "../logging/create-logger.js";

export type StatusComponent = "bridge" | "store" | "auth";

export const STATUS_COMPONENTS: readonly StatusComponent[] = [
  "bridge",
  "store",
  "auth",
];

export type StatusProvider = () => Promise<StatusReport>;

export interface StatusRegistry {
  /**
   * Register the status provider for a component. Re-registering replaces
   * the previous provider (logged at debug).
   */
  register(component: StatusComponent, provider: StatusProvider): void;
  /** Resolve all component statuses concurrently; never rejects. */
  snapshot(): Promise<Record<StatusComponent, StatusReport>>;
}

export const DEFAULT_PROVIDER_TIMEOUT_MS = 1000;

export interface StatusRegistryOptions {
  logger: Logger;
  /** Per-provider budget before a hang is reported "unavailable". */
  providerTimeoutMs?: number;
}

const UNREGISTERED: StatusReport = {
  status: "unregistered",
  detail: "No status provider registered for this component yet",
};

async function resolveProvider(
  component: StatusComponent,
  provider: StatusProvider,
  timeoutMs: number,
  logger: Logger,
): Promise<StatusReport> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<StatusReport>((resolve) => {
    timer = setTimeout(() => {
      resolve({
        status: "unavailable",
        detail: `Status provider did not respond within ${timeoutMs}ms`,
      });
    }, timeoutMs);
  });

  try {
    // Promise.resolve().then(provider) also converts synchronous throws
    // into rejections handled below.
    return await Promise.race([Promise.resolve().then(provider), timeout]);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    logger.warn({ component, err }, "status provider failed");
    return { status: "unavailable", detail };
  } finally {
    clearTimeout(timer);
  }
}

export function createStatusRegistry(
  options: StatusRegistryOptions,
): StatusRegistry {
  const { logger, providerTimeoutMs = DEFAULT_PROVIDER_TIMEOUT_MS } = options;
  const providers = new Map<StatusComponent, StatusProvider>();

  return {
    register(component, provider) {
      if (providers.has(component)) {
        logger.debug({ component }, "status provider replaced");
      } else {
        logger.debug({ component }, "status provider registered");
      }
      providers.set(component, provider);
    },

    async snapshot() {
      const reports = await Promise.all(
        STATUS_COMPONENTS.map(async (component): Promise<StatusReport> => {
          const provider = providers.get(component);
          if (provider === undefined) {
            return UNREGISTERED;
          }
          return resolveProvider(component, provider, providerTimeoutMs, logger);
        }),
      );
      return {
        bridge: reports[0] ?? UNREGISTERED,
        store: reports[1] ?? UNREGISTERED,
        auth: reports[2] ?? UNREGISTERED,
      };
    },
  };
}
