/**
 * The real AgentRuntime over @anthropic-ai/claude-agent-sdk query().
 *
 * The SDK owns its OWN stdio connection to the design-systems MCP server
 * (launch command per repo-root .mcp.json via StudioConfig.mcpLaunch),
 * independent of mcp-bridge. Allowed tools are exactly the five wf_* tools.
 * The ANTHROPIC_API_KEY is injected into the SDK subprocess environment
 * only — it never appears on log objects or any emitted event.
 *
 * This wrapper is exercised end-to-end only by the keyed test suite
 * (describe.skipIf without ANTHROPIC_API_KEY); the keyless suite drives the
 * session through a scripted fake AgentRuntime instead.
 */
import { query } from "@anthropic-ai/claude-agent-sdk";

import type { Logger } from "../logging/create-logger.js";
import { AGENT_TOOL_NAMES } from "./events.js";
import type {
  AgentConfig,
  AgentRuntime,
  RuntimeEvent,
  RuntimeTurnRequest,
} from "./runtime.js";

/** MCP server key inside the SDK options; prefixes every tool name. */
export const MCP_SERVER_KEY = "design-systems";

const TOOL_PREFIX = `mcp__${MCP_SERVER_KEY}__`;

export const DEFAULT_MAX_TURNS = 24;

/** Strip the SDK's MCP prefix back to the bare wf_* tool name. */
export function bareToolName(sdkToolName: string): string {
  return sdkToolName.startsWith(TOOL_PREFIX)
    ? sdkToolName.slice(TOOL_PREFIX.length)
    : sdkToolName;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Parse an MCP tool result into a plain record. MCP results arrive as
 * content blocks whose first text block usually carries the tool's JSON.
 */
export function parseToolResult(raw: unknown): Record<string, unknown> {
  if (isRecord(raw) && !Array.isArray(raw)) {
    return raw;
  }
  const blocks = Array.isArray(raw) ? raw : [raw];
  for (const block of blocks) {
    const text = isRecord(block)
      ? typeof block["text"] === "string"
        ? block["text"]
        : undefined
      : typeof block === "string"
        ? block
        : undefined;
    if (text === undefined) {
      continue;
    }
    try {
      const parsed: unknown = JSON.parse(text);
      if (isRecord(parsed)) {
        return parsed;
      }
    } catch {
      return { text };
    }
  }
  return {};
}

function classifyFailure(
  messages: string[],
  aborted: boolean,
): Extract<RuntimeEvent, { type: "turn_failed" }> {
  const joined = messages.join("; ");
  if (aborted) {
    return { type: "turn_failed", reason: "aborted", message: joined || "aborted" };
  }
  if (/401|authentication|invalid (x-)?api[-_]?key|credit balance/i.test(joined)) {
    return { type: "turn_failed", reason: "auth", message: joined };
  }
  if (/mcp|transport closed|connection (closed|refused)/i.test(joined)) {
    return { type: "turn_failed", reason: "mcp", message: joined };
  }
  return {
    type: "turn_failed",
    reason: "agent",
    message: joined || "the agent run failed",
  };
}

export function createSdkAgentRuntime(
  config: AgentConfig,
  logger: Logger,
): AgentRuntime {
  const log = logger.child({ component: "agent-sdk-runtime" });

  return {
    async *run(request: RuntimeTurnRequest): AsyncIterable<RuntimeEvent> {
      const abortController = new AbortController();
      const onAbort = (): void => {
        abortController.abort();
      };
      if (request.signal.aborted) {
        abortController.abort();
      } else {
        request.signal.addEventListener("abort", onAbort, { once: true });
      }

      /** toolUseId → bare tool name + input, for tool_result correlation. */
      const pendingTools = new Map<
        string,
        { toolName: string; input: Record<string, unknown> }
      >();
      let terminalSeen = false;

      try {
        const stream = query({
          prompt: request.prompt,
          options: {
            abortController,
            cwd: config.mcpLaunch.cwd,
            env: {
              ...process.env,
              ANTHROPIC_API_KEY: request.apiKey,
            },
            systemPrompt: request.systemPrompt,
            settingSources: [],
            permissionMode: "dontAsk",
            includePartialMessages: true,
            maxTurns: config.maxTurns ?? DEFAULT_MAX_TURNS,
            ...(config.model !== undefined ? { model: config.model } : {}),
            mcpServers: {
              [MCP_SERVER_KEY]: {
                type: "stdio",
                command: config.mcpLaunch.command,
                args: config.mcpLaunch.args,
              },
            },
            allowedTools: AGENT_TOOL_NAMES.map(
              (name) => `${TOOL_PREFIX}${name}`,
            ),
          },
        });

        for await (const message of stream) {
          switch (message.type) {
            case "stream_event": {
              if (message.parent_tool_use_id !== null) {
                break;
              }
              const event = message.event;
              if (
                event.type === "content_block_delta" &&
                event.delta.type === "text_delta" &&
                event.delta.text !== ""
              ) {
                yield { type: "assistant_text", text: event.delta.text };
              }
              break;
            }
            case "assistant": {
              if (message.parent_tool_use_id !== null) {
                break;
              }
              for (const block of message.message.content) {
                if (block.type === "tool_use") {
                  const toolName = bareToolName(block.name);
                  const input = isRecord(block.input)
                    ? (block.input as Record<string, unknown>)
                    : {};
                  pendingTools.set(block.id, { toolName, input });
                  yield {
                    type: "tool_started",
                    toolUseId: block.id,
                    toolName,
                    input,
                  };
                }
              }
              break;
            }
            case "user": {
              const content: unknown = message.message.content;
              if (!Array.isArray(content)) {
                break;
              }
              for (const block of content) {
                if (
                  isRecord(block) &&
                  block["type"] === "tool_result" &&
                  typeof block["tool_use_id"] === "string"
                ) {
                  const toolUseId = block["tool_use_id"];
                  const pending = pendingTools.get(toolUseId);
                  if (pending === undefined) {
                    continue;
                  }
                  pendingTools.delete(toolUseId);
                  yield {
                    type: "tool_finished",
                    toolUseId,
                    toolName: pending.toolName,
                    input: pending.input,
                    ok: block["is_error"] !== true,
                    result: parseToolResult(block["content"]),
                  };
                }
              }
              break;
            }
            case "result": {
              terminalSeen = true;
              if (message.subtype === "success" && !message.is_error) {
                yield { type: "turn_completed" };
              } else {
                const errors =
                  message.subtype === "success"
                    ? [message.result]
                    : message.errors;
                yield classifyFailure(
                  errors,
                  abortController.signal.aborted ||
                    message.terminal_reason === "aborted_streaming" ||
                    message.terminal_reason === "aborted_tools",
                );
              }
              break;
            }
            default:
              break;
          }
        }
        if (!terminalSeen) {
          yield abortController.signal.aborted
            ? classifyFailure(["aborted"], true)
            : { type: "turn_completed" };
        }
      } catch (err) {
        log.warn(
          { requestId: request.requestId, err },
          "agent SDK query failed",
        );
        yield classifyFailure(
          [err instanceof Error ? err.message : String(err)],
          abortController.signal.aborted,
        );
      } finally {
        request.signal.removeEventListener("abort", onAbort);
      }
    },
  };
}
