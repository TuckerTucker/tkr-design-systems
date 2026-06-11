/**
 * AgentSession — one conversational session per workspace. send() runs one
 * turn through the injected AgentRuntime (the Claude Agent SDK wrapper) and
 * emits the typed AgentEvent stream; updateChip() re-runs only the affected
 * step; cancel() aborts the in-flight run.
 *
 * Ordering guarantee: message_started first, message_completed or error
 * last, deltas and tool events strictly ordered between. Turns refused
 * before they start (busy, keyless) are a single error event.
 *
 * Errors cross this seam as typed events, never thrown exceptions. The
 * API key never appears on any event, log object, or transcript payload.
 */
import { randomUUID } from "node:crypto";
import path from "node:path";

import type {
  AgentErrorCode,
  AgentEvent,
  AgentToolName,
  ChipUpdate,
  DecisionDefaults,
  Intent,
  Provenance,
  RoutingResult,
  TranscriptRepository,
  WorkspaceRepository,
} from "@studio/contract";

import type { ArtifactPipeline } from "../artifact-pipeline/index.js";
import type { VersionFileResolver } from "../artifact-pipeline/version-files.js";
import type { Logger } from "../logging/create-logger.js";
import {
  ANTHROPIC_API_KEY_VAR,
  INVALID_KEY_FIX,
  KEYLESS_FIX,
  type AuthManager,
} from "./auth.js";
import {
  createCancellationTracker,
  type CancelResult,
} from "./cancellation.js";
import { applyChipValue, buildChipSet, validateChipUpdate } from "./chips.js";
import {
  buildContextBlock,
  createArtifactContext,
  pushRefinement,
  pushSubstitutions,
  restoreFromTranscript,
  type ArtifactContext,
} from "./context.js";
import { createTurnObserver, isAgentToolName } from "./events.js";
import { describeBlueprintFailure } from "./flows/blueprint.js";
import { chipRerunPrompt, rerunIntent } from "./flows/generate.js";
import type { AgentConfig, AgentRuntime } from "./runtime.js";
import { buildSystemPrompt } from "./system-prompt.js";
import {
  createTranscriptWriter,
  type TranscriptWriter,
  type TurnStatus,
} from "./transcript.js";

/** Registry-system vocabulary seam (wired to the library surface at L4). */
export interface SystemCatalog {
  list(): Promise<string[]>;
}

export interface ChatSendRequest {
  /** Echoed on every emitted event. */
  requestId: string;
  text: string;
  /** Explicit refinement target; omitted → active artifact or new. */
  artifactId?: string;
  /** Library references attached by the composer (agent grounding). */
  references?: unknown[];
}

export interface AgentSession {
  readonly workspaceId: string;
  send(request: ChatSendRequest): AsyncIterable<AgentEvent>;
  updateChip(update: ChipUpdate): AsyncIterable<AgentEvent>;
  cancel(requestId: string): Promise<CancelResult>;
  dispose(): Promise<void>;
}

export interface AgentSessionDeps {
  workspaceId: string;
  /** IoC-injected workspace-store repository. */
  transcripts: TranscriptRepository;
  /** artifact-pipeline ingestion (the session hands off every result). */
  ingest: ArtifactPipeline["ingest"];
  /** The SDK wrapper seam; tests inject a scripted fake. */
  runtime: AgentRuntime;
  auth: AuthManager;
  config: AgentConfig;
  logger: Logger;
  /** Active-artifact tracking; optional (degraded without it). */
  workspaces?: WorkspaceRepository;
  /** Store-resolved version file paths (substitution pass 2 inputs). */
  versionFiles?: VersionFileResolver;
  /** Registry system ids for the system chip vocabulary. */
  systems?: SystemCatalog;
}

