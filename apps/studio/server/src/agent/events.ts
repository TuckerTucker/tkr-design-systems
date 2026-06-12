/**
 * Runtime-stream interpretation — the TurnObserver consumes normalized
 * RuntimeEvents and accumulates everything the session needs to finish a
 * turn: the produced artifact source, chip vocabularies, warnings, tool
 * failures, and human-readable summaries. SDK stream → AgentEvent ordering
 * (message_started first, message_completed or error last) is enforced by
 * the session's turn generator; this module owns the per-tool semantics.
 */
import type {
  AgentToolName,
  ArtifactSource,
  DecisionDefaults,
} from "@studio/contract";

import type { Logger } from "../logging/create-logger.js";
import { stageSubstitutedArtifact } from "./flows/substitution.js";

export const AGENT_TOOL_NAMES: readonly AgentToolName[] = [
  "wf_generate",
  "wf_select_layout",
  "wf_build_substitution_request",
  "wf_apply_substitutions",
  "wf_assemble_from_blueprint",
];

export function isAgentToolName(name: string): name is AgentToolName {
  return (AGENT_TOOL_NAMES as readonly string[]).includes(name);
}

/** The producing result of a turn, ready for ingestion. */
export interface ProducedArtifact {
  source: ArtifactSource;
  tool: Extract<
    AgentToolName,
    "wf_generate" | "wf_apply_substitutions" | "wf_assemble_from_blueprint"
  >;
  /** Tool parameters as issued (no secrets by construction). */
  parameters: Record<string, unknown>;
  /** Defaults observed on the producing call (merged with context). */
  defaults: Partial<DecisionDefaults>;
  /** Substitutions applied in this turn (substitution flow only). */
  substitutions: Array<{ find: string; replace: string }>;
}

/** One observed tool round-trip, persisted as a tool_call record. */
export interface ObservedToolCall {
  toolUseId: string;
  toolName: AgentToolName;
  input: Record<string, unknown>;
  ok: boolean;
  summary: string;
  errors: string[];
  warnings: string[];
}

export interface TurnObservation {
  toolCalls: ObservedToolCall[];
  produced: ProducedArtifact | null;
  /** Pattern ids seen in routing_request / wf_select_layout responses. */
  layoutOptions: string[];
  /** unapplied_finds, grammar_warnings, assembly warnings — never dropped. */
  warnings: string[];
  /** Error strings from tools that returned ok: false. */
  failureErrors: string[];
  /** Most recent blueprint validation errors (compose recovery). */
  validationErrors: string[];
  /** Producing tools the agent attempted (failed or not). */
  attempted: Set<AgentToolName>;
  /** Best-effort routing rationale gleaned from tool data. */
  rationale: string | null;
}

export interface TurnObserverOptions {
  stagingDir: string;
  requestId: string;
  /** Parent version spec path for substitution staging; null when unknown. */
  parentSpecPath: string | null;
  logger: Logger;
}

export interface TurnObserver {
  readonly observation: TurnObservation;
  startSummary(toolName: AgentToolName, input: Record<string, unknown>): string;
  /** Interpret one finished tool call; returns the observed record. */
  onToolFinished(args: {
    toolUseId: string;
    toolName: AgentToolName;
    input: Record<string, unknown>;
    ok: boolean;
    result: Record<string, unknown>;
  }): Promise<ObservedToolCall>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((entry) =>
        typeof entry === "string" ? entry : JSON.stringify(entry),
      )
    : [];
}

function patternIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const ids: string[] = [];
  for (const entry of value) {
    if (typeof entry === "string") {
      ids.push(entry);
    } else if (typeof entry === "object" && entry !== null) {
      const record = entry as Record<string, unknown>;
      const id = asString(record["pattern_id"]) ?? asString(record["id"]);
      if (id !== null) {
        ids.push(id);
      }
    }
  }
  return ids;
}

function platformOf(value: unknown): "mobile" | "desktop" | undefined {
  return value === "mobile" || value === "desktop" ? value : undefined;
}

