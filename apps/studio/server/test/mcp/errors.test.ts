/**
 * Unit tests for the bridge's error translation — every BridgeErrorKind
 * path over pure inputs (the real-server behaviors are covered by the
 * integration suites; this file exercises the translation logic itself).
 */
import { describe, expect, it } from "vitest";

import {
  bridgeDownError,
  cancelledError,
  parseToolResultContent,
  protocolError,
  timeoutError,
  toolErrorFromEntries,
  translateInvocationError,
  unwrapEnvelope,
  unwrapFlat,
} from "../../src/mcp/errors.js";
import { missingDirectCallTools } from "../../src/mcp/transport.js";

function textResult(payload: unknown): unknown {
  return { content: [{ type: "text", text: JSON.stringify(payload) }] };
}

describe("parseToolResultContent", () => {
  it("parses FastMCP JSON text content", () => {
    const result = parseToolResultContent(textResult({ ok: true, data: 1 }));
    expect(result).toEqual({
      ok: true,
      value: { ok: true, data: 1 },
      warnings: [],
    });
  });

  it("translates an isError response to kind protocol", () => {
    const result = parseToolResultContent({
      content: [{ type: "text", text: "tool exploded" }],
      isError: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("protocol");
      expect(result.error.message).toContain("tool exploded");
    }
  });

  it("translates missing content to kind protocol", () => {
    const result = parseToolResultContent({ content: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("protocol");
    }
  });

  it("translates non-text content to kind protocol", () => {
    const result = parseToolResultContent({
      content: [{ type: "image", data: "...", mimeType: "image/png" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("protocol");
    }
  });

  it("translates unparseable JSON to kind protocol with an excerpt", () => {
    const result = parseToolResultContent({
      content: [{ type: "text", text: "not json {" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("protocol");
      expect(result.error.detail?.["text_excerpt"]).toBe("not json {");
    }
  });

  it("translates a non-object result to kind protocol", () => {
    const result = parseToolResultContent(undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("protocol");
    }
  });
});

describe("unwrapEnvelope (ds_* skill Result shape)", () => {
  it("unwraps a success envelope without warnings", () => {
    const result = unwrapEnvelope({ ok: true, data: [{ id: "swiss" }] });
    expect(result).toEqual({
      ok: true,
      value: [{ id: "swiss" }],
      warnings: [],
    });
  });

  it("passes warnings through unmodified on success", () => {
    const warning = {
      code: "SPEC_FILE_MISSING",
      message: "Registered spec 'x' not found on disk.",
      detail: { system_id: "x", expected_path: "/nope" },
    };
    const result = unwrapEnvelope({ ok: true, data: [], warnings: [warning] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings).toEqual([warning]);
    }
  });

  it("translates structured error entries to kind tool with code passthrough", () => {
    const result = unwrapEnvelope({
      ok: false,
      errors: [
        {
          code: "SYSTEM_NOT_FOUND",
          message: "System 'x' is not in the registry.",
          detail: { system_id: "x" },
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("tool");
      expect(result.error.code).toBe("SYSTEM_NOT_FOUND");
      expect(result.error.message).toContain("not in the registry");
      expect(result.error.detail?.["system_id"]).toBe("x");
    }
  });

  it("keeps additional error entries in detail", () => {
    const result = unwrapEnvelope({
      ok: false,
      errors: [
        { code: "SPEC_PARSE_FAILED", message: "first", detail: {} },
        { code: "INTERNAL", message: "second", detail: {} },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("first");
      expect(result.error.detail?.["additional_errors"]).toHaveLength(1);
    }
  });

  it("translates plain-string error entries (the _error_result catchall)", () => {
    const result = unwrapEnvelope({
      ok: false,
      errors: ["unexpected exception text"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("tool");
      expect(result.error.code).toBeUndefined();
      expect(result.error.message).toBe("unexpected exception text");
    }
  });

  it("translates an empty error list to a tool error with a message", () => {
    const result = unwrapEnvelope({ ok: false, errors: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("tool");
      expect(result.error.message.length).toBeGreaterThan(0);
    }
  });

  it("translates a payload without an ok discriminant to kind protocol", () => {
    const result = unwrapEnvelope({ data: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("protocol");
    }
  });
});

describe("unwrapFlat (wf_* flat dict shape)", () => {
  it("unwraps a flat success payload without the ok discriminant", () => {
    const result = unwrapFlat({ ok: true, system_id: "swiss", palette: [] });
    expect(result).toEqual({
      ok: true,
      value: { system_id: "swiss", palette: [] },
      warnings: [],
    });
  });

  it("translates flat string errors to kind tool", () => {
    const result = unwrapFlat({
      ok: false,
      errors: ["spec failed to load", "secondary detail"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("tool");
      expect(result.error.message).toBe("spec failed to load");
      expect(result.error.detail?.["additional_errors"]).toEqual([
        "secondary detail",
      ]);
    }
  });

  it("translates a non-object payload to kind protocol", () => {
    const result = unwrapFlat([1, 2, 3]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("protocol");
    }
  });
});

describe("toolErrorFromEntries", () => {
  it("handles an unrecognized entry shape without throwing", () => {
    const error = toolErrorFromEntries([42]);
    expect(error.kind).toBe("tool");
    expect(error.detail?.["entry"]).toBe(42);
  });

  it("handles a non-array errors value", () => {
    const error = toolErrorFromEntries("oops");
    expect(error.kind).toBe("tool");
  });
});

describe("error constructors", () => {
  it("classifies timeout, cancelled, bridge_down, and protocol kinds", () => {
    expect(timeoutError("ds_load_system", 50).kind).toBe("timeout");
    expect(timeoutError("ds_load_system", 50).message).toContain("50ms");
    expect(cancelledError("wf_get_tokens").kind).toBe("cancelled");
    expect(bridgeDownError("bridge is stopped").kind).toBe("bridge_down");
    expect(protocolError("boom").kind).toBe("protocol");
  });

  it("translates a thrown SDK error to kind protocol with the tool name", () => {
    const error = translateInvocationError(
      "ds_list_systems",
      new Error("Connection closed"),
    );
    expect(error.kind).toBe("protocol");
    expect(error.message).toContain("ds_list_systems");
    expect(error.message).toContain("Connection closed");
  });
});

describe("missingDirectCallTools (startup verification logic)", () => {
  it("reports no missing tools when all six are served", () => {
    expect(
      missingDirectCallTools([
        "ds_list_systems",
        "ds_load_system",
        "ds_get_rulebook",
        "ds_check_compliance",
        "wf_get_tokens",
        "wf_read_component",
        "wf_generate",
      ]),
    ).toEqual([]);
  });

  it("names every absent required tool", () => {
    expect(missingDirectCallTools(["ds_list_systems", "wf_generate"])).toEqual([
      "ds_load_system",
      "ds_get_rulebook",
      "ds_check_compliance",
      "wf_get_tokens",
      "wf_read_component",
    ]);
  });
});
