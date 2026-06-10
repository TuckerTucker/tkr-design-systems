/**
 * Typed pipeline results — errors cross the artifact-pipeline seam as
 * values, never as thrown exceptions (architecture contract). Callers
 * (agent-orchestration, studio-api) branch on the stable `code`.
 */
import type { StoreError } from "@studio/contract";

export type PipelineErrorCode =
  /** Generation output unreadable: missing svgPath/specPath file or empty svgText. */
  | "INGEST_OUTPUT_MISSING"
  /** Addressed version does not exist; headVersion is unchanged. */
  | "VERSION_NOT_FOUND"
  /** Artifact (or workspace) does not exist. */
  | "ARTIFACT_NOT_FOUND"
  /** SVG failed well-formedness verification; never served broken. */
  | "SVG_MALFORMED"
  /** wireframe.spec.yaml unparseable or missing required fields. */
  | "SPEC_INVALID"
  /** Version graph corruption: a parent link does not resolve. */
  | "GRAPH_CORRUPT"
  /** Underlying workspace-store failure (io/corrupt/conflict). */
  | "STORE_FAILURE";

export interface PipelineError {
  code: PipelineErrorCode;
  /** What failed and how to fix it, surfaceable in place. */
  message: string;
  /** Offending path, field, or diagnostic context. */
  detail?: Record<string, unknown>;
  cause?: unknown;
}

/** Every pipeline method resolves to one of these — never a rejection. */
export type PipelineResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: PipelineError };

export function ok<T>(value: T): PipelineResult<T> {
  return { ok: true, value };
}

export function fail<T = never>(error: PipelineError): PipelineResult<T> {
  return { ok: false, error };
}

export function ingestOutputMissing(
  message: string,
  detail: Record<string, unknown>,
  cause?: unknown,
): PipelineError {
  return { code: "INGEST_OUTPUT_MISSING", message, detail, cause };
}

export function versionNotFound(
  artifactId: string,
  version: number,
): PipelineError {
  return {
    code: "VERSION_NOT_FOUND",
    message: `Version ${version} of artifact "${artifactId}" does not exist`,
    detail: { artifactId, version },
  };
}

export function svgMalformed(
  message: string,
  detail?: Record<string, unknown>,
): PipelineError {
  return {
    code: "SVG_MALFORMED",
    message,
    ...(detail !== undefined ? { detail } : {}),
  };
}

export function specInvalid(
  message: string,
  detail?: Record<string, unknown>,
): PipelineError {
  return {
    code: "SPEC_INVALID",
    message,
    ...(detail !== undefined ? { detail } : {}),
  };
}

export function graphCorrupt(
  message: string,
  detail: Record<string, unknown>,
): PipelineError {
  return { code: "GRAPH_CORRUPT", message, detail };
}

/**
 * Project a StoreError across the pipeline seam. A not_found on an
 * artifact/version read keeps its addressing semantics; everything else
 * is a STORE_FAILURE carrying the store's actionable message.
 */
export function fromStoreError(
  error: StoreError,
  notFoundCode: Extract<
    PipelineErrorCode,
    "VERSION_NOT_FOUND" | "ARTIFACT_NOT_FOUND"
  > = "ARTIFACT_NOT_FOUND",
): PipelineError {
  if (error.code === "not_found") {
    return {
      code: notFoundCode,
      message: error.message,
      ...(error.path !== undefined ? { detail: { path: error.path } } : {}),
    };
  }
  return {
    code: "STORE_FAILURE",
    message: error.message,
    detail: {
      storeCode: error.code,
      ...(error.path !== undefined ? { path: error.path } : {}),
    },
    cause: error.cause,
  };
}
