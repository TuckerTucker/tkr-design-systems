/**
 * Chat streaming relay — agent-orchestration's AgentEvent stream becomes
 * contract ServerMessage envelopes, broadcast (and journaled) through the
 * workspace hub so streams survive reconnect.
 *
 * Owns the three cross-capability translations:
 * - chip-update resolution: the wire ChipUpdatePayload { messageId, kind,
 *   value } is resolved against the ChipSet previously emitted for that
 *   messageId (every ChipSet carries { artifactId, messageId }) into the
 *   domain ChipUpdate { requestId, artifactId, kind, value }
 * - pipeline event relay: version_created / compliance_completed from the
 *   artifact-pipeline event bus become artifact.* envelopes
 * - status pushes: bridge.status on every bridge state change; auth.status
 *   whenever a turn resolves auth (and on attach, via snapshot)
 *
 * Single in-flight turn per workspace: concurrent chat.send is rejected
 * with turn_in_progress before the session is touched; the session's own
 * busy guard backs this up. A turn ALWAYS closes — message_completed
 * (cancelled or not) or chat.error, never silence.
 */
import { randomUUID } from "node:crypto";

import type {
  AgentEvent,
  ArtifactRef,
  ChatSendPayload,
  ChipSet,
  ChipUpdate,
  ChipUpdatePayload,
  VersionSummary,
} from "@studio/contract";

import type { AgentSession, SessionManager } from "../../agent/index.js";
import type { ArtifactPipeline } from "../../artifact-pipeline/index.js";
import type { AuthManager } from "../../agent/index.js";
import type { McpBridge } from "../../mcp/index.js";
import type { Logger } from "../../logging/create-logger.js";
import { apiError, fromAgentErrorCode } from "../errors.js";
import type { HubRegistry, WorkspaceHub } from "./journal.js";

export interface ChatRelayDeps {
  sessions: SessionManager;
  pipeline: ArtifactPipeline;
  bridge: McpBridge;
  auth: AuthManager;
  hubs: HubRegistry;
  logger: Logger;
}

export interface ChatRelay {
  /** Dispatch a chat.send turn; returns once the turn has fully closed. */
  send(
    workspaceId: string,
    requestId: string | undefined,
    payload: ChatSendPayload,
  ): Promise<void>;
  /** Abort the in-flight turn named by messageId. */
  cancel(
    workspaceId: string,
    requestId: string | undefined,
    messageId: string,
  ): Promise<void>;
  /** Wire chip.update → ChipSet lookup → domain ChipUpdate → re-run turn. */
  updateChip(
    workspaceId: string,
    requestId: string | undefined,
    payload: ChipUpdatePayload,
  ): Promise<void>;
  /** Push the current auth state to one workspace's connections. */
  pushAuthStatus(hub: WorkspaceHub): Promise<void>;
  /** Unsubscribe from pipeline and bridge events. */
  close(): void;
}

interface InflightTurn {
  requestId: string;
  messageId: string | null;
  artifactRefs: ArtifactRef[];
}

