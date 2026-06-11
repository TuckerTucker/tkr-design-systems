/**
 * Contract exhaustiveness — the ClientMessage/ServerMessage unions carry
 * exactly the architecture.md message vocabulary. Drift (an extra, missing,
 * or renamed type) fails at compile time through the AssertExact checks and
 * at runtime against the literal lists.
 */
import { describe, expect, it } from "vitest";

import {
  CLIENT_MESSAGE_TYPES,
  SERVER_MESSAGE_TYPES,
  type ClientMessage,
  type ClientMessageType,
  type ServerMessage,
  type ServerMessageType,
} from "@studio/contract";

// ── Type-level exhaustiveness (compile-time; tsc runs over tests) ──

type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

// The unions' discriminants are exactly the literal vocabularies.
const clientUnionMatchesVocabulary: AssertExact<
  ClientMessage["type"],
  ClientMessageType
> = true;
const serverUnionMatchesVocabulary: AssertExact<
  ServerMessage["type"],
  ServerMessageType
> = true;

// Client envelopes carry no seq by construction; server envelopes must.
type ClientHasNoSeq = ClientMessage extends { seq: number } ? never : true;
type ServerHasSeq = ServerMessage extends { seq: number } ? true : never;
const clientHasNoSeq: ClientHasNoSeq = true;
const serverHasSeq: ServerHasSeq = true;

// The architecture.md lists, verbatim — any rename in the contract package
// breaks these literal arrays at compile time.
const ARCHITECTURE_CLIENT_TYPES: readonly ClientMessageType[] = [
  "workspace.attach",
  "chat.send",
  "chat.cancel",
  "chip.update",
];

const ARCHITECTURE_SERVER_TYPES: readonly ServerMessageType[] = [
  "chat.message_started",
  "chat.assistant_delta",
  "chat.tool_started",
  "chat.tool_finished",
  "chat.message_completed",
  "chat.error",
  "chips.updated",
  "artifact.version_created",
  "artifact.compliance_completed",
  "bridge.status",
  "auth.status",
];

describe("contract message vocabulary", () => {
  it("exposes exactly the four client→server message types", () => {
    expect([...CLIENT_MESSAGE_TYPES].sort()).toEqual(
      [...ARCHITECTURE_CLIENT_TYPES].sort(),
    );
    expect(CLIENT_MESSAGE_TYPES).toHaveLength(4);
  });

  it("exposes exactly the eleven server→client message types", () => {
    expect([...SERVER_MESSAGE_TYPES].sort()).toEqual(
      [...ARCHITECTURE_SERVER_TYPES].sort(),
    );
    expect(SERVER_MESSAGE_TYPES).toHaveLength(11);
  });

  it("compile-time assertions hold", () => {
    expect(clientUnionMatchesVocabulary).toBe(true);
    expect(serverUnionMatchesVocabulary).toBe(true);
    expect(clientHasNoSeq).toBe(true);
    expect(serverHasSeq).toBe(true);
  });
});
