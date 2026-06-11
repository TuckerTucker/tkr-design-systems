/**
 * AgentRuntime — the thin seam between session orchestration and the Claude
 * Agent SDK. The session drives a turn through this interface and never
 * imports the SDK; the real implementation (sdk-runtime.ts) wraps query(),
 * while tests inject a scripted fake. This is what makes every flow
 * verifiable without an API key: the WRAPPER is ours, the SDK itself is
 * exercised only in keyed tests.
 */
import type { McpLaunchConfig } from "../config/types.js";

/** One normalized event from the runtime's agent loop. */
export type RuntimeEvent =
  /** Incremental assistant text. */
  | { type: "assistant_text"; text: string }
  /** The agent invoked a tool (bare wf_* name; MCP prefix stripped). */
  | {
      type: "tool_started";
      toolUseId: string;
      toolName: string;
      input: Record<string, unknown>;
    }
  /** The tool returned. `result` is the parsed tool payload. */
  | {
      type: "tool_finished";
      toolUseId: string;
      toolName: string;
      /** The input the call was issued with (echoed from tool_started). */
      input: Record<string, unknown>;
      ok: boolean;
      result: Record<string, unknown>;
    }
  /** The turn finished normally. Terminal. */
  | { type: "turn_completed" }
  /** The turn failed. Terminal. */
  | {
      type: "turn_failed";
      reason: "auth" | "aborted" | "mcp" | "agent";
      message: string;
    };

/** One turn handed to the runtime. */
export interface RuntimeTurnRequest {
  workspaceId: string;
  requestId: string;
  /** Full prompt for this turn (context block + user text + instructions). */
  prompt: string;
  /** Routing system prompt (system-prompt.ts). */
  systemPrompt: string;
  /**
   * Injected into the SDK subprocess environment only — never logged and
   * never serialized anywhere else.
   */
  apiKey: string;
  /** Aborting this signal cancels the in-flight turn. */
  signal: AbortSignal;
}

/** The injectable runtime seam (IoC). */
export interface AgentRuntime {
  /**
   * Run one turn. The iterable ends with exactly one terminal event
   * (turn_completed or turn_failed); implementations never throw across
   * this seam.
   */
  run(request: RuntimeTurnRequest): AsyncIterable<RuntimeEvent>;
}

/** Configuration the agent capability needs (built from StudioConfig). */
export interface AgentConfig {
  /** Launch definition for the design-systems MCP server (.mcp.json). */
  mcpLaunch: McpLaunchConfig;
  /**
   * Directory where producing tools stage output files (output_dir) and
   * where the session stages substituted SVGs. Outside studio/workspaces —
   * the store remains the only writer there.
   */
  stagingDir: string;
  /** Model override for the SDK; default lets the SDK choose. */
  model?: string;
  /** Bound on agentic round-trips per turn. */
  maxTurns?: number;
}
