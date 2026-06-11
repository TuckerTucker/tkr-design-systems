/**
 * SessionManager — one AgentSession per workspace: lazy create on acquire,
 * dispose on release, disposeAll on server shutdown. Sessions are reused
 * across turns; a workspace reopened after a restart gets a fresh session
 * whose context restores from the persisted transcript.
 */
import type { TranscriptRepository, WorkspaceRepository } from "@studio/contract";

import type { ArtifactPipeline } from "../artifact-pipeline/index.js";
import type { VersionFileResolver } from "../artifact-pipeline/version-files.js";
import type { Logger } from "../logging/create-logger.js";
import type { AuthManager } from "./auth.js";
import type { AgentConfig, AgentRuntime } from "./runtime.js";
import {
  createAgentSession,
  type AgentSession,
  type SystemCatalog,
} from "./session.js";

export interface SessionManager {
  /** Lazy create; the same session is returned until released. */
  acquire(workspaceId: string): Promise<AgentSession>;
  /** Dispose the workspace's session (workspace closed). */
  release(workspaceId: string): Promise<void>;
  /** Dispose every session (server shutdown). */
  disposeAll(): Promise<void>;
}

export interface SessionManagerDeps {
  transcripts: TranscriptRepository;
  ingest: ArtifactPipeline["ingest"];
  runtime: AgentRuntime;
  auth: AuthManager;
  config: AgentConfig;
  logger: Logger;
  workspaces?: WorkspaceRepository;
  versionFiles?: VersionFileResolver;
  systems?: SystemCatalog;
}

export function createAgentSessionManager(
  deps: SessionManagerDeps,
): SessionManager {
  const log = deps.logger.child({ component: "agent-session-manager" });
  const sessions = new Map<string, AgentSession>();

  return {
    acquire(workspaceId: string): Promise<AgentSession> {
      let session = sessions.get(workspaceId);
      if (session === undefined) {
        log.debug({ workspaceId }, "agent session created");
        session = createAgentSession({
          workspaceId,
          transcripts: deps.transcripts,
          ingest: deps.ingest,
          runtime: deps.runtime,
          auth: deps.auth,
          config: deps.config,
          logger: deps.logger,
          ...(deps.workspaces !== undefined
            ? { workspaces: deps.workspaces }
            : {}),
          ...(deps.versionFiles !== undefined
            ? { versionFiles: deps.versionFiles }
            : {}),
          ...(deps.systems !== undefined ? { systems: deps.systems } : {}),
        });
        sessions.set(workspaceId, session);
      }
      return Promise.resolve(session);
    },

    async release(workspaceId: string): Promise<void> {
      const session = sessions.get(workspaceId);
      if (session !== undefined) {
        sessions.delete(workspaceId);
        await session.dispose();
        log.debug({ workspaceId }, "agent session disposed");
      }
    },

    async disposeAll(): Promise<void> {
      const open = [...sessions.values()];
      sessions.clear();
      await Promise.all(open.map((session) => session.dispose()));
      log.debug({ count: open.length }, "all agent sessions disposed");
    },
  };
}