export function createChatRelay(deps: ChatRelayDeps): ChatRelay {
  const log = deps.logger.child({ component: "chat-relay" });

  /** workspaceId → in-flight turn (single turn per workspace). */
  const inflight = new Map<string, InflightTurn>();
  /** workspaceId → messageId → ChipSet (chip-update resolution). */
  const chipSets = new Map<string, Map<string, ChipSet>>();

  function rememberChipSet(workspaceId: string, chipSet: ChipSet): void {
    let perWorkspace = chipSets.get(workspaceId);
    if (perWorkspace === undefined) {
      perWorkspace = new Map();
      chipSets.set(workspaceId, perWorkspace);
    }
    perWorkspace.set(chipSet.messageId, chipSet);
  }

  // ── Pipeline event relay (version_created, compliance_completed) ──

  const unsubscribeVersionCreated = deps.pipeline.events.on(
    "version_created",
    (payload) => {
      const turn = inflight.get(payload.workspaceId);
      if (turn !== undefined) {
        turn.artifactRefs.push({
          artifactId: payload.artifactId,
          version: payload.version,
        });
      }
      const hub = deps.hubs.peek(payload.workspaceId);
      if (hub === undefined) {
        return;
      }
      const version: VersionSummary = {
        number: payload.version,
        parent: payload.provenance.parent,
        tool: payload.provenance.tool,
        brief: payload.provenance.brief,
        created: payload.provenance.created,
        compliance: { status: "pending" },
      };
      hub.broadcast({
        type: "artifact.version_created",
        // A version landed mid-turn echoes that turn's requestId.
        ...(turn !== undefined ? { requestId: turn.requestId } : {}),
        payload: { artifactId: payload.artifactId, version },
      });
    },
  );

  const unsubscribeComplianceCompleted = deps.pipeline.events.on(
    "compliance_completed",
    (payload) => {
      const hub = deps.hubs.peek(payload.workspaceId);
      if (hub === undefined) {
        return;
      }
      const turn = inflight.get(payload.workspaceId);
      hub.broadcast({
        type: "artifact.compliance_completed",
        ...(turn !== undefined ? { requestId: turn.requestId } : {}),
        payload: {
          artifactId: payload.artifactId,
          version: payload.version,
          status: payload.status,
          ...(payload.passed !== undefined ? { passed: payload.passed } : {}),
          ...(payload.failed !== undefined ? { failed: payload.failed } : {}),
          ...(payload.advisory !== undefined
            ? { advisory: payload.advisory }
            : {}),
        },
      });
    },
  );

  // ── Bridge status pushes (on change, to every attached workspace) ──

  const unsubscribeBridgeStatus = deps.bridge.onStatusChange((status) => {
    for (const hub of deps.hubs.attachedHubs()) {
      hub.broadcast({ type: "bridge.status", payload: status });
    }
  });

  async function pushAuthStatus(hub: WorkspaceHub): Promise<void> {
    const state = await deps.auth.resolve();
    const report = await deps.auth.status();
    hub.broadcast({
      type: "auth.status",
      payload: {
        state: state.status,
        ...(state.status !== "configured" && report.detail !== undefined
          ? { fix: report.detail }
          : {}),
      },
    });
  }

  // ── Turn execution ──

  /**
   * Drive one agent turn (chat.send or chip re-run) to its terminal event,
   * mapping AgentEvents onto journaled contract envelopes.
   */
  async function runTurn(
    workspaceId: string,
    hub: WorkspaceHub,
    requestId: string,
    start: (session: AgentSession) => AsyncIterable<AgentEvent>,
  ): Promise<void> {
    const turn: InflightTurn = { requestId, messageId: null, artifactRefs: [] };
    inflight.set(workspaceId, turn);
    const turnLog = log.child({ workspaceId, requestId });
    /** toolUseId → tool name (tool_finished carries no name on the seam). */
    const toolNames = new Map<string, string>();

    try {
      const session = await deps.sessions.acquire(workspaceId);
      for await (const event of start(session)) {
        switch (event.type) {
          case "message_started":
            turn.messageId = event.messageId;
            hub.broadcast({
              type: "chat.message_started",
              requestId,
              payload: { messageId: event.messageId, workspaceId },
            });
            break;
          case "assistant_delta":
            hub.broadcast({
              type: "chat.assistant_delta",
              requestId,
              payload: { messageId: event.messageId, delta: event.text },
            });
            break;
          case "tool_started":
            toolNames.set(event.toolUseId, event.toolName);
            hub.broadcast({
              type: "chat.tool_started",
              requestId,
              payload: {
                messageId: turn.messageId ?? "",
                toolCallId: event.toolUseId,
                tool: event.toolName,
                summary: event.summary,
              },
            });
            break;
          case "tool_finished":
            hub.broadcast({
              type: "chat.tool_finished",
              requestId,
              payload: {
                messageId: turn.messageId ?? "",
                toolCallId: event.toolUseId,
                tool: toolNames.get(event.toolUseId) ?? "unknown",
                status: event.ok ? "ok" : "error",
                detail: event.summary,
              },
            });
            break;
          case "chips_updated":
            rememberChipSet(workspaceId, event.chipSet);
            hub.broadcast({
              type: "chips.updated",
              requestId,
              payload: {
                messageId: event.chipSet.messageId,
                artifactId: event.chipSet.artifactId,
                chips: event.chipSet.chips,
              },
            });
            break;
          case "artifact_produced":
            // The version landing is announced by the pipeline event relay
            // (artifact.version_created); nothing extra on the wire here.
            break;
          case "message_completed":
            hub.broadcast({
              type: "chat.message_completed",
              requestId,
              payload: {
                messageId: event.messageId,
                artifactRefs: [...turn.artifactRefs],
                cancelled: false,
              },
            });
            break;
          case "error": {
            if (event.code === "cancelled" && turn.messageId !== null) {
              // A cancelled turn closes as message_completed { cancelled } —
              // undo semantics, not an error the user must dismiss.
              hub.broadcast({
                type: "chat.message_completed",
                requestId,
                payload: {
                  messageId: turn.messageId,
                  artifactRefs: [...turn.artifactRefs],
                  cancelled: true,
                },
              });
              break;
            }
            hub.broadcast({
              type: "chat.error",
              requestId,
              payload: {
                ...(turn.messageId !== null
                  ? { messageId: turn.messageId }
                  : {}),
                error: apiError(
                  fromAgentErrorCode(event.code),
                  event.message,
                  event.fix,
                ),
              },
            });
            if (event.code === "auth_missing" || event.code === "auth_invalid") {
              await pushAuthStatus(hub);
            }
            break;
          }
        }
      }
    } catch (err) {
      // The session seam never throws by contract; a breach still closes
      // the turn with a structured error instead of silence.
      turnLog.error({ err }, "agent session threw across the relay seam");
      hub.broadcast({
        type: "chat.error",
        requestId,
        payload: {
          ...(turn.messageId !== null ? { messageId: turn.messageId } : {}),
          error: apiError(
            "agent_failed",
            "The agent turn failed unexpectedly.",
            "Retry the message; if the failure persists, check the server logs.",
          ),
        },
      });
    } finally {
      if (inflight.get(workspaceId) === turn) {
        inflight.delete(workspaceId);
      }
    }
  }

  function rejectBusy(
    hub: WorkspaceHub,
    requestId: string | undefined,
    active: InflightTurn,
  ): void {
    hub.broadcast({
      type: "chat.error",
      ...(requestId !== undefined ? { requestId } : {}),
      payload: {
        error: apiError(
          "turn_in_progress",
          "A turn is already in flight on this workspace.",
          "Wait for chat.message_completed or cancel the active turn with chat.cancel.",
        ),
      },
    });
    log.debug(
      { workspaceId: hub.workspaceId, activeRequestId: active.requestId },
      "concurrent turn rejected",
    );
  }

  return {
    async send(workspaceId, requestId, payload) {
      const hub = deps.hubs.hub(workspaceId);
      const active = inflight.get(workspaceId);
      if (active !== undefined) {
        rejectBusy(hub, requestId, active);
        return;
      }
      const turnRequestId = requestId ?? randomUUID();
      await runTurn(workspaceId, hub, turnRequestId, (session) =>
        session.send({
          requestId: turnRequestId,
          text: payload.text,
          ...(payload.artifactId !== undefined
            ? { artifactId: payload.artifactId }
            : {}),
          ...(payload.references !== undefined
            ? { references: [...payload.references] }
            : {}),
        }),
      );
    },

    async cancel(workspaceId, requestId, messageId) {
      const hub = deps.hubs.hub(workspaceId);
      const active = inflight.get(workspaceId);
      if (active === undefined || active.messageId !== messageId) {
        hub.broadcast({
          type: "chat.error",
          ...(requestId !== undefined ? { requestId } : {}),
          payload: {
            error: apiError(
              "turn_not_active",
              `No turn with messageId "${messageId}" is in flight.`,
              "Nothing to cancel — the turn already completed or never started.",
            ),
          },
        });
        return;
      }
      const session = await deps.sessions.acquire(workspaceId);
      await session.cancel(active.requestId);
      // The in-flight stream closes itself with message_completed
      // { cancelled: true } — the cancel needs no acknowledgement of its own.
    },

    async updateChip(workspaceId, requestId, payload) {
      const hub = deps.hubs.hub(workspaceId);
      const active = inflight.get(workspaceId);
      if (active !== undefined) {
        rejectBusy(hub, requestId, active);
        return;
      }
      const chipSet = chipSets.get(workspaceId)?.get(payload.messageId);
      if (chipSet === undefined) {
        hub.broadcast({
          type: "chat.error",
          ...(requestId !== undefined ? { requestId } : {}),
          payload: {
            error: apiError(
              "chips_not_found",
              `No decision chips were emitted for messageId "${payload.messageId}".`,
              "Use the messageId from a chips.updated event of this workspace.",
            ),
          },
        });
        return;
      }
      const turnRequestId = requestId ?? randomUUID();
      const update: ChipUpdate = {
        requestId: turnRequestId,
        artifactId: chipSet.artifactId,
        kind: payload.kind,
        value: payload.value,
      };
      await runTurn(workspaceId, hub, turnRequestId, (session) =>
        session.updateChip(update),
      );
    },

    pushAuthStatus,

    close() {
      unsubscribeVersionCreated();
      unsubscribeComplianceCompleted();
      unsubscribeBridgeStatus();
    },
  };
}
