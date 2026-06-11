/**
 * Typed HTTP client for the studio-api routes the shell consumes —
 * preferences and workspaces. Fetch is injected (IoC) so component tests
 * exercise failure paths without network flakiness; integration tests pass
 * a base URL pointing at a real composed server.
 *
 * Errors cross this seam as typed results, never thrown exceptions.
 */
import type {
  ApiError,
  ErrorResponse,
  LayoutPreference,
  WorkspaceCreateRequest,
  WorkspaceSummary,
} from "@studio/contract";

export type ApiResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ApiError };

export interface ApiClient {
  getPreferences(): Promise<ApiResult<LayoutPreference>>;
  putPreferences(
    preference: LayoutPreference,
  ): Promise<ApiResult<LayoutPreference>>;
  listWorkspaces(): Promise<ApiResult<WorkspaceSummary[]>>;
  createWorkspace(
    request?: WorkspaceCreateRequest,
  ): Promise<ApiResult<WorkspaceSummary>>;
}

export interface ApiClientOptions {
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

function isErrorResponse(body: unknown): body is ErrorResponse {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as { error: unknown }).error === "object"
  );
}

export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  const base = options.baseUrl ?? "";
  const fetchImpl = options.fetchImpl ?? fetch;

  async function request<T>(
    method: string,
    route: string,
    body?: unknown,
  ): Promise<ApiResult<T>> {
    let response: Response;
    try {
      response = await fetchImpl(`${base}${route}`, {
        method,
        ...(body !== undefined
          ? {
              headers: { "content-type": "application/json" },
              body: JSON.stringify(body),
            }
          : {}),
      });
    } catch (cause) {
      return {
        ok: false,
        error: networkError(
          cause instanceof Error ? cause.message : String(cause),
        ),
      };
    }
    let parsed: unknown = null;
    try {
      parsed = await response.json();
    } catch {
      parsed = null;
    }
    if (!response.ok) {
      if (isErrorResponse(parsed)) {
        return { ok: false, error: parsed.error };
      }
      return {
        ok: false,
        error: networkError(`HTTP ${response.status} on ${route}`),
      };
    }
    return { ok: true, value: parsed as T };
  }

  return {
    getPreferences: () => request<LayoutPreference>("GET", "/api/preferences"),
    putPreferences: (preference) =>
      request<LayoutPreference>("PUT", "/api/preferences", preference),
    listWorkspaces: () => request<WorkspaceSummary[]>("GET", "/api/workspaces"),
    createWorkspace: (createRequest = {}) =>
      request<WorkspaceSummary>("POST", "/api/workspaces", createRequest),
  };
}
