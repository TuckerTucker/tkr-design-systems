/**
 * @studio/contract — shared Studio contracts.
 *
 * Module ownership (one module, one owning capability):
 * - health.ts — studio-server (HealthResponse, StatusReport)
 * - store.ts — workspace-store (storage models, StoreResult, repositories)
 * - bridge.ts — mcp-bridge (BridgeResult, BridgeError, BridgeWarning,
 *   BridgeState, BridgeStatus — also the bridge.status WS payload)
 * - preferences.ts — docking-shell (LayoutPreference; declared ahead of
 *   Phase 2 so the store can type its opaque persistence seam)
 * - artifact.ts — artifact-pipeline (ArtifactSource, ArtifactVersion,
 *   VersionProvenance, ComplianceReport, ViolationNodeMapping,
 *   ParsedSpecMetadata, pipeline event payloads)
 *
 * - agent-events.ts — agent-orchestration (AgentEvent, AgentToolName,
 *   Intent, RoutingResult, DecisionDefaults, chip models, Provenance,
 *   AgentErrorCode)
 *
 * - envelope.ts — studio-api (ClientEnvelope, ServerEnvelope)
 * - ws-messages.ts — studio-api (all WS payloads and the
 *   ClientMessage/ServerMessage unions)
 * - http-payloads.ts — studio-api (workspace/artifact payloads,
 *   ComplianceResponse, RestoreResponse, library payloads)
 * - errors.ts — studio-api (ApiError, ApiErrorCode, ErrorResponse)
 *
 * library-panel adds library.ts in Phase 2 and re-exports it from this
 * barrel. Owners add; consumers import; nobody redeclares.
 */
export type {
  AgentErrorCode,
  AgentEvent,
  AgentToolName,
  ChipKind,
  ChipSet,
  ChipUpdate,
  DecisionChip,
  DecisionDefaults,
  Intent,
  Provenance,
  RoutingResult,
} from "./agent-events.js";
export type {
  ArtifactComplianceCompletedPayload,
  ArtifactSource,
  ArtifactVersion,
  ArtifactVersionCreatedPayload,
  ComplianceReport,
  ComplianceState,
  ComponentUsed,
  DesignSystemBlock,
  GenerationTool,
  ParsedSpecMetadata,
  RulebookComplianceSummary,
  RuleResult,
  RuleStatus,
  SpecMetadataState,
  VersionProvenance,
  VersionSummary,
  ViolationNodeMapping,
} from "./artifact.js";
export type {
  BridgeError,
  BridgeErrorKind,
  BridgeResult,
  BridgeState,
  BridgeStatus,
  BridgeWarning,
} from "./bridge.js";
export type { ClientEnvelope, ServerEnvelope } from "./envelope.js";
export type { ApiError, ApiErrorCode, ErrorResponse } from "./errors.js";
export type { HealthResponse, StatusReport } from "./health.js";
export type {
  ArtifactDetail,
  ArtifactSummary,
  ComplianceResponse,
  ComplianceRuleResult,
  ComplianceStatus,
  ComponentDetail,
  ComponentIndexEntry,
  LayoutTemplate,
  LibrarySystem,
  Platform,
  RestoreResponse,
  TokenSetResponse,
  WorkspaceCreateRequest,
  WorkspacePatchRequest,
  WorkspaceSettings,
  WorkspaceSummary,
} from "./http-payloads.js";
export type { LayoutPreference, PanelPlacement } from "./preferences.js";
export { TRANSCRIPT_RECORD_KINDS } from "./store.js";
export {
  CLIENT_MESSAGE_TYPES,
  SERVER_MESSAGE_TYPES,
} from "./ws-messages.js";
export type {
  ArtifactRef,
  AssistantDeltaPayload,
  AuthState,
  AuthStatusPayload,
  BridgeStatusPayload,
  ChatCancelPayload,
  ChatErrorPayload,
  ChatSendPayload,
  ChipsUpdatedPayload,
  ChipUpdatePayload,
  ClientMessage,
  ClientMessageType,
  ComplianceCompletedPayload,
  MessageCompletedPayload,
  MessageStartedPayload,
  ServerMessage,
  ServerMessageType,
  ToolFinishedPayload,
  ToolStartedPayload,
  VersionCreatedPayload,
  WorkspaceAttachPayload,
} from "./ws-messages.js";
export type {
  ArtifactMeta,
  ArtifactPlatform,
  ArtifactRepository,
  NewArtifactInput,
  NewVersionInput,
  PreferencesRepository,
  StoreError,
  StoreErrorCode,
  StoreResult,
  StoreRootConfig,
  TranscriptRecord,
  TranscriptRecordKind,
  TranscriptRepository,
  VersionMeta,
  WorkspaceListEntry,
  WorkspaceMeta,
  WorkspacePatch,
  WorkspaceRepository,
  WorkspaceStore,
} from "./store.js";
