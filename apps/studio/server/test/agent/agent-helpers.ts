/**
 * Shared fixtures for the agent-orchestration suite — a scripted
 * AgentRuntime fake (the keyless seam), in-memory store repositories, a
 * recording ingest seam, and a session factory wired like the composition
 * root would wire it.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type {
  AgentEvent,
  StoreResult,
  TranscriptRecord,
  TranscriptRepository,
  WorkspaceMeta,
  WorkspaceRepository,
} from "@studio/contract";

import type {
  IngestOutcome,
  IngestRequest,
  PipelineResult,
} from "../../src/artifact-pipeline/index.js";
import type { VersionFileResolver } from "../../src/artifact-pipeline/version-files.js";
import { createAuthManager, type AuthManager } from "../../src/agent/auth.js";
import type {
  AgentConfig,
  AgentRuntime,
  RuntimeEvent,
  RuntimeTurnRequest,
} from "../../src/agent/runtime.js";
import {
  createAgentSession,
  type AgentSession,
  type AgentSessionDeps,
} from "../../src/agent/session.js";
import { captureLogger, makeTempDir, type CapturedLogger } from "../helpers.js";

export const TEST_API_KEY = "sk-ant-test-1f2e3d4c5b6a-SECRET";
export const WORKSPACE_ID = "test-workspace";

function ok<T>(value: T): StoreResult<T> {
  return { ok: true, value };
}

// ── Scripted runtime ──

export type ScriptStep = RuntimeEvent | { type: "wait_for_abort" };

export type Script =
  | ScriptStep[]
  | ((request: RuntimeTurnRequest) => ScriptStep[]);

export interface ScriptedRuntime extends AgentRuntime {
  /** Every turn request the session issued, in order. */
  requests: RuntimeTurnRequest[];
}

/** Each run() consumes the next script; an exhausted list completes empty. */
export function createScriptedRuntime(scripts: Script[]): ScriptedRuntime {
  const requests: RuntimeTurnRequest[] = [];
  let index = 0;
  return {
    requests,
    async *run(request: RuntimeTurnRequest): AsyncIterable<RuntimeEvent> {
      requests.push(request);
      const script = scripts[index];
      index += 1;
      const steps =
        script === undefined
          ? ([{ type: "turn_completed" }] as ScriptStep[])
          : typeof script === "function"
            ? script(request)
            : script;
      for (const step of steps) {
        if (step.type === "wait_for_abort") {
          await new Promise<void>((resolve) => {
            if (request.signal.aborted) {
              resolve();
              return;
            }
            request.signal.addEventListener("abort", () => resolve(), {
              once: true,
            });
          });
          yield {
            type: "turn_failed",
            reason: "aborted",
            message: "aborted by signal",
          };
          return;
        }
        yield step;
        // Yield to the microtask queue so cancel() can interleave.
        await Promise.resolve();
      }
    },
  };
}

// ── In-memory repositories ──

export interface MemoryTranscripts extends TranscriptRepository {
  records: TranscriptRecord[];
}

export function createMemoryTranscripts(
  seed: TranscriptRecord[] = [],
): MemoryTranscripts {
  const records = [...seed];
  return {
    records,
    read: () => Promise.resolve(ok([...records])),
    append: (_workspaceId, record) => {
      records.push(record);
      return Promise.resolve(ok(undefined));
    },
  };
}

export interface MemoryWorkspaces extends WorkspaceRepository {
  meta: WorkspaceMeta;
}

export function createMemoryWorkspaces(
  overrides: Partial<WorkspaceMeta> = {},
): MemoryWorkspaces {
  const meta: WorkspaceMeta = {
    id: WORKSPACE_ID,
    name: "Test workspace",
    created: "2026-01-01T00:00:00.000Z",
    updated: "2026-01-01T00:00:00.000Z",
    activeArtifactId: null,
    settings: {},
    ...overrides,
  };
  return {
    meta,
    list: () => Promise.resolve(ok([{ ok: true as const, workspace: meta }])),
    create: () => Promise.resolve(ok(meta)),
    get: () => Promise.resolve(ok(meta)),
    update: (_id, patch) => {
      if (patch.activeArtifactId !== undefined) {
        meta.activeArtifactId = patch.activeArtifactId;
      }
      if (patch.name !== undefined) {
        meta.name = patch.name;
      }
      return Promise.resolve(ok(meta));
    },
    softDelete: () => Promise.resolve(ok(undefined)),
    listDeleted: () => Promise.resolve(ok([])),
    restore: () => Promise.resolve(ok(meta)),
  };
}

