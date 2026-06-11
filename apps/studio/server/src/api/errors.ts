/**
 * Typed-result → HTTP status / ApiError mapping — the error seam of the
 * API boundary. Domain failures (StoreError, PipelineError, BridgeError,
 * AgentEvent errors) cross this seam as values and leave it as structured
 * ErrorResponse bodies or chat.error payloads; nothing internal (stack
 * traces, paths, dependency details) ever reaches a client.
 */
import type {
  AgentErrorCode,
  ApiError,
  ApiErrorCode,
  BridgeError,
  ErrorResponse,
  StoreError,
} from "@studio/contract";

import type { PipelineError } from "../artifact-pipeline/index.js";

export function apiError(
  code: ApiErrorCode,
  message: string,
  fix: string,
  field?: string,
): ApiError {
  return { code, message, fix, ...(field !== undefined ? { field } : {}) };
}

export function errorResponse(error: ApiError): ErrorResponse {
  return { error };
}

/** HTTP status for an ApiError code. */
export function httpStatusFor(code: ApiErrorCode): number {
  switch (code) {
    case "invalid_message":
    case "invalid_field":
    case "chip_invalid":
      return 400;
    case "payload_too_large":
      return 413;
    case "workspace_not_found":
    case "artifact_not_found":
    case "version_not_found":
    case "compliance_pending":
    case "system_not_found":
    case "component_not_found":
    case "chips_not_found":
      return 404;
    case "turn_in_progress":
    case "turn_not_active":
      return 409;
    case "auth_missing":
    case "auth_invalid":
      return 401;
    case "bridge_unavailable":
    case "compliance_unavailable":
    case "mcp_unavailable":
      return 503;
    case "not_attached":
    case "cancelled":
    case "tool_failed":
    case "blueprint_invalid":
    case "agent_failed":
    case "store_failure":
    case "internal_error":
      return code === "not_attached" ? 400 : 500;
  }
}

const WORKSPACE_FIX = "List existing workspaces via GET /api/workspaces.";
const ARTIFACT_FIX =
  "List the workspace's artifacts via GET /api/workspaces/:wsId/artifacts.";
const VERSION_FIX =
  "Read the artifact's version list via GET /api/workspaces/:wsId/artifacts/:artId.";
const STORE_FIX =
  "Check the server logs and the workspaces directory permissions, then retry.";

/** Project a workspace-store error onto the API error shape. */
export function fromStoreError(
  error: StoreError,
  notFound: Extract<
    ApiErrorCode,
    "workspace_not_found" | "artifact_not_found" | "version_not_found"
  > = "workspace_not_found",
): ApiError {
  if (error.code === "not_found") {
    const fix =
      notFound === "workspace_not_found"
        ? WORKSPACE_FIX
        : notFound === "artifact_not_found"
          ? ARTIFACT_FIX
          : VERSION_FIX;
    return apiError(notFound, error.message, fix);
  }
  return apiError("store_failure", error.message, STORE_FIX);
}

/** Project an artifact-pipeline error onto the API error shape. */
export function fromPipelineError(error: PipelineError): ApiError {
  switch (error.code) {
    case "ARTIFACT_NOT_FOUND":
      return apiError("artifact_not_found", error.message, ARTIFACT_FIX);
    case "VERSION_NOT_FOUND":
      return apiError("version_not_found", error.message, VERSION_FIX);
    case "STORE_FAILURE":
      return apiError("store_failure", error.message, STORE_FIX);
    default:
      return apiError(
        "internal_error",
        error.message,
        "Retry the request; if the failure persists, check the server logs.",
      );
  }
}

/** Project a bridge error onto the API error shape (library routes). */
export function fromBridgeError(error: BridgeError): ApiError {
  // ds_* tools carry the stable SYSTEM_NOT_FOUND code; wf_* tools use the
  // flat error shape (plain strings) — their registry-miss message is the
  // skill's stable phrasing ("… is not in the registry").
  const systemMiss =
    error.kind === "tool" &&
    (error.code === "SYSTEM_NOT_FOUND" ||
      error.message.includes("is not in the registry"));
  if (systemMiss) {
    return apiError(
      "system_not_found",
      error.message,
      "List registered systems via GET /api/library/systems.",
    );
  }
  if (error.kind === "tool") {
    return apiError(
      "tool_failed",
      error.message,
      "Adjust the request per the message and retry.",
    );
  }
  return apiError(
    "bridge_unavailable",
    `The design-systems bridge could not serve this request: ${error.message}`,
    "Check bridge.status (also reported on GET /api/health) and retry once the bridge is up.",
  );
}

/** Map an agent error event code onto the API vocabulary. */
export function fromAgentErrorCode(code: AgentErrorCode): ApiErrorCode {
  // The agent's "session_busy" is the wire's "turn_in_progress"; every
  // other agent code is part of the ApiErrorCode union verbatim.
  return code === "session_busy" ? "turn_in_progress" : code;
}
