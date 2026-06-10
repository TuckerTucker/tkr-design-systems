/**
 * Health contract — canonical home for the GET /api/health response shape.
 *
 * Owned by studio-server. The client and scripted clients import these types
 * from `@studio/contract`; no capability redeclares them.
 */

/**
 * Status of a single server component as supplied by its owning capability
 * through the StatusRegistry seam.
 *
 * Known status values by component:
 * - bridge (mcp-bridge):           "starting" | "up" | "restarting" | "failed" | "stopped"
 * - store (workspace-store):       "ok" | failure statuses
 * - auth (agent-orchestration):    "configured" | "missing" | "invalid"
 * - any component, server-derived: "unregistered" (no provider yet) |
 *                                  "unavailable" (provider threw or timed out)
 */
export interface StatusReport {
  /** Component status keyword — see the per-component values above. */
  status: string;
  /** Human-readable context, surfaced in place by the client. */
  detail?: string;
}

/**
 * Response body of GET /api/health.
 *
 * The endpoint always answers HTTP 200 — liveness is expressed by answering,
 * readiness by the body. `status` is "ok" when every registered component
 * reports a healthy status ("ok", "up", or "configured"); unregistered
 * components do not degrade the overall status.
 */
export interface HealthResponse {
  status: "ok" | "degraded";
  process: {
    /** Process id of the studio server. */
    pid: number;
    /** Whole seconds since the process started. */
    uptimeSeconds: number;
    /** Node.js runtime version (process.version), e.g. "v20.19.5". */
    version: string;
  };
  /** Supplied by mcp-bridge via the StatusRegistry. */
  bridge: StatusReport;
  /** Supplied by workspace-store via the StatusRegistry. */
  store: StatusReport;
  /** Supplied by agent-orchestration via the StatusRegistry. */
  auth: StatusReport;
}
