/**
 * App composition — hydrate-before-first-paint (no default-then-stored
 * flash), silent persistence on arrangement changes (no save affordance
 * anywhere), cleaned-layout write-back after dropped placements, late
 * hydration after a failed boot GET, and the inline connection state.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { LayoutPreference } from "@studio/contract";

import { App, resolveBootLayout } from "../../src/app/App.jsx";
import { createLayoutPersistence } from "../../src/preferences/layoutPersistence.js";
import { createWorkspaceHistory } from "../../src/routing/workspaceRoutes.js";
import {
  createFakeApi,
  createFakeSocket,
  workspaceSummary,
  type FakeApi,
} from "./helpers/fakes.js";
import { makeTestPanels } from "./helpers/shellHarness.jsx";

function storedLayout(): LayoutPreference {
  return {
    schemaVersion: 1,
    placements: [
      { panelId: "library", zone: "left", order: 0, collapsed: false, active: true },
      { panelId: "chat", zone: "left", order: 1, collapsed: false },
      { panelId: "retired-panel", zone: "right", order: 0 },
    ],
    activeTab: "library",
    railWidths: { left: 400, right: 360 },
    lastWorkspaceId: "checkout-flow",
  };
}

function renderApp(options: {
  api?: FakeApi;
  stored?: LayoutPreference | null;
  failed?: boolean;
  initialWorkspaceId?: string | null;
} = {}) {
  const panels = makeTestPanels();
  const api =
    options.api ??
    createFakeApi({
      workspaces: [workspaceSummary("checkout-flow", "Checkout Flow")],
    });
  const socket = createFakeSocket();
  const persistence = createLayoutPersistence({ api, debounceMs: 20 });
  const { layout, failed } = resolveBootLayout(
    options.failed !== true,
    options.stored ?? null,
    panels,
  );
  window.history.replaceState({}, "", "/");
  render(
    <App
      panels={panels}
      api={api}
      socket={socket}
      history={createWorkspaceHistory()}
      persistence={persistence}
      initialLayout={layout}
      initialLoadFailed={failed}
      initialWorkspaceId={options.initialWorkspaceId ?? "checkout-flow"}
      initialFromPreferences
      layoutRetryMs={30}
    />,
  );
  return { api, socket, persistence, panels };
}

describe("App", () => {
  it("renders the stored arrangement on first paint — no defaults flash", () => {
    renderApp({ stored: storedLayout() });
    // Stored layout stacks both panels on the left → tabs immediately,
    // synchronously, before any async settling.
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    const rightRail = document.querySelector('[data-rail="right"]');
    expect(rightRail?.className).toContain("rail-empty");
  });

  it("writes the cleaned layout back when a stored placement was dropped", async () => {
    const { api } = renderApp({ stored: storedLayout() });
    await waitFor(() => expect(api.putCalls.length).toBeGreaterThan(0));
    const cleaned = api.putCalls.at(-1)!;
    expect(
      cleaned.placements.some((p) => p.panelId === "retired-panel"),
    ).toBe(false);
  });

  it("persists arrangement changes silently — no save affordance exists", async () => {
    const { api } = renderApp();
    expect(screen.queryByText(/save/i)).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Collapse Chat panel" }),
    );
    await waitFor(() => expect(api.putCalls.length).toBeGreaterThan(0));
    const last = api.putCalls.at(-1)!;
    expect(
      last.placements.find((p) => p.panelId === "chat")?.collapsed,
    ).toBe(true);
    expect(last.lastWorkspaceId).toBe("checkout-flow");
    // Still no save affordance after the change.
    expect(screen.queryByText(/save/i)).toBeNull();
  });

  it("late hydration after a failed boot GET applies the stored layout (user idle)", async () => {
    const api = createFakeApi({
      workspaces: [workspaceSummary("checkout-flow", "Checkout Flow")],
      preference: storedLayout(),
    });
    renderApp({ api, failed: true });
    // Defaults render now: chat left, library right → no tabs.
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    // Background retry hydrates the stored stacked layout.
    await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(2), {
      timeout: 2_000,
    });
  });

  it("shows connection state inline in the chrome — never a toast", async () => {
    const { socket } = renderApp();
    const status = screen
      .getAllByRole("status")
      .find((el) => el.className.includes("connection-status"));
    expect(status?.textContent).toContain("Connected");
    act(() => socket.setState("reconnecting"));
    await waitFor(() =>
      expect(status?.textContent).toContain("reconnecting"),
    );
    act(() => socket.setState("offline"));
    await waitFor(() =>
      expect(status?.textContent).toContain("retrying in the background"),
    );
  });

  it("attaches the initial workspace through the socket", () => {
    const { socket } = renderApp();
    expect(socket.attached).toEqual(["checkout-flow"]);
  });
});
