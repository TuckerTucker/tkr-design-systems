/**
 * TranscriptRepository — append-ordered records in <workspace-id>/transcript.yaml.
 *
 * Record payloads are opaque to the store (chat semantics belong to
 * agent-orchestration). Appends are read-modify-write behind an atomic
 * rename, serialized per file, so concurrent in-process appends never
 * interleave. Multiline text lands as YAML block scalars — the conversation
 * is reviewable in a text editor.
 */
import { stat } from "node:fs/promises";

import {
  TRANSCRIPT_RECORD_KINDS,
  type StoreResult,
  type TranscriptRecord,
  type TranscriptRepository,
} from "@studio/contract";

import type { StoreContext } from "./context.js";
import { corrupt, fail, notFound, ok } from "./errors.js";
import { relPath, transcriptFile, workspaceDir } from "./layout.js";
import { isValidSlug } from "./slug.js";
import { readYamlFile, writeYamlFile } from "./yaml-io.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTranscriptRecord(value: unknown): value is TranscriptRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.kind === "string" &&
    (TRANSCRIPT_RECORD_KINDS as readonly string[]).includes(value.kind) &&
    typeof value.timestamp === "string" &&
    "payload" in value
  );
}

/** Validate a parsed transcript.yaml; an empty file reads as no records. */
function parseTranscript(
  doc: unknown,
  fileRelPath: string,
): StoreResult<TranscriptRecord[]> {
  if (doc === null || doc === undefined) {
    return ok([]);
  }
  if (!isRecord(doc) || !Array.isArray(doc.records)) {
    return fail(corrupt(fileRelPath, 'expected a mapping with a "records" list'));
  }
  const records: TranscriptRecord[] = [];
  for (const [index, record] of doc.records.entries()) {
    if (!isTranscriptRecord(record)) {
      return fail(
        corrupt(fileRelPath, `record ${index} has a malformed envelope`),
      );
    }
    records.push(record);
  }
  return ok(records);
}

export function createTranscriptRepository(
  ctx: StoreContext,
): TranscriptRepository {
  const logger = ctx.logger.child({ repository: "transcripts" });

  async function workspaceExists(workspaceId: string): Promise<boolean> {
    try {
      return (await stat(workspaceDir(ctx.rootDir, workspaceId))).isDirectory();
    } catch {
      return false;
    }
  }

  async function readRecords(
    workspaceId: string,
  ): Promise<StoreResult<TranscriptRecord[]>> {
    const filePath = transcriptFile(ctx.rootDir, workspaceId);
    const fileRelPath = relPath(ctx.rootDir, filePath);
    const doc = await readYamlFile(filePath, fileRelPath);
    if (!doc.ok) {
      if (doc.error.code === "not_found") {
        return ok([]); // no transcript yet — an empty conversation, not an error
      }
      return doc;
    }
    return parseTranscript(doc.value, fileRelPath);
  }

  async function guard(workspaceId: string): Promise<StoreResult<void>> {
    const ready = await ctx.init();
    if (!ready.ok) {
      return ready;
    }
    if (!isValidSlug(workspaceId) || !(await workspaceExists(workspaceId))) {
      return fail(notFound(`Workspace "${workspaceId}" not found`));
    }
    return ok(undefined);
  }

  return {
    async read(workspaceId: string): Promise<StoreResult<TranscriptRecord[]>> {
      const guarded = await guard(workspaceId);
      if (!guarded.ok) {
        return guarded;
      }
      return readRecords(workspaceId);
    },

    async append(
      workspaceId: string,
      record: TranscriptRecord,
    ): Promise<StoreResult<void>> {
      const guarded = await guard(workspaceId);
      if (!guarded.ok) {
        return guarded;
      }
      const filePath = transcriptFile(ctx.rootDir, workspaceId);
      // Serialize per transcript file: concurrent appends queue, never race.
      return ctx.queue.run(filePath, async () => {
        const current = await readRecords(workspaceId);
        if (!current.ok) {
          // Corrupt transcript: refuse to clobber the damaged file — the
          // error names it for manual repair.
          return current;
        }
        const written = await writeYamlFile(
          filePath,
          { records: [...current.value, record] },
          relPath(ctx.rootDir, filePath),
          ctx.hooks,
        );
        if (written.ok) {
          logger.debug(
            { workspaceId, recordId: record.id, kind: record.kind },
            "transcript record appended",
          );
        }
        return written;
      });
    },
  };
}
