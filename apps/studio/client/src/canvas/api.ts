/**
 * Typed fetchers for the artifact routes the canvas consumes — artifact
 * list/detail, sanitized version SVG, parsed spec metadata, the
 * ComplianceResponse projection, and restore-as-new-head. Fetch is
 * injected (IoC) so component tests exercise failure paths
 * deterministically; integration tests pass a base URL pointing at a real
 * composed server.
 *
 * Errors cross this seam as typed results, never thrown exceptions.
 * Responses are validated at the boundary before entering canvas state.
 */
import type {
  ApiError,
  ArtifactDetail,
  ArtifactSummary,
  ComplianceResponse,
  ErrorResponse,
  ParsedSpecMetadata,
  RestoreResponse,
} from "@studio/contract";

export type CanvasResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ApiError };

/**
 * Compliance is the one route where a non-2xx is a STATE, not a failure:
 * compliance_pending and compliance_unavailable render in place on the bar.
 */
export type ComplianceFetchResult =
  | { kind: "completed"; response: ComplianceResponse }
  | { kind: "pending" }
  | { kind: "unavailable"; reason: string }
  | { kind: "error"; error: ApiError };

export interface CanvasApi {
  listArtifacts(workspaceId: string): Promise<CanvasResult<ArtifactSummary[]>>;
  getArtifactDetail(
    workspaceId: string,
    artifactId: string,
  ): Promise<CanvasResult<ArtifactDetail>>;
  /** Sanitized image/svg+xml content with stable node IDs preserved. */
  getVersionSvg(
    workspaceId: string,
    artifactId: string,
    version: number,
  ): Promise<CanvasResult<string>>;
  getVersionSpec(
    workspaceId: string,
    artifactId: string,
    version: number,
  ): Promise<CanvasResult<ParsedSpecMetadata>>;
  getVersionCompliance(
    workspaceId: string,
    artifactId: string,
    version: number,
  ): Promise<ComplianceFetchResult>;
  /** Restore-as-new-head; returns the new head's VersionSummary. */
  restoreVersion(
    workspaceId: string,
    artifactId: string,
    version: number,
  ): Promise<CanvasResult<RestoreResponse>>;
}

export interface CanvasApiOptions {
  /** "" in the browser (same origin); absolute in integration tests. */
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

function networkError(detail: string): ApiError {
  return {
    code: "internal_error",
    message: `The studio server could not be reached: ${detail}`,
    fix: "Check that studio-server is running, then retry.",
  };
}

function malformedError(route: string): ApiError {
  return {
    code: "internal_error",
    message: `The response from ${route} did not match the expected shape.`,
    fix: "Reload the studio; if this persists, check the server logs.",
  };
}

function isErrorResponse(body: unknown): body is ErrorResponse {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as { error: unknown }).error === "object" &&
    (body as { error: unknown }).error !== null
  );
}

/** Boundary validation: the spec endpoint serves parsed wireframe.spec.yaml. */
export function parseSpecResponse(
  body: unknown,
): ParsedSpecMetadata | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  const candidate = body as {
    wireframe?: {
      platform?: unknown;
      dimensions?: { width?: unknown; height?: unknown };
    };
    design_system?: { components_used?: unknown };
  };
  const wireframe = candidate.wireframe;
  if (
    wireframe === undefined ||
    (wireframe.platform !== "mobile" && wireframe.platform !== "desktop") ||
    typeof wireframe.dimensions?.width !== "number" ||
    typeof wireframe.dimensions.height !== "number"
  ) {
    return null;
  }
  const designSystem = candidate.design_system;
  if (
    designSystem === undefined ||
    !Array.isArray(designSystem.components_used)
  ) {
    return null;
  }
  return body as ParsedSpecMetadata;
}

function isComplianceResponse(body: unknown): body is ComplianceResponse {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const candidate = body as { status?: unknown; rules?: unknown };
  return (
    (candidate.status === "pass" ||
      candidate.status === "warn" ||
      candidate.status === "fail") &&
    Array.isArray(candidate.rules)
  );
}

