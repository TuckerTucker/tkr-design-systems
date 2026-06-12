/**
 * mcp-bridge — the studio server's direct-call MCP client for the
 * design-systems server (dual-connection topology: the Agent SDK owns its
 * own connection; this bridge serves the six direct-call tools for library
 * endpoints and compliance runs).
 *
 * Named re-exports only; consumers receive the bridge via injection
 * (createMcpBridge), never as a module-level instance.
 */
export {
  bridgeConfigFromStudioConfig,
  createBridgeStatusProvider,
  createMcpBridge,
  DEFAULT_BRIDGE_TIMEOUT_MS,
  DEFAULT_RESTART_POLICY,
} from "./bridge.js";
export type { BridgeConfig, McpBridge } from "./bridge.js";
export {
  bridgeDownError,
  cancelledError,
  fail,
  ok,
  parseToolResultContent,
  protocolError,
  timeoutError,
  toolErrorFromEntries,
  translateInvocationError,
  unwrapEnvelope,
  unwrapFlat,
} from "./errors.js";
export type {
  BridgeError,
  BridgeErrorKind,
  BridgeResult,
  BridgeState,
  BridgeStatus,
  BridgeWarning,
} from "./errors.js";
export { createCallQueue } from "./queue.js";
export type { CallExecutor, CallOptions, CallQueue } from "./queue.js";
export { createBridgeSupervisor } from "./supervisor.js";
export type {
  BridgeSupervisor,
  BridgeSupervisorOptions,
  RestartPolicy,
} from "./supervisor.js";
export { createToolWrappers } from "./tools.js";
export type { McpBridgeTools, ToolInvoker } from "./tools.js";
export {
  DIRECT_CALL_TOOLS,
  missingDirectCallTools,
  openBridgeConnection,
} from "./transport.js";
export type { BridgeConnection, DirectCallTool } from "./transport.js";
export type {
  AuthoringTokens,
  ComplianceRuleResult,
  ComponentRead,
  LoadedSystemSpec,
  PaletteEntry,
  RawComplianceResult,
  RulebookEntry,
  SystemDescriptor,
} from "./types.js";
