/**
 * Slice 1 — panel scaffold and system switcher: systems list with status
 * badges, active-system scoping, silent last-viewed persistence, the
 * per-system cache (instant switch-back, zero refetch), bridge-down
 * staleness indicated in place with automatic recovery, and inline
 * loading/error states. No toasts anywhere.
 */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { TokenSetResponse } from "@studio/contract";

import {
  clearLibraryStorage,
  createFakeLibraryApi,
  renderLibrary,
} from "./helpers/libraryHarness.jsx";
import { swissComponents, swissLayouts, swissTokens } from "./helpers/fixtures.js";

beforeEach(() => {
  clearLibraryStorage();
});

function terminalTokens(): TokenSetResponse {
  const base = swissTokens();
  return { ...base, systemId: "terminal" };
}

function seedTerminal(api = createFakeLibraryApi()): typeof api {
  api.tokens.set("terminal", terminalTokens());
  api.components.set("terminal", swissComponents());
  api.layouts.set("terminal", swissLayouts());
  for (const entry of swissComponents()) {
    const detail = api.details.get(`swiss:${entry.id}`);
    if (detail !== undefined) {
      api.details.set(`terminal:${entry.id}`, detail);
    }
  }
  return api;
}

describe("system switcher", () => {
  it("lists every system with name, tagline, and a draft badge", async () => {
    renderLibrary();
    const swiss = await screen.findByRole("radio", { name: /Swiss/ });
    expect((swiss).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("Grid + Grotesk + Single Saturated Accent")).not.toBeNull();
    const draft = screen.getByRole("radio", { name: /broken-system/ });
    expect(draft.textContent).toContain("draft");
  });

  it("defaults to the first system and scopes the panel to it", async () => {
    const view = renderLibrary();
    await screen.findByLabelText("Swiss library");
    expect(view.libraryApi.calls.getTokens).toEqual(["swiss"]);
    expect(view.libraryApi.calls.getComponents).toEqual(["swiss"]);
    expect(view.libraryApi.calls.getLayouts).toEqual(["swiss"]);
  });

  it("rescopes every section when the designer selects another system", async () => {
    const view = renderLibrary({ libraryApi: seedTerminal() });
    await screen.findByLabelText("Swiss library");
    fireEvent.click(screen.getByRole("radio", { name: /Terminal/ }));
    await screen.findByLabelText("Terminal library");
    expect(screen.queryByLabelText("Swiss library")).toBeNull();
    expect(view.libraryApi.calls.getTokens).toEqual(["swiss", "terminal"]);
  });

  it("serves switch-back from the per-system cache with no refetch", async () => {
    const view = renderLibrary({ libraryApi: seedTerminal() });
    await screen.findByLabelText("Swiss library");
    fireEvent.click(screen.getByRole("radio", { name: /Terminal/ }));
    await screen.findByLabelText("Terminal library");
    fireEvent.click(screen.getByRole("radio", { name: /Swiss/ }));
    await screen.findByLabelText("Swiss library");
    // One tokens fetch per system — never a third on switch-back.
    expect(view.libraryApi.calls.getTokens).toEqual(["swiss", "terminal"]);
    expect(view.libraryApi.calls.getComponents).toEqual(["swiss", "terminal"]);
  });

  it("operates by keyboard with radio-group arrow semantics", async () => {
    renderLibrary({ libraryApi: seedTerminal() });
    const swiss = await screen.findByRole("radio", { name: /Swiss/ });
    swiss.focus();
    fireEvent.keyDown(swiss, { key: "ArrowDown" });
    await screen.findByLabelText("Terminal library");
    expect(
      screen.getByRole("radio", { name: /Terminal/ }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("persists the active system silently and restores it next mount", async () => {
    const first = renderLibrary({ libraryApi: seedTerminal() });
    await screen.findByLabelText("Swiss library");
    fireEvent.click(screen.getByRole("radio", { name: /Terminal/ }));
    await screen.findByLabelText("Terminal library");
    first.unmount();

    renderLibrary({ libraryApi: seedTerminal() });
    await screen.findByLabelText("Terminal library");
    expect(
      screen.getByRole("radio", { name: /Terminal/ }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("falls back to the first system when the remembered one is gone", async () => {
    globalThis.localStorage.setItem(
      "studio.library.activeSystem",
      "deleted-system",
    );
    renderLibrary();
    await screen.findByLabelText("Swiss library");
  });

  it("shows the inline empty state when zero systems are registered", async () => {
    const api = createFakeLibraryApi();
    api.systems = [];
    renderLibrary({ libraryApi: api });
    expect(
      await screen.findByText(/No design systems are registered/),
    ).not.toBeNull();
  });
});

describe("inline loading and error states", () => {
  it("renders the systems failure inline with what failed and how to fix", async () => {
    const api = createFakeLibraryApi();
    api.failSystems = {
      code: "internal_error",
      message: "The studio server could not be reached: ECONNREFUSED",
      fix: "Check that studio-server is running, then retry.",
    };
    renderLibrary({ libraryApi: api });
    expect(
      await screen.findByText(/could not be reached/),
    ).not.toBeNull();
    expect(screen.getByText(/Check that studio-server/)).not.toBeNull();
  });

  it("retries from the inline affordance and recovers", async () => {
    const api = createFakeLibraryApi();
    api.failSystems = {
      code: "internal_error",
      message: "The studio server could not be reached: boom",
      fix: "Retry.",
    };
    renderLibrary({ libraryApi: api });
    await screen.findByText(/could not be reached/);
    api.failSystems = null;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByRole("radio", { name: /Swiss/ });
  });
});

describe("bridge outage (story: designer-browses-with-bridge-down)", () => {
  it("keeps cached sections browsable with staleness indicated in place", async () => {
    const view = renderLibrary();
    await screen.findByLabelText("Swiss library");
    await screen.findByText("ink");

    view.emitBridge("failed");
    const notes = await screen.findAllByText(/bridge offline/);
    expect(notes.length).toBeGreaterThan(0);
    // Cached data is still fully browsable.
    expect(screen.getByText("ink")).not.toBeNull();
    expect(screen.getByText("#E3000B")).not.toBeNull();
  });

  it("refetches automatically on recovery and clears the indicators", async () => {
    const view = renderLibrary();
    await screen.findByLabelText("Swiss library");
    await screen.findByText("ink");
    const tokenFetches = view.libraryApi.calls.getTokens.length;

    view.emitBridge("restarting");
    await screen.findAllByText(/bridge offline/);

    view.emitBridge("up");
    await waitFor(() =>
      expect(screen.queryAllByText(/bridge offline/)).toHaveLength(0),
    );
    expect(view.libraryApi.calls.getTokens.length).toBeGreaterThan(
      tokenFetches,
    );
    expect(screen.getByText("ink")).not.toBeNull();
  });
});
