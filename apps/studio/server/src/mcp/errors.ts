/**
 * Translation from MCP protocol shapes and Python skill result shapes into
 * the typed BridgeResult contract (@studio/contract bridge.ts — owned by
 * mcp-bridge; the type declarations live there, the translation lives here).
 *
 * Every function in this module is total: malformed input becomes a
 * protocol-kind BridgeError, never a thrown exception. This is what makes
 * the tool wrappers total functions over BridgeResult.
 */
import type {
  BridgeError,
  BridgeResult,
  BridgeWarning,
} from "@studio/contract";

export type {
  BridgeError,
  BridgeErrorKind,
  BridgeResult,
  BridgeState,
  BridgeStatus,
  BridgeWarning,
} from "@studio/contract";

/** Successful result with optional skill warnings passed through. */
export function ok<T>(value: T, warnings: BridgeWarning[] = []): BridgeResult<T> {
  return { ok: true, value, warnings };
}

/** Failed result from a constructed BridgeError. */
export function fail<T = never>(error: BridgeError): BridgeResult<T> {
  return { ok: false, error };
}

/** Transport/JSON-RPC failure, isError response, or unparseable content. */
export function protocolError(
  message: string,
  detail?: Record<string, unknown>,
): BridgeError {
  return detail === undefined
    ? { kind: "protocol", message }
    : { kind: "protocol", message, detail };
}

/** Per-call timeout expiry. */
export function timeoutError(tool: string, timeoutMs: number): BridgeError {
  return {
    kind: "timeout",
    message: `${tool} did not respond within ${timeoutMs}ms`,
    detail: { tool, timeoutMs },
  };
}

/** Caller aborted via AbortSignal. */
export function cancelledError(tool: string): BridgeError {
  return {
    kind: "cancelled",
    message: `${tool} was cancelled by the caller`,
    detail: { tool },
  };
}

/** Bridge failed/stopped or restart budget exhausted. */
export function bridgeDownError(message: string): BridgeError {
  return { kind: "bridge_down", message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function excerpt(text: string, max = 200): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * Translate a tool-level failure's `errors` list into one BridgeError of
 * kind "tool". Handles both shapes the server emits:
 *
 * - structured skill entries: `[{code, message, detail}, ...]`
 * - plain strings (flat wf_* shape and the server's `_error_result`
 *   exception catchall): `["<message>", ...]`
 *
 * The first entry supplies code/message/detail; any remaining entries are
 * preserved under `detail.additional_errors`.
 */
export function toolErrorFromEntries(entries: unknown): BridgeError {
  if (!Array.isArray(entries) || entries.length === 0) {
    return {
      kind: "tool",
      message: "Tool reported failure without any error entries",
    };
  }

  const [first, ...rest] = entries;
  let code: string | undefined;
  let message: string;
  let detail: Record<string, unknown> | undefined;

  if (typeof first === "string") {
    message = first;
  } else if (isRecord(first) && typeof first["message"] === "string") {
    message = first["message"];
    if (typeof first["code"] === "string") {
      code = first["code"];
    }
    if (isRecord(first["detail"])) {
      detail = { ...first["detail"] };
    }
  } else {
    message = "Tool reported failure with an unrecognized error entry";
    detail = { entry: first };
  }

  if (rest.length > 0) {
    detail = { ...(detail ?? {}), additional_errors: rest };
  }

  const error: BridgeError = { kind: "tool", message };
  if (code !== undefined) {
    error.code = code;
  }
  if (detail !== undefined) {
    error.detail = detail;
  }
  return error;
}

/** Map raw skill warning entries to the contract shape, tolerating gaps. */
function toBridgeWarnings(raw: unknown): BridgeWarning[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((entry): BridgeWarning => {
    if (isRecord(entry)) {
      return {
        code: typeof entry["code"] === "string" ? entry["code"] : "WARNING",
        message:
          typeof entry["message"] === "string" ? entry["message"] : "",
        detail: isRecord(entry["detail"]) ? entry["detail"] : {},
      };
    }
    return { code: "WARNING", message: String(entry), detail: {} };
  });
}

/**
 * Parse a FastMCP CallToolResult into the tool's JSON payload. FastMCP
 * serializes each tool's dict return value as JSON text in
 * `content[0].text`; an `isError` response or unparseable content is a
 * protocol-kind failure.
 */
export function parseToolResultContent(
  result: unknown,
): BridgeResult<unknown> {
  if (!isRecord(result)) {
    return fail(
      protocolError("Tool call returned a non-object result", {
        result_type: typeof result,
      }),
    );
  }

  const content = result["content"];
  const firstContent = Array.isArray(content) ? content[0] : undefined;
  const text =
    isRecord(firstContent) &&
    firstContent["type"] === "text" &&
    typeof firstContent["text"] === "string"
      ? firstContent["text"]
      : undefined;

  if (result["isError"] === true) {
    return fail(
      protocolError(
        text !== undefined
          ? `Tool call failed: ${excerpt(text)}`
          : "Tool call failed with an isError response and no text content",
      ),
    );
  }

  if (text === undefined) {
    return fail(
      protocolError(
        "Tool call returned no text content to parse",
        { content },
      ),
    );
  }

  try {
    return ok(JSON.parse(text) as unknown);
  } catch {
    return fail(
      protocolError("Tool returned content that is not valid JSON", {
        text_excerpt: excerpt(text),
      }),
    );
  }
}

/**
 * Unwrap the design_system_skill Result envelope:
 * `{ok: true, data, warnings?}` → success with `data` and warnings passed
 * through; `{ok: false, errors: [...]}` → tool-kind failure.
 */
export function unwrapEnvelope(payload: unknown): BridgeResult<unknown> {
  if (!isRecord(payload) || typeof payload["ok"] !== "boolean") {
    return fail(
      protocolError("Tool payload is not a recognizable Result envelope", {
        payload_excerpt: excerpt(JSON.stringify(payload) ?? "undefined"),
      }),
    );
  }
  if (payload["ok"]) {
    return ok(payload["data"], toBridgeWarnings(payload["warnings"]));
  }
  return fail(toolErrorFromEntries(payload["errors"]));
}

/**
 * Unwrap the flat wf_* dict shape: `{ok: true, ...payload}` → success with
 * the remaining keys; `{ok: false, errors: [...]}` → tool-kind failure
 * (error entries are plain strings on this shape).
 */
export function unwrapFlat(
  payload: unknown,
): BridgeResult<Record<string, unknown>> {
  if (!isRecord(payload) || typeof payload["ok"] !== "boolean") {
    return fail(
      protocolError("Tool payload is not a recognizable flat result", {
        payload_excerpt: excerpt(JSON.stringify(payload) ?? "undefined"),
      }),
    );
  }
  if (!payload["ok"]) {
    return fail(toolErrorFromEntries(payload["errors"]));
  }
  const rest: Record<string, unknown> = { ...payload };
  delete rest["ok"];
  return ok(rest);
}

/**
 * Translate a rejection thrown by the MCP SDK during a call (JSON-RPC
 * error, connection closed mid-call, abort propagation) into a
 * protocol-kind BridgeError.
 */
export function translateInvocationError(
  tool: string,
  err: unknown,
): BridgeError {
  const message = err instanceof Error ? err.message : String(err);
  return protocolError(`${tool} failed at the MCP protocol layer: ${message}`, {
    tool,
  });
}
