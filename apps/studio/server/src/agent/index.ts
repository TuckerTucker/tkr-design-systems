/**
 * agent-orchestration — the conversational core: chat messages become
 * wireframe artifacts through the Claude Agent SDK, with API-key auth,
 * per-workspace sessions, agent-judgment intent routing, decision chips,
 * per-artifact context, transcript persistence, and cancellation.
 *
 * IoC factory surface: the composition root constructs an AuthManager,
 * the real SDK runtime, and the SessionManager from injected repositories,
 * the artifact-pipeline ingest seam, and configuration. Tests construct
 * the same pieces with a scripted fake runtime.
 *
 * Constraint (documented, binding): claude.ai subscription login is out of
 * scope — Anthropic policy prohibits it for embedded SDK apps.
 * ANTHROPIC_API_KEY is the only auth path.
 */
import { tmpdir } from "node:os";
import path from "node:path";

import type { StudioConfig } from "../config/types.js";
import type { AgentConfig } from "./runtime.js";

export {
  ANTHROPIC_API_KEY_VAR,
  AUTH_REDACTION_PATHS,
  createAuthManager,
  dotEnvPath,
  INVALID_KEY_FIX,
  KEYLESS_FIX,
  parseDotEnv,
} from "./auth.js";
export type { AuthManager, AuthManagerOptions, AuthState, AuthStatus } from "./auth.js";
export type { CancelResult } from "./cancellation.js";
export {
  applyChipValue,
  buildChipSet,
  COMPOSED_LAYOUT_VALUE,
  PLATFORM_OPTIONS,
  validateChipUpdate,
} from "./chips.js";
export {
  buildContextBlock,
  MAX_CONTEXT_REFINEMENTS,
  restoreFromTranscript,
} from "./context.js";
export type { ArtifactContext } from "./context.js";
export { AGENT_TOOL_NAMES, isAgentToolName } from "./events.js";
export type {
  AgentConfig,
  AgentRuntime,
  RuntimeEvent,
  RuntimeTurnRequest,
} from "./runtime.js";
export {
  bareToolName,
  createSdkAgentRuntime,
  MCP_SERVER_KEY,
  parseToolResult,
} from "./sdk-runtime.js";
export { createAgentSession } from "./session.js";
export type {
  AgentSession,
  AgentSessionDeps,
  ChatSendRequest,
  SystemCatalog,
} from "./session.js";
export { createAgentSessionManager } from "./session-manager.js";
export type { SessionManager, SessionManagerDeps } from "./session-manager.js";
export { buildSystemPrompt } from "./system-prompt.js";
export { sanitizeToolInput } from "./transcript.js";
export type {
  ChipsPayload,
  MessagePayload,
  RoutingPayload,
  ToolCallPayload,
  TurnStatus,
} from "./transcript.js";

/**
 * Derive the agent configuration from the resolved server configuration.
 * The staging directory lives under the OS temp dir — never inside
 * studio/workspaces (the store is the only writer there).
 */
export function agentConfigFromStudioConfig(
  config: StudioConfig,
  overrides: Partial<Pick<AgentConfig, "stagingDir" | "model" | "maxTurns">> = {},
): AgentConfig {
  return {
    mcpLaunch: config.mcpLaunch,
    stagingDir:
      overrides.stagingDir ?? path.join(tmpdir(), "studio-agent-staging"),
    ...(overrides.model !== undefined ? { model: overrides.model } : {}),
    ...(overrides.maxTurns !== undefined ? { maxTurns: overrides.maxTurns } : {}),
  };
}
