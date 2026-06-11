/**
 * WS channel — workspace.attach binding, monotonic seq, resume replay,
 * full re-sync fallback, and workspace switching. Real server over a real
 * temp-directory store; the agent runtime is the scripted fake and the
 * bridge stays stopped (compliance lands "unavailable" — the genuine
 * bridge-down seam, no mocks).
 */
import { afterEach, describe, expect, it } from "vitest";

import type { ServerMessage, WorkspaceSummary } from "@studio/contract";

import { makeTempDir } from "../helpers.js";
import {
  attachWorkspace,
  connectWs,
  fixtureGenerationScript,
  http,
  startApiServer,
  type ApiServerFixture,
  type TestWsClient,
} from "./api-helpers.js";

let fixture: ApiServerFixture | undefined;
const clients: TestWsClient[] = [];

afterEach(async () => {
  for (const client of clients.splice(0)) {
    client.terminate();
  }
  await fixture?.close();
  fixture = undefined;
});

async function connect(): Promise<TestWsClient> {
  const client = await connectWs((fixture as ApiServerFixture).wsUrl);
  clients.push(client);
  return client;
}

async function createWorkspace(name: string): Promise<string> {
  const created = await http(
    (fixture as ApiServerFixture).base,
    "POST",
    "/api/workspaces",
    { name },
  );
  expect(created.status).toBe(201);
  return (created.body as WorkspaceSummary).id;
}

const SCRIPT_STAGING = (): string => makeTempDir("ws-session-staging");

function seqs(events: ServerMessage[]): number[] {
  return events.map((event) => event.seq);
}

describe("workspace attach", () => {
  it("acknowledges attach with bridge.status then auth.status, echoing the requestId on the first envelope", async () => {
    fixture = await startApiServer();
    const wsId = await createWorkspace("Attach Test");
    const client = await connect();

    client.send({
      type: "workspace.attach",
      requestId: "attach-1",
      payload: { workspaceId: wsId },
    });
    const first = await client.waitForType("bridge.status");
    const second = await client.waitForType("auth.status");

    expect(client.events[0]).toBe(first);
    expect(first.requestId).toBe("attach-1");
    expect(first.payload.state).toBe("stopped");
    expect(second.requestId).toBe("attach-1");
    expect(second.payload.state).toBe("configured");
  });

  it("answers an unknown workspace with chat.error workspace_not_found and keeps the connection open", async () => {
    fixture = await startApiServer();
    const client = await connect();

    client.send({
      type: "workspace.attach",
      requestId: "attach-bad",
      payload: { workspaceId: "no-such-workspace" },
    });
    const error = await client.waitForType("chat.error");

    expect(error.requestId).toBe("attach-bad");
    expect(error.payload.error.code).toBe("workspace_not_found");
    expect(error.payload.error.fix).toContain("GET /api/workspaces");
    expect(client.socket.readyState).toBe(client.socket.OPEN);
  });
});

