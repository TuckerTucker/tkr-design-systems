/**
 * Typed wrappers for the six direct-call tools — camelCase params mapped to
 * snake_case wire arguments, FastMCP JSON text content parsed, skill
 * envelopes unwrapped through errors.ts, and compliance rule details
 * normalized to structured records.
 *
 * Every wrapper is a total function over BridgeResult: tool-level failures,
 * protocol failures, timeouts, cancellations, and bridge-down all arrive as
 * values, never as thrown exceptions.
 */
import path from "node:path";

import type { BridgeResult } from "@studio/contract";

import {
  fail,
  ok,
  parseToolResultContent,
  protocolError,
  unwrapEnvelope,
  unwrapFlat,
} from "./errors.js";
import type { CallOptions } from "./queue.js";
import type {
  AuthoringTokens,
  ComplianceRuleResult,
  ComponentRead,
  LoadedSystemSpec,
  RawComplianceResult,
  RulebookEntry,
  SystemDescriptor,
} from "./types.js";

/**
 * Dispatch seam injected by the bridge: enqueues one tool call and resolves
 * the raw CallToolResult (or a typed failure).
 */
export type ToolInvoker = (
  tool: string,
  args: Record<string, unknown>,
  opts?: CallOptions,
) => Promise<BridgeResult<unknown>>;

