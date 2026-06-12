/**
 * Typed HTTP client over the /api/library/* routes (wire shapes from
 * @studio/contract, owned by studio-api). Fetch is injected (IoC) so
 * component tests exercise failure paths deterministically; integration
 * tests pass a base URL pointing at a real composed server.
 *
 * Errors cross this seam as typed results, never thrown exceptions. Every
 * call accepts an AbortSignal so the panel cancels in-flight fetches for
 * an abandoned system (rapid switching never queues wasted work).
 */
import type {
  ApiError,
  ComponentDetail,
  ComponentIndexEntry,
  ErrorResponse,
  LayoutTemplate,
  LibrarySystem,
  TokenSetResponse,
} from "@studio/contract";

export type LibraryResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ApiError; aborted?: boolean };

export interface LibraryApi {
  listSystems(signal?: AbortSignal): Promise<LibraryResult<LibrarySystem[]>>;
  getTokens(
    systemId: string,
    signal?: AbortSignal,
  ): Promise<LibraryResult<TokenSetResponse>>;
  getComponents(
    systemId: string,
    signal?: AbortSignal,
  ): Promise<LibraryResult<ComponentIndexEntry[]>>;
  getComponentDetail(
    systemId: string,
    componentId: string,
    signal?: AbortSignal,
  ): Promise<LibraryResult<ComponentDetail>>;
  getLayouts(
    systemId: string,
    signal?: AbortSignal,
  ): Promise<LibraryResult<LayoutTemplate[]>>;
}

export interface LibraryApiOptions {
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

function isAbortError(cause: unknown): boolean {
  return cause instanceof Error && cause.name === "AbortError";
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

export function createLibraryApi(options: LibraryApiOptions = {}): LibraryApi {
  const base = options.baseUrl ?? "";
  const fetchImpl = options.fetchImpl ?? fetch;

  async function getJson<T>(
    route: string,
    signal: AbortSignal | undefined,
    validate: (body: unknown) => body is T,
  ): Promise<LibraryResult<T>> {
    let response: Response;
    try {
      response = await fetchImpl(`${base}${route}`, {
        method: "GET",
        ...(signal !== undefined ? { signal } : {}),
      });
    } catch (cause) {
      if (isAbortError(cause)) {
        return {
          ok: false,
          aborted: true,
          error: networkError("the request was cancelled"),
        };
      }
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
    if (!validate(parsed)) {
      return { ok: false, error: malformedError(route) };
    }
    return { ok: true, value: parsed };
  }

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  function isSystemList(body: unknown): body is LibrarySystem[] {
    return (
      Array.isArray(body) &&
      body.every(
        (entry) =>
          isRecord(entry) &&
          typeof entry["id"] === "string" &&
          typeof entry["name"] === "string" &&
          typeof entry["status"] === "string",
      )
    );
  }

  function isTokenSet(body: unknown): body is TokenSetResponse {
    return (
      isRecord(body) &&
      typeof body["systemId"] === "string" &&
      isRecord(body["tokens"])
    );
  }

  function isComponentIndex(body: unknown): body is ComponentIndexEntry[] {
    return (
      Array.isArray(body) &&
      body.every(
        (entry) =>
          isRecord(entry) &&
          typeof entry["id"] === "string" &&
          typeof entry["name"] === "string" &&
          Array.isArray(entry["variants"]),
      )
    );
  }

  function isComponentDetail(body: unknown): body is ComponentDetail {
    return (
      isRecord(body) &&
      typeof body["id"] === "string" &&
      typeof body["name"] === "string" &&
      Array.isArray(body["variants"]) &&
      typeof body["svg"] === "string"
    );
  }

  function isLayoutList(body: unknown): body is LayoutTemplate[] {
    return (
      Array.isArray(body) &&
      body.every(
        (entry) =>
          isRecord(entry) &&
          typeof entry["id"] === "string" &&
          typeof entry["name"] === "string" &&
          typeof entry["archetype"] === "string" &&
          Array.isArray(entry["platforms"]),
      )
    );
  }

  return {
    listSystems(signal) {
      return getJson("/api/library/systems", signal, isSystemList);
    },
    getTokens(systemId, signal) {
      return getJson(
        `/api/library/${encodeURIComponent(systemId)}/tokens`,
        signal,
        isTokenSet,
      );
    },
    getComponents(systemId, signal) {
      return getJson(
        `/api/library/${encodeURIComponent(systemId)}/components`,
        signal,
        isComponentIndex,
      );
    },
    getComponentDetail(systemId, componentId, signal) {
      return getJson(
        `/api/library/${encodeURIComponent(systemId)}/components/${encodeURIComponent(componentId)}`,
        signal,
        isComponentDetail,
      );
    },
    getLayouts(systemId, signal) {
      return getJson(
        `/api/library/${encodeURIComponent(systemId)}/layouts`,
        signal,
        isLayoutList,
      );
    },
  };
}
