/**
 * TranscriptRepository — append/read ordering, block-scalar readability,
 * concurrency serialization, and degradation against a real temp directory.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { parse } from "yaml";
import { describe, expect, it } from "vitest";

import type { TranscriptRecord } from "@studio/contract";

import { expectFail, expectOk, makeStore } from "./store-helpers.js";

function record(n: number, overrides: Partial<TranscriptRecord> = {}): TranscriptRecord {
  return {
    id: `rec-${String(n).padStart(4, "0")}`,
    kind: "message",
    timestamp: new Date(1760000000000 + n * 1000).toISOString(),
    payload: { role: "user", text: `message ${n}` },
    ...overrides,
  };
}

describe("TranscriptRepository", () => {
  it("reads an empty transcript for a workspace with no transcript.yaml", async () => {
    const { store } = makeStore();
    expectOk(await store.workspaces.create("Checkout Flow"));

    expect(expectOk(await store.transcripts.read("checkout-flow"))).toEqual([]);
  });

  it("returns not_found for missing or traversal workspace ids", async () => {
    const { store } = makeStore();

    expectFail(await store.transcripts.read("nope"), "not_found");
    expectFail(await store.transcripts.read("../escape"), "not_found");
    expectFail(await store.transcripts.append("nope", record(1)), "not_found");
  });

  it("creates transcript.yaml on the first append with exactly that record", async () => {
    const { store, rootDir } = makeStore();
    expectOk(await store.workspaces.create("Checkout Flow"));

    const first = record(1);
    expectOk(await store.transcripts.append("checkout-flow", first));

    const onDisk = parse(
      await readFile(path.join(rootDir, "checkout-flow", "transcript.yaml"), "utf8"),
    ) as { records: unknown[] };
    expect(onDisk.records).toEqual([first]);
    expect(expectOk(await store.transcripts.read("checkout-flow"))).toEqual([first]);
  });

  it("preserves append order across many appends with payloads verbatim", async () => {
    const { store } = makeStore();
    expectOk(await store.workspaces.create("Checkout Flow"));

    const records: TranscriptRecord[] = [
      record(1),
      record(2, { kind: "routing_result", payload: { pattern: "form-flow" } }),
      record(3, { kind: "tool_call", payload: { tool: "wf_generate", status: "finished" } }),
      record(4, { kind: "decision_chips", payload: { chips: [{ kind: "layout", value: "stack" }] } }),
      ...Array.from({ length: 8 }, (_, i) => record(5 + i)),
    ];
    for (const rec of records) {
      expectOk(await store.transcripts.append("checkout-flow", rec));
    }

    expect(expectOk(await store.transcripts.read("checkout-flow"))).toEqual(records);
  });

  it("stores multiline text as readable block scalars and round-trips it byte-equal", async () => {
    const { store, rootDir } = makeStore();
    expectOk(await store.workspaces.create("Checkout Flow"));
    const text = "wireframe a checkout screen\nwith a sticky summary rail\nand a promo field";

    expectOk(
      await store.transcripts.append(
        "checkout-flow",
        record(1, { payload: { role: "user", text } }),
      ),
    );

    const raw = await readFile(
      path.join(rootDir, "checkout-flow", "transcript.yaml"),
      "utf8",
    );
    expect(raw).toContain("|"); // block scalar — human-readable on disk
    expect(raw).toContain("with a sticky summary rail");
    const read = expectOk(await store.transcripts.read("checkout-flow"));
    expect((read[0]?.payload as { text: string }).text).toBe(text);
  });

  it("serializes concurrent appends — both records persist, never interleaved", async () => {
    const { store } = makeStore();
    expectOk(await store.workspaces.create("Checkout Flow"));

    const records = Array.from({ length: 20 }, (_, i) => record(i + 1));
    const results = await Promise.all(
      records.map((rec) => store.transcripts.append("checkout-flow", rec)),
    );
    for (const result of results) {
      expectOk(result);
    }

    const read = expectOk(await store.transcripts.read("checkout-flow"));
    expect(read).toHaveLength(20);
    expect(new Set(read.map((rec) => rec.id)).size).toBe(20);
  });

  it("a corrupt transcript degrades only the transcript; metadata and artifacts stay readable", async () => {
    const { store, rootDir } = makeStore();
    expectOk(await store.workspaces.create("Checkout Flow"));
    expectOk(
      await store.artifacts.create("checkout-flow", {
        name: "Checkout",
        system: "swiss",
        platform: "mobile",
      }),
    );
    const file = path.join(rootDir, "checkout-flow", "transcript.yaml");
    await writeFile(file, "records: [ { broken\n");

    const readError = expectFail(await store.transcripts.read("checkout-flow"), "corrupt");
    expect(readError.path).toBe(path.join("checkout-flow", "transcript.yaml"));
    // Append refuses to clobber the damaged file.
    expectFail(await store.transcripts.append("checkout-flow", record(9)), "corrupt");
    expect(await readFile(file, "utf8")).toBe("records: [ { broken\n");

    // The damage is contained: workspace and artifacts read normally.
    expectOk(await store.workspaces.get("checkout-flow"));
    expect(expectOk(await store.artifacts.list("checkout-flow"))).toHaveLength(1);
  });

  it("a malformed record envelope degrades as corrupt naming the record", async () => {
    const { store, rootDir } = makeStore();
    expectOk(await store.workspaces.create("Checkout Flow"));
    await writeFile(
      path.join(rootDir, "checkout-flow", "transcript.yaml"),
      "records:\n  - id: ok-1\n    kind: not-a-kind\n    timestamp: t\n    payload: {}\n",
    );

    const error = expectFail(await store.transcripts.read("checkout-flow"), "corrupt");
    expect(error.message).toContain("record 0");
  });
});
