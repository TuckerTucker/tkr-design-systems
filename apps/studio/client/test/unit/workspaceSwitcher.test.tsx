/**
 * Workspace switcher + shell state — list/select/create with URL sync,
 * unknown-id handling in place, list failure with inline retry, and the
 * lastWorkspaceId persistence callback.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import type { ReactElement } from "react";

import { ShellStateProvider } from "../../src/app/shellState.jsx";
import { createWorkspaceHistory } from "../../src/routing/workspaceRoutes.js";
import { WorkspaceSwitcher } from "../../src/routing/WorkspaceSwitcher.jsx";
import {
  createFakeApi,
  createFakeSocket,
  workspaceSummary,
  type FakeApi,
  type FakeStudioSocket,
} from "./helpers/fakes.js";

interface Harness {
  socket: FakeStudioSocket;
  api: FakeApi;
  workspaceChanges: string[];
}

function renderSwitcher(options: {
  api?: FakeApi;
  initialWorkspaceId?: string | null;
  initialFromPreferences?: boolean;
} = {}): Harness {
  const socket = createFakeSocket();
  const api =
    options.api ??
    createFakeApi({
      workspaces: [
        workspaceSummary("checkout-flow", "Checkout Flow"),
        workspaceSummary("onboarding", "Onboarding"),
      ],
    });
  const workspaceChanges: string[] = [];
  const history = createWorkspaceHistory();

  function Tree(): ReactElement {
    return (
      <ShellStateProvider
        socket={socket}
        api={api}
        history={history}
        initialWorkspaceId={options.initialWorkspaceId ?? "checkout-flow"}
        initialFromPreferences={options.initialFromPreferences ?? false}
        onWorkspaceChange={(id) => workspaceChanges.push(id)}
      >
        <WorkspaceSwitcher />
      </ShellStateProvider>
    );
  }
  render(<Tree />);
  return { socket, api, workspaceChanges };
}

describe("WorkspaceSwitcher", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("attaches the initial workspace and shows it active", async () => {
    const { socket } = renderSwitcher();
    expect(socket.attached).toEqual(["checkout-flow"]);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /workspace: checkout flow/i }),
      ).toBeTruthy();
    });
  });

  it("switching updates the URL and re-attaches; lastWorkspaceId persists", async () => {
    const { socket, workspaceChanges } = renderSwitcher();
    await userEvent.click(
      await screen.findByRole("button", { name: /workspace: checkout flow/i }),
    );
    await userEvent.click(await screen.findByRole("option", { name: "Onboarding" }));
    expect(window.location.pathname).toBe("/w/onboarding");
    await waitFor(() => expect(socket.attached).toContain("onboarding"));
    expect(workspaceChanges).toEqual(["onboarding"]);
  });

  it("creating a workspace selects it (server auto-names)", async () => {
    const { socket } = renderSwitcher();
    await userEvent.click(
      await screen.findByRole("button", { name: /workspace: checkout flow/i }),
    );
    await userEvent.click(screen.getByRole("button", { name: "New workspace" }));
    await waitFor(() =>
      expect(socket.attached).toContain("untitled-workspace-3"),
    );
    expect(window.location.pathname).toBe("/w/untitled-workspace-3");
  });

  it("an unknown workspace id opens the switcher in place, naming it", async () => {
    renderSwitcher({ initialWorkspaceId: "does-not-exist" });
    const note = await screen.findByRole("status");
    expect(note.textContent).toContain("does-not-exist");
    expect(note.textContent).toContain("not found");
    // The available workspaces are listed as the way out.
    expect(screen.getByRole("option", { name: "Checkout Flow" })).toBeTruthy();
  });

  it("a failed list shows the error and a retry affordance in place", async () => {
    const api = createFakeApi({
      workspaces: [workspaceSummary("checkout-flow", "Checkout Flow")],
      listError: {
        code: "internal_error",
        message: "The studio server could not be reached.",
        fix: "Check that studio-server is running.",
      },
    });
    renderSwitcher({ api });
    await userEvent.click(screen.getByRole("button", { name: /workspace/i }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("could not be reached");

    api.setListError(null);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(
      await screen.findByRole("option", { name: "Checkout Flow" }),
    ).toBeTruthy();
  });

  it("back/forward traverse workspace history in lockstep with the URL", async () => {
    const { socket } = renderSwitcher({ initialFromPreferences: true });
    // Initial last-workspace restore reflects in the URL (replace).
    await waitFor(() =>
      expect(window.location.pathname).toBe("/w/checkout-flow"),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /workspace: checkout flow/i }),
    );
    await userEvent.click(await screen.findByRole("option", { name: "Onboarding" }));
    expect(window.location.pathname).toBe("/w/onboarding");

    // jsdom fires popstate asynchronously on traversal.
    window.history.back();
    await waitFor(() => {
      expect(window.location.pathname).toBe("/w/checkout-flow");
      expect(socket.attached.at(-1)).toBe("checkout-flow");
    });
  });
});