interface TurnPlan {
  requestId: string;
  /** Text recorded as the turn's user message. */
  userText: string;
  /** Full prompt handed to the runtime. */
  prompt: string;
  /** Provenance brief for any artifact this turn lands. */
  brief: string;
  /** Artifact whose context frames this turn; null for fresh turns. */
  contextArtifactId: string | null;
  /** Where a generate/compose result lands; null → new artifact. */
  ingestTargetForGenerate: string | null;
  baseDefaults: DecisionDefaults | null;
  intentOverride?: Intent;
  rationaleOverride?: string;
}

function intentForTool(tool: AgentToolName): Intent {
  switch (tool) {
    case "wf_apply_substitutions":
    case "wf_build_substitution_request":
      return "substitute";
    case "wf_assemble_from_blueprint":
      return "compose";
    default:
      return "generate";
  }
}

function errorEvent(
  requestId: string,
  code: AgentErrorCode,
  message: string,
  fix: string,
): AgentEvent {
  return { type: "error", requestId, code, message, fix };
}

export function createAgentSession(deps: AgentSessionDeps): AgentSession {
  const { workspaceId, config, auth, runtime } = deps;
  const logger = deps.logger.child({ component: "agent-session", workspaceId });
  const systemPrompt = buildSystemPrompt();
  const writer: TranscriptWriter = createTranscriptWriter(
    deps.transcripts,
    workspaceId,
    logger,
  );
  const tracker = createCancellationTracker();

  const artifacts = new Map<string, ArtifactContext>();
  let activeArtifactId: string | null = null;
  let restored = false;
  let disposed = false;

  async function ensureRestored(): Promise<void> {
    if (restored) {
      return;
    }
    restored = true;
    const read = await deps.transcripts.read(workspaceId);
    if (read.ok) {
      const state = restoreFromTranscript(read.value);
      for (const [id, ctx] of state.artifacts) {
        artifacts.set(id, ctx);
      }
      activeArtifactId = state.activeArtifactId;
      logger.debug(
        { artifacts: artifacts.size, activeArtifactId },
        "session context restored from transcript",
      );
    } else {
      logger.warn(
        { error: read.error },
        "transcript restore failed; session starts with empty context",
      );
    }
    if (deps.workspaces !== undefined) {
      const meta = await deps.workspaces.get(workspaceId);
      if (
        meta.ok &&
        meta.value.activeArtifactId !== null &&
        artifacts.has(meta.value.activeArtifactId)
      ) {
        activeArtifactId = meta.value.activeArtifactId;
      }
    }
  }

  function persistActiveArtifact(artifactId: string): void {
    if (deps.workspaces === undefined) {
      return;
    }
    void deps.workspaces
      .update(workspaceId, { activeArtifactId: artifactId })
      .then((result) => {
        if (!result.ok) {
          logger.warn(
            { artifactId, error: result.error },
            "active artifact update failed (non-blocking)",
          );
        }
      })
      .catch((err: unknown) => {
        logger.warn({ artifactId, err }, "active artifact update rejected");
      });
  }

  async function systemOptions(current: string): Promise<string[]> {
    if (deps.systems !== undefined) {
      try {
        const list = await deps.systems.list();
        if (list.length > 0) {
          return list;
        }
      } catch (err) {
        logger.warn({ err }, "system catalog unavailable; chip options degrade");
      }
    }
    return [current];
  }

  function headSvgPath(ctx: ArtifactContext): string | null {
    if (deps.versionFiles === undefined || ctx.headVersion === null) {
      return null;
    }
    return deps.versionFiles(workspaceId, ctx.artifactId, ctx.headVersion, "svg");
  }

  function headSpecPath(ctx: ArtifactContext | undefined): string | null {
    if (
      ctx === undefined ||
      deps.versionFiles === undefined ||
      ctx.headVersion === null
    ) {
      return null;
    }
    return deps.versionFiles(workspaceId, ctx.artifactId, ctx.headVersion, "spec");
  }

  function turnOutputDir(requestId: string): string {
    return path.join(config.stagingDir, requestId);
  }

  function buildTurnPrompt(
    request: ChatSendRequest,
    ctx: ArtifactContext | undefined,
  ): string {
    const sections: string[] = [
      "## Turn context",
      `workspace: ${workspaceId}`,
      `output_dir to pass to producing tools: ${turnOutputDir(request.requestId)}`,
    ];
    if (ctx !== undefined) {
      sections.push("", buildContextBlock({ ctx, headSvgPath: headSvgPath(ctx) }));
    }
    if (request.references !== undefined && request.references.length > 0) {
      sections.push(
        "",
        "## Library references attached by the user",
        JSON.stringify(request.references),
      );
    }
    sections.push("", "## User message", request.text);
    return sections.join("\n");
  }

  /** Yield the keyless/invalid refusal (single error event, no SDK spawn). */
  async function* refuseForAuth(
    requestId: string,
    text: string,
    artifactId: string | null,
    status: "missing" | "invalid",
  ): AsyncGenerator<AgentEvent> {
    await writer.message({
      role: "user",
      text,
      requestId,
      messageId: randomUUID(),
      artifactId,
      status: "refused",
    });
    if (status === "invalid") {
      yield errorEvent(
        requestId,
        "auth_invalid",
        `The configured ${ANTHROPIC_API_KEY_VAR} was rejected by the Anthropic API.`,
        INVALID_KEY_FIX,
      );
    } else {
      yield errorEvent(
        requestId,
        "auth_missing",
        `No ${ANTHROPIC_API_KEY_VAR} is configured — generation and conversation need the Claude Agent SDK.`,
        KEYLESS_FIX,
      );
    }
  }

  async function* runTurn(plan: TurnPlan): AsyncGenerator<AgentEvent> {
    const { requestId } = plan;
    const messageId = randomUUID();
    const controller = tracker.begin(requestId);
    const log = logger.child({ requestId, messageId });
    const contextCtx =
      plan.contextArtifactId !== null
        ? artifacts.get(plan.contextArtifactId)
        : undefined;
    const observer = createTurnObserver({
      stagingDir: config.stagingDir,
      requestId,
      parentSpecPath: headSpecPath(contextCtx),
      logger: log,
    });
    let assistantText = "";

    async function persistAssistant(status: TurnStatus): Promise<void> {
      await writer.message({
        role: "assistant",
        text: assistantText,
        requestId,
        messageId,
        artifactId: plan.contextArtifactId,
        status,
      });
    }

    try {
      yield { type: "message_started", requestId, messageId };
      await writer.message({
        role: "user",
        text: plan.userText,
        requestId,
        messageId,
        artifactId: plan.contextArtifactId,
        status: "ok",
      });

      let terminal:
        | { kind: "completed" }
        | { kind: "failed"; reason: "auth" | "aborted" | "mcp" | "agent"; message: string }
        | null = null;

      try {
        for await (const event of runtime.run({
          workspaceId,
          requestId,
          prompt: plan.prompt,
          systemPrompt,
          apiKey: auth.apiKey() ?? "",
          signal: controller.signal,
        })) {
          switch (event.type) {
            case "assistant_text":
              assistantText += event.text;
              yield {
                type: "assistant_delta",
                requestId,
                messageId,
                text: event.text,
              };
              break;
            case "tool_started": {
              if (!isAgentToolName(event.toolName)) {
                break;
              }
              yield {
                type: "tool_started",
                requestId,
                toolUseId: event.toolUseId,
                toolName: event.toolName,
                summary: observer.startSummary(event.toolName, event.input),
              };
              break;
            }
            case "tool_finished": {
              if (!isAgentToolName(event.toolName)) {
                break;
              }
              const call = await observer.onToolFinished({
                toolUseId: event.toolUseId,
                toolName: event.toolName,
                input: event.input,
                ok: event.ok,
                result: event.result,
              });
              await writer.toolCall({
                requestId,
                artifactId: plan.contextArtifactId,
                call,
              });
              yield {
                type: "tool_finished",
                requestId,
                toolUseId: event.toolUseId,
                ok: call.ok,
                summary: call.summary,
              };
              break;
            }
            case "turn_completed":
              terminal = { kind: "completed" };
              break;
            case "turn_failed":
              terminal = {
                kind: "failed",
                reason: event.reason,
                message: event.message,
              };
              break;
          }
          if (terminal !== null) {
            break;
          }
        }
      } catch (err) {
        // The runtime seam never throws by contract; treat a breach as an
        // agent failure rather than crashing the stream.
        log.error({ err }, "runtime threw across the seam");
        terminal = {
          kind: "failed",
          reason: controller.signal.aborted ? "aborted" : "agent",
          message: err instanceof Error ? err.message : String(err),
        };
      }

      if (terminal === null) {
        terminal = controller.signal.aborted
          ? { kind: "failed", reason: "aborted", message: "run aborted" }
          : { kind: "completed" };
      }

      if (terminal.kind === "failed") {
        switch (terminal.reason) {
          case "aborted":
            // No partial artifact: ingestion only happens after completion,
            // so the prior head is untouched by construction.
            await persistAssistant("cancelled");
            log.info("turn cancelled");
            yield errorEvent(
              requestId,
              "cancelled",
              "The run was cancelled.",
              "Send a new message to continue; the session stays usable.",
            );
            return;
          case "auth":
            auth.markInvalid();
            await persistAssistant("failed");
            yield errorEvent(
              requestId,
              "auth_invalid",
              `The Anthropic API rejected the configured ${ANTHROPIC_API_KEY_VAR}: ${terminal.message}`,
              INVALID_KEY_FIX,
            );
            return;
          case "mcp":
            await persistAssistant("failed");
            yield errorEvent(
              requestId,
              "mcp_unavailable",
              `The design-systems MCP connection failed mid-run: ${terminal.message}`,
              "Retry the message — the SDK re-establishes its MCP connection on the next turn.",
            );
            return;
          case "agent":
            await persistAssistant("failed");
            yield errorEvent(
              requestId,
              "agent_failed",
              terminal.message,
              "Retry the message; if the failure persists, check the server logs.",
            );
            return;
        }
      }

      const obs = observer.observation;
      const produced = obs.produced;

      if (produced !== null) {
        const defaults: DecisionDefaults = {
          system:
            produced.defaults.system ?? plan.baseDefaults?.system ?? "swiss",
          layoutId:
            produced.defaults.layoutId !== undefined
              ? produced.defaults.layoutId
              : (plan.baseDefaults?.layoutId ?? null),
          platform:
            produced.defaults.platform ??
            plan.baseDefaults?.platform ??
            "desktop",
        };
        const ingestTargetId =
          produced.tool === "wf_apply_substitutions"
            ? plan.contextArtifactId
            : plan.ingestTargetForGenerate;
        const parentVersion =
          ingestTargetId !== null
            ? (artifacts.get(ingestTargetId)?.headVersion ?? null)
            : null;

        const landed = await deps.ingest({
          workspaceId,
          ...(ingestTargetId !== null ? { artifactId: ingestTargetId } : {}),
          source: produced.source,
          provenance: {
            brief: plan.brief,
            tool: produced.tool,
            parameters: produced.parameters,
          },
        });
        if (!landed.ok) {
          log.error({ error: landed.error }, "artifact ingestion failed");
          await persistAssistant("failed");
          yield errorEvent(
            requestId,
            "agent_failed",
            `The generated artifact could not be saved: ${landed.error.message}`,
            "Retry the message; the generation output may have been cleaned up.",
          );
          return;
        }
        const outcome = landed.value;
        const provenance: Provenance = {
          brief: plan.brief,
          tool: produced.tool,
          parameters: produced.parameters,
          parentArtifactVersion: parentVersion,
        };
        yield {
          type: "artifact_produced",
          requestId,
          artifactId: outcome.artifactId,
          source: produced.source,
          provenance,
        };

        let ctx = artifacts.get(outcome.artifactId);
        if (ctx === undefined) {
          ctx = createArtifactContext(outcome.artifactId, plan.brief, defaults);
          artifacts.set(outcome.artifactId, ctx);
        }
        if (produced.tool !== "wf_apply_substitutions") {
          ctx.brief = plan.brief;
        }
        ctx.defaults = defaults;
        ctx.headVersion = outcome.headVersion;
        if (produced.substitutions.length > 0) {
          pushSubstitutions(ctx, produced.substitutions);
        }
        if (obs.layoutOptions.length > 0) {
          ctx.layoutOptions = [...obs.layoutOptions];
        }
        pushRefinement(ctx, plan.userText);

        const chipSet = buildChipSet({
          artifactId: outcome.artifactId,
          messageId,
          defaults,
          systemOptions: await systemOptions(defaults.system),
          layoutOptions: ctx.layoutOptions,
          rerunStep:
            produced.tool === "wf_assemble_from_blueprint"
              ? "compose"
              : "generate",
        });
        ctx.chipSet = chipSet;
        await writer.chips({ requestId, chipSet });
        yield { type: "chips_updated", requestId, chipSet };

        activeArtifactId = outcome.artifactId;
        persistActiveArtifact(outcome.artifactId);

        const intent = plan.intentOverride ?? intentForTool(produced.tool);
        const routing: RoutingResult = {
          intent,
          rationale:
            plan.rationaleOverride ??
            obs.rationale ??
            `agent routed the message to the ${intent} flow via ${produced.tool}`,
          artifactId: outcome.artifactId,
          defaults,
        };
        await persistAssistant("ok");
        await writer.routing({
          ...routing,
          requestId,
          messageId,
          brief: plan.brief,
          producedVersion: outcome.version,
          substitutions: produced.substitutions,
        });
        log.info(
          { intent, artifactId: outcome.artifactId, version: outcome.version },
          "turn completed with artifact",
        );
        yield { type: "message_completed", requestId, messageId, routing };
        return;
      }

      if (obs.attempted.size > 0) {
        // Tool-bearing turn that ended without an artifact.
        await persistAssistant("failed");
        const intent: Intent =
          plan.intentOverride ??
          (obs.attempted.has("wf_assemble_from_blueprint")
            ? "compose"
            : obs.attempted.has("wf_apply_substitutions")
              ? "substitute"
              : "generate");
        await writer.routing({
          intent,
          rationale: `the ${intent} flow ran but produced no artifact`,
          artifactId: plan.contextArtifactId,
          defaults: plan.baseDefaults,
          requestId,
          messageId,
          brief: plan.brief,
          producedVersion: null,
          substitutions: [],
        });
        if (intent === "compose" && obs.validationErrors.length > 0) {
          const failure = describeBlueprintFailure(obs.validationErrors);
          yield errorEvent(
            requestId,
            "blueprint_invalid",
            failure.message,
            failure.fix,
          );
        } else {
          yield errorEvent(
            requestId,
            "tool_failed",
            obs.failureErrors.length > 0
              ? obs.failureErrors.join("; ")
              : "the tool run finished without producing an artifact",
            "Adjust the brief per the tool's message (it lists what is available) and retry.",
          );
        }
        return;
      }

      // Plain conversation — zero tool calls.
      if (contextCtx !== undefined) {
        pushRefinement(contextCtx, plan.userText);
      }
      const routing: RoutingResult = {
        intent: plan.intentOverride ?? "converse",
        rationale:
          plan.rationaleOverride ??
          "no artifact work implied; answered conversationally",
        artifactId: null,
        defaults: null,
      };
      await persistAssistant("ok");
      await writer.routing({
        ...routing,
        requestId,
        messageId,
        brief: null,
        producedVersion: null,
        substitutions: [],
      });
      yield { type: "message_completed", requestId, messageId, routing };
    } finally {
      tracker.finish(requestId);
    }
  }

  async function* sendTurn(request: ChatSendRequest): AsyncGenerator<AgentEvent> {
    if (disposed) {
      yield errorEvent(
        request.requestId,
        "agent_failed",
        "The session has been disposed.",
        "Reattach to the workspace to start a fresh session.",
      );
      return;
    }
    await ensureRestored();
    const inflight = tracker.inflight();
    if (inflight !== null) {
      yield errorEvent(
        request.requestId,
        "session_busy",
        `A turn is already in flight on this workspace (requestId ${inflight}).`,
        "Wait for the active run to finish or cancel it with chat.cancel.",
      );
      return;
    }
    const authState = await auth.resolve();
    if (authState.status !== "configured") {
      const target = request.artifactId ?? activeArtifactId;
      yield* refuseForAuth(
        request.requestId,
        request.text,
        target,
        authState.status,
      );
      return;
    }
    const targetId = request.artifactId ?? activeArtifactId;
    const ctx = targetId !== null ? artifacts.get(targetId) : undefined;
    yield* runTurn({
      requestId: request.requestId,
      userText: request.text,
      prompt: buildTurnPrompt(request, ctx),
      brief: request.text,
      contextArtifactId: ctx?.artifactId ?? null,
      // A generate/compose result lands on the target only when the caller
      // targeted it explicitly; an untargeted fresh brief creates a new
      // artifact. Substitutions always land on the context artifact.
      ingestTargetForGenerate: request.artifactId ?? null,
      baseDefaults: ctx?.defaults ?? null,
    });
  }

  async function* chipTurn(update: ChipUpdate): AsyncGenerator<AgentEvent> {
    if (disposed) {
      yield errorEvent(
        update.requestId,
        "agent_failed",
        "The session has been disposed.",
        "Reattach to the workspace to start a fresh session.",
      );
      return;
    }
    await ensureRestored();
    const inflight = tracker.inflight();
    if (inflight !== null) {
      yield errorEvent(
        update.requestId,
        "session_busy",
        `A turn is already in flight on this workspace (requestId ${inflight}).`,
        "Wait for the active run to finish or cancel it with chat.cancel.",
      );
      return;
    }
    const ctx = artifacts.get(update.artifactId);
    const validation = validateChipUpdate(ctx?.chipSet ?? null, update);
    if (!validation.ok) {
      // Rejected at the boundary — no tool call occurs.
      yield errorEvent(
        update.requestId,
        "chip_invalid",
        validation.message,
        validation.fix,
      );
      return;
    }
    const authState = await auth.resolve();
    if (authState.status !== "configured") {
      yield* refuseForAuth(
        update.requestId,
        `Decision chip ${update.kind} → ${update.value}`,
        update.artifactId,
        authState.status,
      );
      return;
    }
    const artifactCtx = ctx as ArtifactContext;
    const newDefaults = applyChipValue(
      artifactCtx.defaults,
      update.kind,
      update.value,
    );
    const rerunStep =
      validation.chip.rerunStep === "compose" ? "compose" : "generate";
    yield* runTurn({
      requestId: update.requestId,
      userText: `Decision chip ${update.kind} → ${update.value}`,
      prompt: chipRerunPrompt({
        brief: artifactCtx.brief,
        defaults: newDefaults,
        changedKind: update.kind,
        rerunStep,
        outputDir: turnOutputDir(update.requestId),
        substitutions:
          update.kind === "platform" ? artifactCtx.substitutions : [],
      }),
      brief: artifactCtx.brief,
      contextArtifactId: artifactCtx.artifactId,
      ingestTargetForGenerate: artifactCtx.artifactId,
      baseDefaults: newDefaults,
      intentOverride: rerunIntent(rerunStep),
      rationaleOverride: `decision chip ${update.kind} changed to ${update.value}; only the ${rerunStep} step re-ran`,
    });
  }

  return {
    workspaceId,

    send(request: ChatSendRequest): AsyncIterable<AgentEvent> {
      return sendTurn(request);
    },

    updateChip(update: ChipUpdate): AsyncIterable<AgentEvent> {
      return chipTurn(update);
    },

    cancel(requestId: string): Promise<CancelResult> {
      return Promise.resolve(tracker.cancel(requestId));
    },

    dispose(): Promise<void> {
      disposed = true;
      tracker.abortInflight();
      return Promise.resolve();
    },
  };
}