describe("seq, resume, and re-sync", () => {
  it("streams with monotonic seq; reattach with lastEventSeq replays exactly the missed events — none lost, none duplicated", async () => {
    fixture = await startApiServer({
      scripts: [fixtureGenerationScript(SCRIPT_STAGING())],
    });
    const wsId = await createWorkspace("Resume Test");

    const client = await connect();
    await attachWorkspace(client, wsId, { requestId: "attach-1" });

    client.send({
      type: "chat.send",
      requestId: "turn-1",
      payload: { text: "a dashboard for a meditation app" },
    });

    const started = await client.waitForType("chat.message_started");
    expect(started.requestId).toBe("turn-1");

    // Drop the socket mid-stream; the turn keeps streaming into the journal.
    const delta = await client.waitForType("chat.assistant_delta");
    const lastSeen = delta.seq;
    client.terminate();

    const reconnect = await connect();
    await attachWorkspace(reconnect, wsId, {
      requestId: "attach-2",
      lastEventSeq: lastSeen,
    });
    const completed = await reconnect.waitForType("chat.message_completed", 60_000);
    expect(completed.payload.cancelled).toBe(false);
    expect(completed.payload.artifactRefs).toHaveLength(1);

    // Journaled events on the reconnect resume exactly at lastSeen + 1 and
    // increase by one — no gap, no duplicate. The first two envelopes are
    // the attach acknowledgement snapshots (head-seq stamped, not part of
    // the journal stream) and are excluded from the resume arithmetic.
    const journaled = reconnect.events
      .slice(2)
      .filter((event) => event.seq > lastSeen);
    const sequence = seqs(journaled);
    expect(sequence[0]).toBe(lastSeen + 1);
    for (let i = 1; i < sequence.length; i += 1) {
      expect(sequence[i]).toBe((sequence[i - 1] as number) + 1);
    }
    const types = journaled.map((event) => event.type);
    expect(types).toContain("artifact.version_created");
    expect(types).toContain("artifact.compliance_completed");
    expect(types).toContain("chips.updated");
    expect(types).toContain("chat.message_completed");
  });

  it("reattach exactly at the journal head replays nothing and continues live", async () => {
    fixture = await startApiServer({
      scripts: [fixtureGenerationScript(SCRIPT_STAGING())],
    });
    const wsId = await createWorkspace("Head Test");

    const client = await connect();
    await attachWorkspace(client, wsId);
    client.send({
      type: "chat.send",
      requestId: "turn-1",
      payload: { text: "a dashboard" },
    });
    const completed = await client.waitForType("chat.message_completed", 60_000);
    const headSeq = completed.seq;
    client.terminate();

    const reconnect = await connect();
    await attachWorkspace(reconnect, wsId, { lastEventSeq: headSeq });
    // Only the two attach snapshots arrived; no replayed (seq > snapshot) events.
    const replayed = reconnect.events.filter((event) => event.seq > headSeq);
    expect(replayed).toHaveLength(0);
  });

  it("falls back to full re-sync outside the journal window, using only the contract event vocabulary", async () => {
    fixture = await startApiServer({
      scripts: [fixtureGenerationScript(SCRIPT_STAGING())],
      journalCapacity: 3,
    });
    const wsId = await createWorkspace("Resync Test");

    const client = await connect();
    await attachWorkspace(client, wsId);
    client.send({
      type: "chat.send",
      requestId: "turn-1",
      payload: { text: "a dashboard" },
    });
    const completed = await client.waitForType("chat.message_completed", 60_000);
    expect(completed.payload.artifactRefs).toHaveLength(1);
    client.terminate();

    // The journal retains only 3 entries; cursor 1 cannot be satisfied.
    const reconnect = await connect();
    await attachWorkspace(reconnect, wsId, { lastEventSeq: 1 });

    const resynced = await reconnect.waitForType("chat.message_completed", 30_000);
    expect(resynced.payload.messageId).toBe(completed.payload.messageId);
    const resyncedVersion = await reconnect.waitForType(
      "artifact.version_created",
      30_000,
    );
    expect(resyncedVersion.payload.version.number).toBe(1);

    const allowed = new Set<string>([
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
    ]);
    for (const event of reconnect.events) {
      expect(allowed.has(event.type)).toBe(true);
    }
  });

  it("releases workspace A's binding when attaching to B; A's events stop arriving", async () => {
    fixture = await startApiServer({
      scripts: [fixtureGenerationScript(SCRIPT_STAGING())],
    });
    const wsA = await createWorkspace("Workspace A");
    const wsB = await createWorkspace("Workspace B");

    const switcher = await connect();
    await attachWorkspace(switcher, wsA);
    await attachWorkspace(switcher, wsB);

    const driver = await connect();
    await attachWorkspace(driver, wsA);
    driver.send({
      type: "chat.send",
      requestId: "turn-a",
      payload: { text: "a dashboard" },
    });
    await driver.waitForType("chat.message_completed", 60_000);

    const leaked = switcher.events.filter(
      (event) =>
        event.type.startsWith("chat.") || event.type.startsWith("artifact."),
    );
    expect(leaked).toHaveLength(0);
  });

  it("two connections attached to the same workspace both receive the stream", async () => {
    fixture = await startApiServer({
      scripts: [fixtureGenerationScript(SCRIPT_STAGING())],
    });
    const wsId = await createWorkspace("Two Tabs");

    const tabOne = await connect();
    const tabTwo = await connect();
    await attachWorkspace(tabOne, wsId);
    await attachWorkspace(tabTwo, wsId);

    tabOne.send({
      type: "chat.send",
      requestId: "turn-1",
      payload: { text: "a dashboard" },
    });
    const doneOne = await tabOne.waitForType("chat.message_completed", 60_000);
    const doneTwo = await tabTwo.waitForType("chat.message_completed", 60_000);
    expect(doneOne.seq).toBe(doneTwo.seq);
    expect(doneOne.payload.messageId).toBe(doneTwo.payload.messageId);
  });
});