// ── Recording ingest seam ──

export interface FakeIngest {
  ingest(request: IngestRequest): Promise<PipelineResult<IngestOutcome>>;
  requests: IngestRequest[];
  /** Force the next ingest call to fail with this message. */
  failNextWith: string | null;
}

export function createFakeIngest(): FakeIngest {
  const requests: IngestRequest[] = [];
  const versions = new Map<string, number>();
  let nextNew = 1;
  const fake: FakeIngest = {
    requests,
    failNextWith: null,
    ingest(request) {
      requests.push(request);
      if (fake.failNextWith !== null) {
        const message = fake.failNextWith;
        fake.failNextWith = null;
        return Promise.resolve({
          ok: false as const,
          error: { code: "STORE_FAILURE" as const, message },
        });
      }
      const artifactId = request.artifactId ?? `art-${nextNew++}`;
      const version = (versions.get(artifactId) ?? 0) + 1;
      versions.set(artifactId, version);
      return Promise.resolve({
        ok: true as const,
        value: {
          artifactId,
          version,
          headVersion: version,
          provenance: {
            parent: version > 1 ? version - 1 : null,
            brief: request.provenance.brief,
            tool: request.provenance.tool,
            parameters: request.provenance.parameters,
            created: new Date().toISOString(),
          },
          metadata: {
            status: "unavailable" as const,
            reason: "test ingest does not parse specs",
          },
        },
      });
    },
  };
  return fake;
}

// ── Session fixture ──

export interface SessionFixture {
  session: AgentSession;
  runtime: ScriptedRuntime;
  transcripts: MemoryTranscripts;
  workspaces: MemoryWorkspaces;
  ingest: FakeIngest;
  auth: AuthManager;
  /** Mutable env backing auth resolution (delete the key to go keyless). */
  env: NodeJS.ProcessEnv;
  capture: CapturedLogger;
  stagingDir: string;
  /** Store root used by the fake version-file resolver. */
  versionsRoot: string;
  versionFiles: VersionFileResolver;
  config: AgentConfig;
  /** Construct a second session over the same repositories (restore). */
  reopen(runtime: ScriptedRuntime): AgentSession;
}

export interface SessionFixtureOptions {
  scripts?: Script[];
  env?: NodeJS.ProcessEnv;
  transcripts?: MemoryTranscripts;
  workspaces?: MemoryWorkspaces;
  systems?: string[];
}

export function makeSessionFixture(
  options: SessionFixtureOptions = {},
): SessionFixture {
  const capture = captureLogger("debug");
  const stagingDir = makeTempDir("agent-staging");
  const versionsRoot = makeTempDir("agent-store");
  const repoRoot = makeTempDir("agent-repo");
  const env = options.env ?? { ANTHROPIC_API_KEY: TEST_API_KEY };
  const auth = createAuthManager({ repoRoot, env, logger: capture.logger });
  const runtime = createScriptedRuntime(options.scripts ?? []);
  const transcripts = options.transcripts ?? createMemoryTranscripts();
  const workspaces = options.workspaces ?? createMemoryWorkspaces();
  const ingest = createFakeIngest();
  const versionFiles: VersionFileResolver = (
    workspaceId,
    artifactId,
    version,
    file,
  ) =>
    path.join(
      versionsRoot,
      workspaceId,
      artifactId,
      String(version).padStart(4, "0"),
      file === "svg" ? "wireframe.svg" : "wireframe.spec.yaml",
    );
  const config: AgentConfig = {
    mcpLaunch: {
      command: "/usr/bin/env",
      args: ["tools/mcp-server/server.py"],
      cwd: repoRoot,
    },
    stagingDir,
    maxTurns: 8,
  };
  const systems = options.systems ?? ["swiss", "terminal", "editorial"];

  function deps(activeRuntime: AgentRuntime): AgentSessionDeps {
    return {
      workspaceId: WORKSPACE_ID,
      transcripts,
      ingest: (request) => ingest.ingest(request),
      runtime: activeRuntime,
      auth,
      config,
      logger: capture.logger,
      workspaces,
      versionFiles,
      systems: { list: () => Promise.resolve([...systems]) },
    };
  }

  return {
    session: createAgentSession(deps(runtime)),
    runtime,
    transcripts,
    workspaces,
    ingest,
    auth,
    env,
    capture,
    stagingDir,
    versionsRoot,
    versionFiles,
    config,
    reopen: (nextRuntime) => createAgentSession(deps(nextRuntime)),
  };
}