/** The six typed wrappers — the tool surface of the McpBridge interface. */
export interface McpBridgeTools {
  listSystems(opts?: CallOptions): Promise<BridgeResult<SystemDescriptor[]>>;
  loadSystem(
    params: { systemId: string; validate?: boolean },
    opts?: CallOptions,
  ): Promise<BridgeResult<LoadedSystemSpec>>;
  getRulebook(
    params: { systemId: string },
    opts?: CallOptions,
  ): Promise<BridgeResult<RulebookEntry[]>>;
  checkCompliance(
    params: {
      systemId: string;
      artifactPath: string;
      scope?: "component" | "artifact";
    },
    opts?: CallOptions,
  ): Promise<BridgeResult<RawComplianceResult>>;
  getTokens(
    params: { systemId: string },
    opts?: CallOptions,
  ): Promise<BridgeResult<AuthoringTokens>>;
  readComponent(
    params: { systemId: string; componentId: string },
    opts?: CallOptions,
  ): Promise<BridgeResult<ComponentRead>>;
  readComponents(
    params: { systemId: string; componentIds: string[] },
    opts?: CallOptions,
  ): Promise<BridgeResult<ComponentRead[]>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** invoke → parse content → unwrap the ds_* skill Result envelope. */
async function invokeEnveloped(
  invoke: ToolInvoker,
  tool: string,
  args: Record<string, unknown>,
  opts?: CallOptions,
): Promise<BridgeResult<unknown>> {
  const raw = await invoke(tool, args, opts);
  if (!raw.ok) {
    return raw;
  }
  const content = parseToolResultContent(raw.value);
  if (!content.ok) {
    return content;
  }
  return unwrapEnvelope(content.value);
}

/** invoke → parse content → unwrap the flat wf_* dict shape. */
async function invokeFlat(
  invoke: ToolInvoker,
  tool: string,
  args: Record<string, unknown>,
  opts?: CallOptions,
): Promise<BridgeResult<Record<string, unknown>>> {
  const raw = await invoke(tool, args, opts);
  if (!raw.ok) {
    return raw;
  }
  const content = parseToolResultContent(raw.value);
  if (!content.ok) {
    return content;
  }
  return unwrapFlat(content.value);
}

/**
 * Normalize one compliance rule's detail to a structured record. The wire
 * may carry the detail as a nested JSON object or as a JSON string — the
 * structured form is the contract above the bridge (artifact-pipeline's
 * violation-to-node mapper depends on its fields).
 */
function normalizeRuleDetail(
  detail: unknown,
): { ok: true; detail: Record<string, unknown> } | { ok: false; raw: unknown } {
  if (detail === undefined || detail === null) {
    return { ok: true, detail: {} };
  }
  if (isRecord(detail)) {
    return { ok: true, detail };
  }
  if (typeof detail === "string") {
    try {
      const parsed: unknown = JSON.parse(detail);
      if (isRecord(parsed)) {
        return { ok: true, detail: parsed };
      }
      return { ok: false, raw: detail };
    } catch {
      return { ok: false, raw: detail };
    }
  }
  return { ok: false, raw: detail };
}

function normalizeComplianceData(
  data: unknown,
): BridgeResult<RawComplianceResult> {
  if (!isRecord(data) || !Array.isArray(data["results"])) {
    return fail(
      protocolError(
        "ds_check_compliance returned a payload without a results list",
      ),
    );
  }
  const results: ComplianceRuleResult[] = [];
  for (const entry of data["results"]) {
    if (!isRecord(entry)) {
      return fail(
        protocolError("ds_check_compliance returned a non-object rule result"),
      );
    }
    const normalized = normalizeRuleDetail(entry["detail"]);
    if (!normalized.ok) {
      return fail(
        protocolError(
          `Compliance rule detail for '${String(entry["rule_id"])}' is not a parseable JSON object`,
          { rule_id: entry["rule_id"], raw_detail: normalized.raw },
        ),
      );
    }
    results.push({
      rule_id: String(entry["rule_id"]),
      status: String(entry["status"]),
      detail: normalized.detail,
    });
  }
  const value = { ...data, results } as unknown as RawComplianceResult;
  return ok(value);
}

/** Strip the per-entry `ok` discriminant the flat wire shape carries. */
function toComponentRead(entry: Record<string, unknown>): ComponentRead {
  const rest: Record<string, unknown> = { ...entry };
  delete rest["ok"];
  return rest as unknown as ComponentRead;
}

/**
 * Build the six typed wrappers over an injected dispatch seam. The bridge
 * factory composes this with its queue; tests can compose it directly.
 */
export function createToolWrappers(invoke: ToolInvoker): McpBridgeTools {
  return {
    async listSystems(opts) {
      const result = await invokeEnveloped(invoke, "ds_list_systems", {}, opts);
      if (!result.ok) {
        return result;
      }
      if (!Array.isArray(result.value)) {
        return fail(
          protocolError("ds_list_systems returned a non-list payload"),
        );
      }
      return ok(result.value as SystemDescriptor[], result.warnings);
    },

    async loadSystem(params, opts) {
      const args: Record<string, unknown> = {
        system_id: params.systemId,
        ...(params.validate !== undefined ? { validate: params.validate } : {}),
      };
      const result = await invokeEnveloped(invoke, "ds_load_system", args, opts);
      if (!result.ok) {
        return result;
      }
      if (!isRecord(result.value)) {
        return fail(
          protocolError("ds_load_system returned a non-object spec payload"),
        );
      }
      return ok(result.value as unknown as LoadedSystemSpec, result.warnings);
    },

    async getRulebook(params, opts) {
      const result = await invokeEnveloped(
        invoke,
        "ds_get_rulebook",
        { system_id: params.systemId },
        opts,
      );
      if (!result.ok) {
        return result;
      }
      if (!Array.isArray(result.value)) {
        return fail(
          protocolError("ds_get_rulebook returned a non-list payload"),
        );
      }
      return ok(result.value as RulebookEntry[], result.warnings);
    },

    async checkCompliance(params, opts) {
      if (!path.isAbsolute(params.artifactPath)) {
        // The MCP server resolves paths against its own process, not the
        // caller's — a relative path is tool misuse, rejected before dispatch.
        return fail({
          kind: "tool",
          code: "INVALID_PATH",
          message:
            `artifactPath must be absolute (got "${params.artifactPath}") — ` +
            "the MCP server resolves paths against its own working directory",
          detail: { artifactPath: params.artifactPath },
        });
      }
      const args: Record<string, unknown> = {
        system_id: params.systemId,
        artifact_path: params.artifactPath,
        ...(params.scope !== undefined ? { scope: params.scope } : {}),
      };
      const result = await invokeEnveloped(
        invoke,
        "ds_check_compliance",
        args,
        opts,
      );
      if (!result.ok) {
        return result;
      }
      const normalized = normalizeComplianceData(result.value);
      if (!normalized.ok) {
        return normalized;
      }
      return ok(normalized.value, result.warnings);
    },

    async getTokens(params, opts) {
      const result = await invokeFlat(
        invoke,
        "wf_get_tokens",
        { system_id: params.systemId },
        opts,
      );
      if (!result.ok) {
        return result;
      }
      return ok(result.value as unknown as AuthoringTokens, result.warnings);
    },

    async readComponent(params, opts) {
      const result = await invokeFlat(
        invoke,
        "wf_read_component",
        { system_id: params.systemId, component_id: params.componentId },
        opts,
      );
      if (!result.ok) {
        return result;
      }
      return ok(toComponentRead(result.value), result.warnings);
    },

    async readComponents(params, opts) {
      const result = await invokeFlat(
        invoke,
        "wf_read_component",
        { system_id: params.systemId, component_ids: params.componentIds },
        opts,
      );
      if (!result.ok) {
        return result;
      }
      const components = result.value["components"];
      if (!Array.isArray(components)) {
        return fail(
          protocolError(
            "wf_read_component batch returned no components list",
          ),
        );
      }
      const failures: Record<string, unknown>[] = [];
      const reads: ComponentRead[] = [];
      for (const entry of components) {
        if (!isRecord(entry)) {
          return fail(
            protocolError(
              "wf_read_component batch returned a non-object entry",
            ),
          );
        }
        if (entry["ok"] === false) {
          failures.push({
            component_id: entry["component_id"],
            error: entry["error"],
          });
        } else {
          reads.push(toComponentRead(entry));
        }
      }
      if (failures.length > 0) {
        // No partial batch: one failing id fails the whole call as one
        // tool error naming every failure.
        return fail({
          kind: "tool",
          message: `Component read failed for: ${failures
            .map((failure) => String(failure["component_id"]))
            .join(", ")}`,
          detail: { failures },
        });
      }
      return ok(reads, result.warnings);
    },
  };
}