function substitutionPairs(
  value: unknown,
): Array<{ find: string; replace: string }> {
  if (!Array.isArray(value)) {
    return [];
  }
  const pairs: Array<{ find: string; replace: string }> = [];
  for (const entry of value) {
    if (typeof entry === "object" && entry !== null) {
      const record = entry as Record<string, unknown>;
      const find = asString(record["find"]);
      const replace = typeof record["replace"] === "string"
        ? record["replace"]
        : null;
      if (find !== null && replace !== null) {
        pairs.push({ find, replace });
      }
    }
  }
  return pairs;
}

function truncate(text: string, max = 80): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function createTurnObserver(options: TurnObserverOptions): TurnObserver {
  const log = options.logger.child({ component: "agent-turn-observer" });
  const observation: TurnObservation = {
    toolCalls: [],
    produced: null,
    layoutOptions: [],
    warnings: [],
    failureErrors: [],
    validationErrors: [],
    attempted: new Set<AgentToolName>(),
    rationale: null,
  };

  function captureLayoutOptions(ids: string[]): void {
    for (const id of ids) {
      if (!observation.layoutOptions.includes(id)) {
        observation.layoutOptions.push(id);
      }
    }
  }

  function startSummary(
    toolName: AgentToolName,
    input: Record<string, unknown>,
  ): string {
    switch (toolName) {
      case "wf_generate": {
        const brief = asString(input["brief"]) ?? "";
        const layout = asString(input["layout_id"]);
        if (input["compose"] === true) {
          return `Requesting decomposition for "${truncate(brief)}"`;
        }
        return layout === null
          ? `Routing "${truncate(brief)}" — listing available patterns`
          : `Generating "${truncate(brief)}" with layout ${layout}`;
      }
      case "wf_select_layout":
        return "Browsing available layout patterns and components";
      case "wf_build_substitution_request":
        return "Extracting text nodes and grammar caveats (substitution pass 1)";
      case "wf_apply_substitutions":
        return "Applying content substitutions (substitution pass 2)";
      case "wf_assemble_from_blueprint":
        return "Assembling the authored layout blueprint";
    }
  }

  async function onToolFinished(args: {
    toolUseId: string;
    toolName: AgentToolName;
    input: Record<string, unknown>;
    ok: boolean;
    result: Record<string, unknown>;
  }): Promise<ObservedToolCall> {
    const { toolName, input, result } = args;
    const ok = args.ok && result["ok"] !== false;
    const errors = asStringArray(result["errors"]);
    const warnings: string[] = [];
    let summary = "";

    switch (toolName) {
      case "wf_select_layout": {
        captureLayoutOptions(patternIds(result["available_patterns"]));
        summary = ok
          ? `Found ${patternIds(result["available_patterns"]).length} patterns`
          : `Layout browsing failed: ${errors.join("; ")}`;
        break;
      }
      case "wf_generate": {
        observation.attempted.add(
          input["compose"] === true ? "wf_assemble_from_blueprint" : "wf_generate",
        );
        const routing = result["routing_request"];
        if (typeof routing === "object" && routing !== null) {
          captureLayoutOptions(
            patternIds((routing as Record<string, unknown>)["available_patterns"]),
          );
          summary = "Routing request: available patterns and components listed";
          break;
        }
        if (
          typeof result["decomposition_request"] === "object" &&
          result["decomposition_request"] !== null
        ) {
          summary = "Decomposition request: component catalog returned";
          break;
        }
        const svgPath = asString(result["svg_path"]);
        const specPath = asString(result["spec_path"]);
        if (ok && svgPath !== null && specPath !== null) {
          observation.produced = {
            source: { kind: "paths", svgPath, specPath },
            tool: "wf_generate",
            parameters: {
              system: input["system"] ?? null,
              platform: input["platform"] ?? "desktop",
              layout_id: input["layout_id"] ?? null,
            },
            defaults: {
              ...(asString(input["system"]) !== null
                ? { system: asString(input["system"]) as string }
                : {}),
              ...(asString(input["layout_id"]) !== null
                ? { layoutId: asString(input["layout_id"]) }
                : {}),
              ...(platformOf(input["platform"]) !== undefined
                ? { platform: platformOf(input["platform"]) as "mobile" | "desktop" }
                : {}),
            },
            substitutions: [],
          };
          warnings.push(...asStringArray(result["warnings"]));
          summary = `Generated wireframe (layout ${asString(input["layout_id"]) ?? "auto"})`;
        } else if (!ok) {
          summary = `wf_generate failed: ${errors.join("; ")}`;
        } else {
          summary = "wf_generate returned no artifact";
        }
        break;
      }
      case "wf_build_substitution_request": {
        observation.attempted.add("wf_apply_substitutions");
        const selected = result["selected_pattern"];
        if (typeof selected === "object" && selected !== null) {
          const rationale = asString(
            (selected as Record<string, unknown>)["rationale"],
          );
          if (rationale !== null) {
            observation.rationale = rationale;
          }
        }
        captureLayoutOptions(patternIds(result["available_patterns"]));
        summary = ok
          ? "Substitution request built (text nodes + grammar caveats)"
          : `Substitution request failed: ${errors.join("; ")}`;
        break;
      }
      case "wf_apply_substitutions": {
        observation.attempted.add("wf_apply_substitutions");
        const svgText = asString(result["svg_text"]);
        if (ok && svgText !== null) {
          const unapplied = asStringArray(result["unapplied_finds"]);
          const grammar = asStringArray(result["grammar_warnings"]);
          warnings.push(
            ...unapplied.map((find) => `unapplied find: ${find}`),
            ...grammar.map((warning) => `grammar: ${warning}`),
          );
          const source = await stageSubstitutedArtifact({
            stagingDir: options.stagingDir,
            requestId: options.requestId,
            svgText,
            parentSpecPath: options.parentSpecPath,
            logger: log,
          });
          const substitutions = substitutionPairs(input["substitutions"]);
          observation.produced = {
            source,
            tool: "wf_apply_substitutions",
            parameters: {
              substitutions,
              system: input["system_id"] ?? null,
              svg_path: input["svg_path"] ?? null,
            },
            defaults: {
              ...(asString(input["system_id"]) !== null
                ? { system: asString(input["system_id"]) as string }
                : {}),
            },
            substitutions,
          };
          summary =
            `Applied ${substitutions.length} substitutions` +
            (warnings.length > 0 ? ` (${warnings.join("; ")})` : "");
        } else {
          summary = `wf_apply_substitutions failed: ${errors.join("; ")}`;
        }
        break;
      }
      case "wf_assemble_from_blueprint": {
        observation.attempted.add("wf_assemble_from_blueprint");
        const validationErrors = asStringArray(result["validation_errors"]);
        const svgText = asString(result["svg_text"]);
        warnings.push(...asStringArray(result["warnings"]));
        if (ok && svgText !== null) {
          observation.validationErrors = [];
          const specYaml = asString(result["spec_yaml"]);
          observation.produced = {
            source: {
              kind: "text",
              svgText,
              ...(specYaml !== null ? { specYaml } : {}),
            },
            tool: "wf_assemble_from_blueprint",
            parameters: {
              blueprint: input["blueprint"] ?? null,
              system: input["system_id"] ?? null,
            },
            defaults: {
              ...(asString(input["system_id"]) !== null
                ? { system: asString(input["system_id"]) as string }
                : {}),
              layoutId: null,
            },
            substitutions: [],
          };
          summary =
            "Assembled blueprint" +
            (warnings.length > 0 ? ` (${warnings.join("; ")})` : "");
        } else {
          observation.validationErrors = validationErrors;
          summary =
            validationErrors.length > 0
              ? `Blueprint validation failed: ${validationErrors.join("; ")}`
              : `wf_assemble_from_blueprint failed: ${errors.join("; ")}`;
        }
        break;
      }
    }

    if (!ok) {
      observation.failureErrors.push(...(errors.length > 0 ? errors : [summary]));
    }
    observation.warnings.push(...warnings);

    const record: ObservedToolCall = {
      toolUseId: args.toolUseId,
      toolName,
      input,
      ok,
      summary,
      errors,
      warnings,
    };
    observation.toolCalls.push(record);
    return record;
  }

  return { observation, startSummary, onToolFinished };
}
