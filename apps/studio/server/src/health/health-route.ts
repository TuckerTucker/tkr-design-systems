/**
 * GET /api/health — the one HTTP route owned by studio-server.
 *
 * Always answers 200: liveness is expressed by answering, readiness by the
 * body. Overall status is "ok" when every registered component reports a
 * healthy status; "unregistered" components (Wave 1, before siblings exist)
 * do not degrade the result.
 */
import type { FastifyInstance } from "fastify";
import type { HealthResponse, StatusReport } from "@studio/contract";

import type { StatusComponent, StatusRegistry } from "./status-registry.js";

/**
 * Statuses that count as healthy for the overall derivation:
 * - "ok" — workspace-store healthy
 * - "up" — mcp-bridge healthy (BridgeState)
 * - "configured" — agent-orchestration auth healthy
 */
const HEALTHY_STATUSES = new Set(["ok", "up", "configured"]);

/** "unregistered" is excluded from the derivation, not counted as healthy. */
function degrades(report: StatusReport): boolean {
  return report.status !== "unregistered" && !HEALTHY_STATUSES.has(report.status);
}

export function deriveOverallStatus(
  snapshot: Record<StatusComponent, StatusReport>,
): "ok" | "degraded" {
  const reports = [snapshot.bridge, snapshot.store, snapshot.auth];
  return reports.some(degrades) ? "degraded" : "ok";
}

export interface HealthRouteOptions {
  statusRegistry: StatusRegistry;
}

export function registerHealthRoute(
  app: FastifyInstance,
  options: HealthRouteOptions,
): void {
  app.get("/api/health", async (): Promise<HealthResponse> => {
    const snapshot = await options.statusRegistry.snapshot();
    return {
      status: deriveOverallStatus(snapshot),
      process: {
        pid: process.pid,
        uptimeSeconds: Math.round(process.uptime()),
        version: process.version,
      },
      bridge: snapshot.bridge,
      store: snapshot.store,
      auth: snapshot.auth,
    };
  });
}