export function createCanvasApi(options: CanvasApiOptions = {}): CanvasApi {
  const base = options.baseUrl ?? "";
  const fetchImpl = options.fetchImpl ?? fetch;

  async function rawRequest(
    method: string,
    route: string,
  ): Promise<
    | { ok: true; response: Response }
    | { ok: false; error: ApiError }
  > {
    try {
      const response = await fetchImpl(`${base}${route}`, { method });
      return { ok: true, response };
    } catch (cause) {
      return {
        ok: false,
        error: networkError(
          cause instanceof Error ? cause.message : String(cause),
        ),
      };
    }
  }

  async function readError(
    response: Response,
    route: string,
  ): Promise<ApiError> {
    let parsed: unknown = null;
    try {
      parsed = await response.json();
    } catch {
      parsed = null;
    }
    if (isErrorResponse(parsed)) {
      return parsed.error;
    }
    return networkError(`HTTP ${response.status} on ${route}`);
  }

  async function jsonRequest<T>(
    route: string,
    validate?: (body: unknown) => T | null,
  ): Promise<CanvasResult<T>> {
    const raw = await rawRequest("GET", route);
    if (!raw.ok) {
      return raw;
    }
    if (!raw.response.ok) {
      return { ok: false, error: await readError(raw.response, route) };
    }
    let parsed: unknown;
    try {
      parsed = await raw.response.json();
    } catch {
      return { ok: false, error: malformedError(route) };
    }
    if (validate !== undefined) {
      const validated = validate(parsed);
      if (validated === null) {
        return { ok: false, error: malformedError(route) };
      }
      return { ok: true, value: validated };
    }
    return { ok: true, value: parsed as T };
  }

  function versionRoute(
    workspaceId: string,
    artifactId: string,
    version: number,
    suffix: string,
  ): string {
    return `/api/workspaces/${encodeURIComponent(workspaceId)}/artifacts/${encodeURIComponent(artifactId)}/versions/${version}/${suffix}`;
  }

  return {
    listArtifacts(workspaceId) {
      return jsonRequest<ArtifactSummary[]>(
        `/api/workspaces/${encodeURIComponent(workspaceId)}/artifacts`,
      );
    },

    getArtifactDetail(workspaceId, artifactId) {
      return jsonRequest<ArtifactDetail>(
        `/api/workspaces/${encodeURIComponent(workspaceId)}/artifacts/${encodeURIComponent(artifactId)}`,
      );
    },

    async getVersionSvg(workspaceId, artifactId, version) {
      const route = versionRoute(workspaceId, artifactId, version, "svg");
      const raw = await rawRequest("GET", route);
      if (!raw.ok) {
        return raw;
      }
      if (!raw.response.ok) {
        return { ok: false, error: await readError(raw.response, route) };
      }
      const text = await raw.response.text();
      return { ok: true, value: text };
    },

    getVersionSpec(workspaceId, artifactId, version) {
      return jsonRequest<ParsedSpecMetadata>(
        versionRoute(workspaceId, artifactId, version, "spec"),
        parseSpecResponse,
      );
    },

    async getVersionCompliance(workspaceId, artifactId, version) {
      const route = versionRoute(workspaceId, artifactId, version, "compliance");
      const raw = await rawRequest("GET", route);
      if (!raw.ok) {
        return { kind: "error", error: raw.error };
      }
      if (!raw.response.ok) {
        const error = await readError(raw.response, route);
        if (error.code === "compliance_pending") {
          return { kind: "pending" };
        }
        if (error.code === "compliance_unavailable") {
          return { kind: "unavailable", reason: error.message };
        }
        return { kind: "error", error };
      }
      let parsed: unknown;
      try {
        parsed = await raw.response.json();
      } catch {
        return { kind: "error", error: malformedError(route) };
      }
      if (!isComplianceResponse(parsed)) {
        return { kind: "error", error: malformedError(route) };
      }
      return { kind: "completed", response: parsed };
    },

    async restoreVersion(workspaceId, artifactId, version) {
      const route = versionRoute(workspaceId, artifactId, version, "restore");
      const raw = await rawRequest("POST", route);
      if (!raw.ok) {
        return raw;
      }
      if (!raw.response.ok) {
        return { ok: false, error: await readError(raw.response, route) };
      }
      let parsed: unknown;
      try {
        parsed = await raw.response.json();
      } catch {
        return { ok: false, error: malformedError(route) };
      }
      const summary = parsed as RestoreResponse;
      if (typeof summary.number !== "number") {
        return { ok: false, error: malformedError(route) };
      }
      return { ok: true, value: summary };
    },
  };
}
