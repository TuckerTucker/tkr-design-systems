/**
 * Per-workspace event journal and broadcast hub — the seq authority behind
 * reconnect-with-resume.
 *
 * Every journaled server→client envelope gets the workspace's next
 * monotonic seq and is retained up to a bounded capacity (oldest evicted).
 * Reattach with a lastEventSeq inside the retained window replays exactly
 * the missed events in order; outside the window the caller falls back to
 * a full state re-sync.
 *
 * Snapshot sends (attach-time status pushes and re-sync events) are
 * deliberately NOT journaled: they are stamped with the current head seq —
 * the sequence stays monotonic non-decreasing on the wire, and resume
 * arithmetic ("every event with seq > N exactly once") holds because only
 * journaled events advance the sequence.
 */
import type { ServerMessage } from "@studio/contract";

import type { Logger } from "../../logging/create-logger.js";
import type { WsConnection } from "../../ws/connection-gateway.js";

/** Default bounded retention per workspace (oldest evicted). */
export const DEFAULT_JOURNAL_CAPACITY = 1000;

/** A ServerMessage before seq assignment — the hub owns the stamp. */
export type OutboundMessage = ServerMessage extends infer M
  ? M extends { seq: number }
    ? Omit<M, "seq">
    : never
  : never;

interface JournalEntry {
  seq: number;
  raw: string;
}

export type ReplayDecision =
  | { mode: "replay"; entries: string[] }
  | { mode: "resync" };

export interface WorkspaceHub {
  readonly workspaceId: string;
  /** Highest seq assigned so far (0 before any event). */
  headSeq(): number;
  /** Stamp, journal, and fan out to every attached connection. */
  broadcast(message: OutboundMessage): void;
  /** Send a snapshot envelope to one connection (head-seq stamped, not journaled). */
  sendSnapshot(connection: WsConnection, message: OutboundMessage): void;
  /** Replay decision for a reattach cursor. */
  resumeFrom(lastEventSeq: number | undefined): ReplayDecision;
  attach(connection: WsConnection): void;
  detach(connection: WsConnection): void;
  attachedCount(): number;
}

export interface HubRegistry {
  /** Lazily create (or return) the hub for a workspace. */
  hub(workspaceId: string): WorkspaceHub;
  /** The hub if it already exists (event relays use this — no allocation). */
  peek(workspaceId: string): WorkspaceHub | undefined;
  /** Every hub with at least one attached connection. */
  attachedHubs(): WorkspaceHub[];
}

export interface HubRegistryOptions {
  logger: Logger;
  /** Journal retention per workspace; tests shrink this. */
  journalCapacity?: number;
}

function stamp(message: OutboundMessage, seq: number): string {
  // Reassemble with seq in canonical envelope order.
  const { type, requestId, payload } = message as {
    type: string;
    requestId?: string;
    payload: unknown;
  };
  return JSON.stringify({
    type,
    ...(requestId !== undefined ? { requestId } : {}),
    seq,
    payload,
  });
}

export function createHubRegistry(options: HubRegistryOptions): HubRegistry {
  const { logger, journalCapacity = DEFAULT_JOURNAL_CAPACITY } = options;
  const hubs = new Map<string, WorkspaceHub>();

  function createHub(workspaceId: string): WorkspaceHub {
    const log = logger.child({ component: "ws-hub", workspaceId });
    const journal: JournalEntry[] = [];
    const attached = new Set<WsConnection>();
    let seq = 0;

    return {
      workspaceId,

      headSeq: () => seq,

      broadcast(message) {
        seq += 1;
        const raw = stamp(message, seq);
        journal.push({ seq, raw });
        if (journal.length > journalCapacity) {
          journal.splice(0, journal.length - journalCapacity);
        }
        log.debug(
          { seq, type: (message as { type: string }).type, fanout: attached.size },
          "workspace event broadcast",
        );
        for (const connection of attached) {
          connection.send(raw);
        }
      },

      sendSnapshot(connection, message) {
        connection.send(stamp(message, seq));
      },

      resumeFrom(lastEventSeq) {
        if (lastEventSeq === undefined || lastEventSeq > seq) {
          // No cursor, or a cursor from another life — authoritative re-sync.
          return { mode: "resync" };
        }
        if (lastEventSeq === seq) {
          return { mode: "replay", entries: [] };
        }
        const first = journal[0];
        if (first === undefined || lastEventSeq < first.seq - 1) {
          // The journal cannot satisfy the gap — full re-sync.
          return { mode: "resync" };
        }
        return {
          mode: "replay",
          entries: journal
            .filter((entry) => entry.seq > lastEventSeq)
            .map((entry) => entry.raw),
        };
      },

      attach(connection) {
        attached.add(connection);
        log.debug(
          { connectionId: connection.connectionId, attached: attached.size },
          "connection attached to workspace",
        );
      },

      detach(connection) {
        if (attached.delete(connection)) {
          log.debug(
            { connectionId: connection.connectionId, attached: attached.size },
            "connection detached from workspace",
          );
        }
      },

      attachedCount: () => attached.size,
    };
  }

  return {
    hub(workspaceId) {
      let hub = hubs.get(workspaceId);
      if (hub === undefined) {
        hub = createHub(workspaceId);
        hubs.set(workspaceId, hub);
      }
      return hub;
    },
    peek: (workspaceId) => hubs.get(workspaceId),
    attachedHubs: () =>
      [...hubs.values()].filter((hub) => hub.attachedCount() > 0),
  };
}
