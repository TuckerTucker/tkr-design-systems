/**
 * Chat streaming relay — stream ordering, requestId echo, busy rejection,
 * cancellation, chip-update resolution, and keyless degradation. Real
 * server + real store + real pipeline; the agent runtime is the scripted
 * fake (the SDK itself is keyed-suite territory).
 */
import { afterEach, describe, expect, it } from "vitest";

import type { ServerMessage, WorkspaceSummary } from "@studio/contract";

import type { Script } from "../agent/agent-helpers.js";
import { makeTempDir } from "../helpers.js";
import {
  attachWorkspace,
  connectWs,
  fixtureGenerationScript,
  holdUntilCancelledScript,
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

async function setup(
  scripts: Script[],
  env?: NodeJS.ProcessEnv,
): Promise<{ wsId: string; client: TestWsClient }> {
  fixture = await startApiServer({ scripts, ...(env !== undefined ? { env } : {}) });
  const created = await http(fixture.base, "POST", "/api/workspaces", {
    name: "Relay Test",
  });
  const wsId = (created.body as WorkspaceSummary).id;
  const client = await connectWs(fixture.wsUrl);
  clients.push(client);
  await attachWorkspace(client, wsId);
  return { wsId, client };
}

function orderOf(events: ServerMessage[], types: string[]): number[] {
  return types.map((type) => events.findIndex((event) => event.type === type));
}

describe("chat.send streaming", () => {
  it("relays the full generation stream in order as typed envelopes with the requestId echoed", async () => {
    const { client } = await setup([
      fixtureGenerationScript(makeTempDir("relay-staging")),
    ]);

    client.send({
      type: "chat.send",
      requestId: "turn-1",
      payload: { text: "a dashboard for a meditation app" },
    });

    const completed = await client.waitForType("chat.message_completed", 60_000);
    expect(completed.requestId).toBe("turn-1");
    expect(completed.payload.cancelled).toBe(false);
    expect(completed.payload.artifactRefs).toHaveLength(1);

    const stream = client.events.filter((event) => event.requestId === "turn-1");
    for (const event of stream) {
      expect(event.requestId).toBe("turn-1");
    }
    const [started, delta, toolStarted, toolFinished, version, chips, done] =
      orderOf(stream, [
        "chat.message_started",
        "chat.assistant_delta",
        "chat.tool_started",
        "chat.tool_finished",
        "artifact.version_created",
        "chips.updated",
        "chat.message_completed",
      ]);
    // message_started first; deltas and tool events strictly between;
    // the artifact lands before the turn closes; completion is last.
    expect(started).toBe(0);
    expect(delta).toBeGreaterThan(started as number);
    expect(toolStarted).toBeGreaterThan(started as number);
    expect(toolFinished).toBeGreaterThan(toolStarted as number);
    expect(version).toBeGreaterThan(toolStarted as number);
    expect(chips).toBeGreaterThan(version as number);
    expect(done).toBe(stream.length - 1);

    // The compliance run settles asynchronously after the landing (before
    // or after the turn closes); its event reaches the attached client.
    const compliance =
      client.events.find(
        (event) => event.type === "artifact.compliance_completed",
      ) ?? (await client.waitForType("artifact.compliance_completed", 30_000));
    expect(
      compliance.type === "artifact.compliance_completed" &&
        compliance.payload.version,
    ).toBe(1);

    // tool payloads carry the tool name end to end.
    const tool = stream.find((event) => event.type === "chat.tool_started");
    expect(tool?.type === "chat.tool_started" && tool.payload.tool).toBe("wf_generate");
  });

  it("rejects a second chat.send while a turn is in flight with turn_in_progress, leaving the turn unaffected", async () => {
    const { client } = await setup([holdUntilCancelledScript()]);

    client.send({
      type: "chat.send",
      requestId: "turn-1",
      payload: { text: "slow turn" },
    });
    const started = await client.waitForType("chat.message_started");

    client.send({
      type: "chat.send",
      requestId: "turn-2",
      payload: { text: "impatient second turn" },
    });
    const busy = await client.waitForType("chat.error");
    expect(busy.requestId).toBe("turn-2");
    expect(busy.payload.error.code).toBe("turn_in_progress");
    expect(busy.payload.error.fix).toContain("chat.cancel");

    // The in-flight turn still closes (cancel it now).
    client.send({
      type: "chat.cancel",
      requestId: "cancel-1",
      payload: { messageId: started.payload.messageId },
    });
    const closed = await client.waitForType("chat.message_completed");
    expect(closed.payload.cancelled).toBe(true);
    expect(closed.payload.messageId).toBe(started.payload.messageId);
  });

  it("chat.cancel mid-generation closes the turn with message_completed cancelled — never silence", async () => {
    const { client } = await setup([holdUntilCancelledScript()]);

    client.send({
      type: "chat.send",
      requestId: "turn-1",
      payload: { text: "cancel me" },
    });
    const started = await client.waitForType("chat.message_started");
    await client.waitForType("chat.assistant_delta");

    client.send({
      type: "chat.cancel",
      requestId: "cancel-1",
      payload: { messageId: started.payload.messageId },
    });
    const closed = await client.waitForType("chat.message_completed");
    expect(closed.payload.cancelled).toBe(true);
  });

  it("chat.cancel after the turn completed answers turn_not_active", async () => {
    const { client } = await setup([
      fixtureGenerationScript(makeTempDir("relay-staging")),
    ]);
    client.send({
      type: "chat.send",
      requestId: "turn-1",
      payload: { text: "a dashboard" },
    });
    const completed = await client.waitForType("chat.message_completed", 60_000);

    client.send({
      type: "chat.cancel",
      requestId: "cancel-late",
      payload: { messageId: completed.payload.messageId },
    });
    const error = await client.waitForType("chat.error");
    expect(error.requestId).toBe("cancel-late");
    expect(error.payload.error.code).toBe("turn_not_active");
  });
});

describe("chip.update resolution", () => {
  it("resolves the artifactId via the ChipSet for the messageId and re-runs the affected step into a new version", async () => {
    const staging = makeTempDir("relay-staging");
    const { client } = await setup([
      fixtureGenerationScript(staging),
      fixtureGenerationScript(staging, { platform: "mobile" }),
    ]);

    client.send({
      type: "chat.send",
      requestId: "turn-1",
      payload: { text: "a dashboard" },
    });
    const chips = await client.waitForType("chips.updated", 60_000);
    await client.waitForType("chat.message_completed", 60_000);
    const firstVersion = client.events.find(
      (event) => event.type === "artifact.version_created",
    );
    expect(firstVersion?.type === "artifact.version_created" ? firstVersion.payload.version.number : 0).toBe(1);

    client.send({
      type: "chip.update",
      requestId: "chip-1",
      payload: {
        messageId: chips.payload.messageId,
        kind: "platform",
        value: "mobile",
      },
    });

    const newVersion = await client.waitForType("artifact.version_created", 60_000);
    expect(newVersion.requestId).toBe("chip-1");
    expect(newVersion.payload.artifactId).toBe(chips.payload.artifactId);
    expect(newVersion.payload.version.number).toBe(2);
    expect(newVersion.payload.version.parent).toBe(1);

    const newChips = await client.waitForType("chips.updated", 60_000);
    expect(
      newChips.payload.chips.find((chip) => chip.kind === "platform")?.value,
    ).toBe("mobile");
    const completed = await client.waitForType("chat.message_completed", 60_000);
    expect(completed.requestId).toBe("chip-1");
  });

  it("answers chips_not_found for a messageId without recorded chips", async () => {
    const { client } = await setup([]);
    client.send({
      type: "chip.update",
      requestId: "chip-bad",
      payload: { messageId: "no-such-message", kind: "system", value: "swiss" },
    });
    const error = await client.waitForType("chat.error");
    expect(error.requestId).toBe("chip-bad");
    expect(error.payload.error.code).toBe("chips_not_found");
  });
});

describe("keyless degradation", () => {
  it("rejects chat.send with auth_missing carrying the fix, pushes auth.status, and leaves HTTP working", async () => {
    const { client } = await setup([], {});

    client.send({
      type: "chat.send",
      requestId: "turn-keyless",
      payload: { text: "a dashboard" },
    });
    const error = await client.waitForType("chat.error");
    expect(error.requestId).toBe("turn-keyless");
    expect(error.payload.error.code).toBe("auth_missing");
    expect(error.payload.error.fix).toContain("ANTHROPIC_API_KEY");

    const pushed = await client.waitFor(
      (event) => event.type === "auth.status" && event.payload.state === "missing",
      "the auth.status push",
    );
    expect(pushed.type).toBe("auth.status");

    // HTTP keeps working keyless.
    const listed = await http(
      (fixture as ApiServerFixture).base,
      "GET",
      "/api/workspaces",
    );
    expect(listed.status).toBe(200);
  });
});
