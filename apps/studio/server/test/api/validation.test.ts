/**
 * Boundary validation matrix — every malformed input is rejected with a
 * structured ApiError (code, message, fix, field) BEFORE any domain code
 * runs (asserted via the scripted runtime's request log), and no error
 * body ever leaks internals.
 */
import { afterEach, describe, expect, it } from "vitest";

import type { ErrorResponse, WorkspaceSummary } from "@studio/contract";

import {
  attachWorkspace,
  connectWs,
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

function expectStructured(body: unknown): ErrorResponse["error"] {
  const error = (body as ErrorResponse).error;
  expect(typeof error.code).toBe("string");
  expect(typeof error.message).toBe("string");
  expect(typeof error.fix).toBe("string");
  const serialized = JSON.stringify(body);
  expect(serialized).not.toContain("node_modules");
  expect(serialized).not.toContain("    at ");
  expect(serialized).not.toMatch(/\/Users\/|\/home\/|\/tmp\//);
  return error;
}

describe("HTTP validation", () => {
  it("rejects a non-string name on workspace create with field-level detail", async () => {
    fixture = await startApiServer();
    const response = await http(fixture.base, "POST", "/api/workspaces", {
      name: 123,
    });
    expect(response.status).toBe(400);
    const error = expectStructured(response.body);
    expect(error.code).toBe("invalid_field");
    expect(error.field).toBe("name");
  });

  it("rejects unknown fields on write payloads", async () => {
    fixture = await startApiServer();
    const created = await http(fixture.base, "POST", "/api/workspaces", {
      name: "Strict",
    });
    const wsId = (created.body as WorkspaceSummary).id;

    const sneaky = await http(fixture.base, "PATCH", `/api/workspaces/${wsId}`, {
      name: "Renamed",
      adminOverride: true,
    });
    expect(sneaky.status).toBe(400);
    expect(expectStructured(sneaky.body).field).toBe("adminOverride");
  });

  it("rejects an empty rename before the store is touched", async () => {
    fixture = await startApiServer();
    const created = await http(fixture.base, "POST", "/api/workspaces", {
      name: "Keep Me",
    });
    const wsId = (created.body as WorkspaceSummary).id;
    const empty = await http(fixture.base, "PATCH", `/api/workspaces/${wsId}`, {
      name: "  ",
    });
    expect(empty.status).toBe(400);
    expect(expectStructured(empty.body).field).toBe("name");

    const read = await http(fixture.base, "GET", `/api/workspaces/${wsId}`);
    expect((read.body as WorkspaceSummary).name).toBe("Keep Me");
  });

  it("rejects traversal-shaped ids by slug validation before any path resolution", async () => {
    fixture = await startApiServer();
    const traversal = await http(
      fixture.base,
      "GET",
      "/api/workspaces/..%2F..%2Fetc%2Fpasswd/artifacts",
    );
    expect(traversal.status).toBe(400);
    const error = expectStructured(traversal.body);
    expect(error.code).toBe("invalid_field");
    expect(error.field).toBe("wsId");
  });

  it("rejects non-integer and zero-padded version params", async () => {
    fixture = await startApiServer();
    const created = await http(fixture.base, "POST", "/api/workspaces", {
      name: "Version Probe",
    });
    const wsId = (created.body as WorkspaceSummary).id;

    for (const bad of ["banana", "0007", "0", "-1", "1.5"]) {
      const response = await http(
        fixture.base,
        "GET",
        `/api/workspaces/${wsId}/artifacts/some-art/versions/${bad}/svg`,
      );
      expect(response.status).toBe(400);
      const error = expectStructured(response.body);
      expect(error.field).toBe("version");
    }
  });

  it("rejects malformed JSON bodies with a structured 400", async () => {
    fixture = await startApiServer();
    const response = await fetch(`${fixture.base}/api/workspaces`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ definitely not json",
    });
    expect(response.status).toBe(400);
    expectStructured(await response.json());
  });

  it("rejects an invalid LayoutPreference with the offending field", async () => {
    fixture = await startApiServer();
    const response = await http(fixture.base, "PUT", "/api/preferences", {
      schemaVersion: 2,
      placements: [],
      activeTab: "x",
      railWidths: { left: 1, right: 1 },
      lastWorkspaceId: null,
    });
    expect(response.status).toBe(400);
    expect(expectStructured(response.body).field).toBe("schemaVersion");
  });
});

describe("WS validation", () => {
  it("answers an unknown message type with chat.error invalid_message, echoes the requestId, and keeps the connection open", async () => {
    fixture = await startApiServer();
    const client = await connectWs(fixture.wsUrl);
    clients.push(client);

    client.send(
      // Deliberately outside the ClientMessage union.
      JSON.parse(
        JSON.stringify({
          type: "chat.fire_missiles",
          requestId: "rogue-1",
          payload: {},
        }),
      ),
    );
    const error = await client.waitForType("chat.error");
    expect(error.requestId).toBe("rogue-1");
    expect(error.payload.error.code).toBe("invalid_message");
    expect(error.payload.error.fix).toContain("workspace.attach");
    expect(client.socket.readyState).toBe(client.socket.OPEN);
  });

  it("answers malformed JSON with chat.error invalid_message", async () => {
    fixture = await startApiServer();
    const client = await connectWs(fixture.wsUrl);
    clients.push(client);

    client.socket.send("this is not json");
    const error = await client.waitForType("chat.error");
    expect(error.payload.error.code).toBe("invalid_message");
  });

  it("rejects chat.send before any attach with not_attached — the agent loop is never invoked", async () => {
    fixture = await startApiServer();
    const client = await connectWs(fixture.wsUrl);
    clients.push(client);

    client.send({
      type: "chat.send",
      requestId: "premature",
      payload: { text: "hello" },
    });
    const error = await client.waitForType("chat.error");
    expect(error.requestId).toBe("premature");
    expect(error.payload.error.code).toBe("not_attached");
    expect(fixture.runtime.requests).toHaveLength(0);
  });

  it("rejects a chip.update with an unknown kind before dispatch", async () => {
    fixture = await startApiServer();
    const created = await http(fixture.base, "POST", "/api/workspaces", {
      name: "Chip Probe",
    });
    const client = await connectWs(fixture.wsUrl);
    clients.push(client);
    await attachWorkspace(client, (created.body as WorkspaceSummary).id);

    client.send(
      JSON.parse(
        JSON.stringify({
          type: "chip.update",
          requestId: "chip-bad",
          payload: { messageId: "m1", kind: "color", value: "red" },
        }),
      ),
    );
    const error = await client.waitForType("chat.error");
    expect(error.requestId).toBe("chip-bad");
    expect(error.payload.error.field).toBe("payload.kind");
    expect(fixture.runtime.requests).toHaveLength(0);
  });

  it("rejects a chat.send with an empty text before the session is touched", async () => {
    fixture = await startApiServer();
    const created = await http(fixture.base, "POST", "/api/workspaces", {
      name: "Empty Text",
    });
    const client = await connectWs(fixture.wsUrl);
    clients.push(client);
    await attachWorkspace(client, (created.body as WorkspaceSummary).id);

    client.send({
      type: "chat.send",
      requestId: "empty-text",
      payload: { text: "   " },
    });
    const error = await client.waitForType("chat.error");
    expect(error.payload.error.field).toBe("payload.text");
    expect(fixture.runtime.requests).toHaveLength(0);
  });
});