/** Drain an event stream into an array. */
export async function collect(
  stream: AsyncIterable<AgentEvent>,
): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of stream) {
    events.push(event);
  }
  return events;
}

export function eventTypes(events: AgentEvent[]): string[] {
  return events.map((event) => event.type);
}

export function findEvent<T extends AgentEvent["type"]>(
  events: AgentEvent[],
  type: T,
): Extract<AgentEvent, { type: T }> | undefined {
  return events.find(
    (event): event is Extract<AgentEvent, { type: T }> => event.type === type,
  );
}

// ── Canned scripts ──

/** A full wf_generate run: routing_request → layout pick → files emitted. */
export function generationScript(args: {
  outputDir: string;
  system?: string;
  platform?: "mobile" | "desktop";
  layoutId?: string;
  patterns?: string[];
  brief?: string;
  skipRouting?: boolean;
}): ScriptStep[] {
  const system = args.system ?? "swiss";
  const platform = args.platform ?? "desktop";
  const layoutId = args.layoutId ?? "dashboard";
  const patterns = args.patterns ?? ["dashboard", "login", "settings"];
  const brief = args.brief ?? "a dashboard for a meditation app";
  const svgPath = path.join(args.outputDir, "wireframe.svg");
  const specPath = path.join(args.outputDir, "wireframe.spec.yaml");
  mkdirSync(args.outputDir, { recursive: true });
  writeFileSync(svgPath, "<svg><text>generated</text></svg>");
  writeFileSync(specPath, "wireframe:\n  brief: test\n");

  const steps: ScriptStep[] = [];
  if (args.skipRouting !== true) {
    steps.push(
      {
        type: "tool_started",
        toolUseId: "tu-route",
        toolName: "wf_generate",
        input: { brief, system, platform },
      },
      {
        type: "tool_finished",
        toolUseId: "tu-route",
        toolName: "wf_generate",
        input: { brief, system, platform },
        ok: true,
        result: {
          ok: true,
          routing_request: {
            available_patterns: patterns.map((id) => ({ pattern_id: id })),
            available_components: [],
          },
        },
      },
    );
  }
  steps.push(
    { type: "assistant_text", text: `Generating with the ${layoutId} layout. ` },
    {
      type: "tool_started",
      toolUseId: "tu-full",
      toolName: "wf_generate",
      input: { brief, system, platform, layout_id: layoutId },
    },
    {
      type: "tool_finished",
      toolUseId: "tu-full",
      toolName: "wf_generate",
      input: { brief, system, platform, layout_id: layoutId },
      ok: true,
      result: { ok: true, svg_path: svgPath, spec_path: specPath },
    },
    { type: "turn_completed" },
  );
  return steps;
}

/** A plain-conversation turn: deltas only, zero tool calls. */
export function converseScript(text = "A wireframe is a low-fi layout. "): ScriptStep[] {
  return [
    { type: "assistant_text", text },
    { type: "assistant_text", text: "It shows structure before styling." },
    { type: "turn_completed" },
  ];
}
