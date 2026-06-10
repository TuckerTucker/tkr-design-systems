/**
 * Shared pino logger factory.
 *
 * One pino instance backs the whole process — Fastify receives it as
 * `loggerInstance`, so HTTP request logs and capability logs share the same
 * stream, level, and redaction.
 *
 * Conventions:
 * - Correlation: Fastify binds `requestId` per HTTP request; the WS gateway
 *   binds `connectionId` per connection.
 * - Capabilities log through child loggers: `logger.child({ component: "bridge" })`.
 * - Secrets never reach the stream: ANTHROPIC_API_KEY and authorization
 *   values are redacted at the logger level, so no downstream capability can
 *   leak them.
 */
import { pino, type DestinationStream, type Logger } from "pino";

import type { LogLevel } from "../config/types.js";

export type { Logger } from "pino";

const REDACT_PATHS = [
  "ANTHROPIC_API_KEY",
  "*.ANTHROPIC_API_KEY",
  "env.ANTHROPIC_API_KEY",
  "authorization",
  "*.authorization",
  "headers.authorization",
  "req.headers.authorization",
];

/**
 * Create the process-wide pino logger.
 *
 * @param options - Log level (from resolved config).
 * @param destination - Optional destination stream; tests inject a capture
 *   stream, production defaults to stdout.
 */
export function createLogger(
  options: { logLevel: LogLevel },
  destination?: DestinationStream,
): Logger {
  const pinoOptions = {
    level: options.logLevel,
    redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
  };
  return destination === undefined
    ? pino(pinoOptions)
    : pino(pinoOptions, destination);
}
