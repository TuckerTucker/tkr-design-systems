/**
 * Panel registry units — registration, lookup, duplicate-id fail-fast
 * naming both registrations, id grammar.
 */
import { describe, expect, it } from "vitest";

import { createPanelRegistry } from "../../src/shell/panelRegistry.js";
import { makePanel } from "./helpers/shellHarness.jsx";

describe("createPanelRegistry", () => {
  it("registers and lists panels in registration order", () => {
    const registry = createPanelRegistry();
    registry.register(makePanel("chat", "Chat", "left"));
    registry.register(makePanel("library", "Library", "right"));
    expect(registry.list().map((p) => p.id)).toEqual(["chat", "library"]);
    expect(registry.get("chat")?.title).toBe("Chat");
    expect(registry.get("missing")).toBeUndefined();
  });

  it("fails fast on a duplicate id, naming both registrations", () => {
    const registry = createPanelRegistry();
    registry.register(makePanel("chat", "Chat", "left"));
    expect(() =>
      registry.register(makePanel("chat", "Chat Two", "right")),
    ).toThrowError(/Chat.*Chat Two|already registered/);
  });

  it("rejects non-kebab-case ids", () => {
    const registry = createPanelRegistry();
    expect(() => registry.register(makePanel("Chat!", "Chat", "left"))).toThrow(
      /kebab-case/,
    );
  });
});
