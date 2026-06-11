/**
 * Docking operations — tabs (click + keyboard), collapse/restore with
 * focus management, the settings-menu move fallback (disable-with-reason),
 * keyboard panel movement, and the no-remount guarantee (panel-internal
 * state survives docking operations).
 */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { createDockReducer, defaultDockState } from "../../src/shell/dockReducer.js";
import { makeTestPanels, renderShell } from "./helpers/shellHarness.jsx";

function stackedOnLeft() {
  const panels = makeTestPanels();
  const reduce = createDockReducer(panels);
  const initialState = reduce(defaultDockState(panels), {
    type: "move",
    panelId: "library",
    rail: "left",
    order: 1,
  });
  return { panels, initialState };
}

describe("tab strip", () => {
  it("shows tabs only when 2+ panels share a rail, one visible at a time", async () => {
    const { panels, initialState } = stackedOnLeft();
    renderShell({ panels, initialState });
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);

    // library is active (it moved); chat host is hidden.
    const chatHost = document.querySelector('[data-panel-id="chat"]');
    const libraryHost = document.querySelector('[data-panel-id="library"]');
    expect((chatHost as HTMLElement).hidden).toBe(true);
    expect((libraryHost as HTMLElement).hidden).toBe(false);

    await userEvent.click(screen.getByRole("tab", { name: /chat/i }));
    expect((chatHost as HTMLElement).hidden).toBe(false);
    expect((libraryHost as HTMLElement).hidden).toBe(true);
  });

  it("activates tabs with arrow keys (automatic activation, roving focus)", async () => {
    const { panels, initialState } = stackedOnLeft();
    renderShell({ panels, initialState });
    const libraryTab = screen.getByRole("tab", { name: /library/i });
    libraryTab.focus();
    fireEvent.keyDown(libraryTab, { key: "ArrowLeft" });
    await waitFor(() => {
      expect(
        screen.getByRole("tab", { name: /chat/i }).getAttribute("aria-selected"),
      ).toBe("true");
    });
    expect(document.activeElement?.id).toBe("tab-left-chat");
  });

  it("renders no tab strip for a rail hosting exactly one panel", () => {
    renderShell();
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
  });
});

describe("collapse and restore", () => {
  it("collapses to the icon strip, focuses the entry, and restores with focus inside", async () => {
    renderShell();
    await screen.findByText("Chat content");

    fireEvent.click(
      screen.getByRole("button", { name: "Collapse Chat panel" }),
    );
    const restoreButton = await screen.findByRole("button", {
      name: "Restore Chat panel",
    });
    // Focus moved to the icon strip entry.
    expect(document.activeElement).toBe(restoreButton);
    // The collapsed panel's host left the rail (icon strip only).
    expect(document.querySelector('[data-panel-id="chat"]')).toBeNull();

    fireEvent.click(restoreButton);
    await waitFor(() => {
      const chatHost = document.querySelector('[data-panel-id="chat"]');
      expect(chatHost).not.toBeNull();
      expect((chatHost as HTMLElement).hidden).toBe(false);
    });
    // Focus returned into the restored panel content.
    expect(document.activeElement?.id).toBe("panel-content-chat");
  });

  it("collapsing the active tab promotes the next panel in stack order", () => {
    const { panels, initialState } = stackedOnLeft();
    renderShell({ panels, initialState });
    // library is active; collapse it via its header (activate chat first
    // is NOT needed — collapse acts on the named panel).
    fireEvent.click(
      screen.getByRole("button", { name: "Collapse Library panel" }),
    );
    const chatHost = document.querySelector('[data-panel-id="chat"]');
    expect((chatHost as HTMLElement).hidden).toBe(false);
    // Single expanded panel left → tab strip disappears.
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
  });

  it("all panels collapsed leaves only icon strips", () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Collapse Chat panel" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Collapse Library panel" }),
    );
    expect(
      screen.getByRole("button", { name: "Restore Chat panel" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Restore Library panel" }),
    ).toBeTruthy();
    expect(document.querySelectorAll(".rail-body")).toHaveLength(0);
  });
});

describe("settings menu fallback", () => {
  it("moves the panel to the other rail, identically to drag", async () => {
    const { changes } = renderShell();
    await userEvent.click(
      screen.getByRole("button", { name: "Chat panel settings" }),
    );
    await userEvent.click(
      screen.getByRole("menuitem", { name: /move to right rail/i }),
    );
    // Chat joined library on the right → tabs on the right rail.
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    const lastChange = changes.at(-1);
    expect(
      lastChange?.placements.find((p) => p.panelId === "chat")?.rail,
    ).toBe("right");
    // Focus followed the moved panel.
    expect(document.activeElement?.id).toBe("panel-header-chat");
  });

  it("disables the current rail's move with the reason shown", async () => {
    const { changes } = renderShell();
    await userEvent.click(
      screen.getByRole("button", { name: "Chat panel settings" }),
    );
    const item = screen.getByRole("menuitem", { name: /move to left rail/i });
    expect(item.getAttribute("aria-disabled")).toBe("true");
    expect(item.textContent).toContain("Already on the left rail");
    await userEvent.click(item);
    expect(changes).toHaveLength(0);
  });

  it("shows the layout sync status inline in the menu", async () => {
    renderShell();
    await userEvent.click(
      screen.getByRole("button", { name: "Chat panel settings" }),
    );
    expect(screen.getByRole("status").textContent).toContain("Layout saved");
  });

  it("menu is keyboard operable: arrows cycle, Escape closes back to the button", async () => {
    renderShell();
    const button = screen.getByRole("button", { name: "Chat panel settings" });
    await userEvent.click(button);
    const first = screen.getByRole("menuitem", { name: /move to left rail/i });
    await waitFor(() => expect(document.activeElement).toBe(first));
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(document.activeElement?.textContent).toContain("Move to right rail");
    fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
    await waitFor(() => expect(document.activeElement).toBe(button));
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("keyboard panel movement", () => {
  it("Alt+ArrowRight moves the focused panel to the right rail, focus follows", () => {
    const { changes } = renderShell();
    const header = document.getElementById("panel-header-chat") as HTMLElement;
    header.focus();
    fireEvent.keyDown(header, { key: "ArrowRight", altKey: true });
    expect(
      changes.at(-1)?.placements.find((p) => p.panelId === "chat")?.rail,
    ).toBe("right");
    expect(document.activeElement?.id).toBe("panel-header-chat");
  });

  it("Alt+ArrowDown reorders within the rail", () => {
    const { panels, initialState } = stackedOnLeft();
    const { changes } = renderShell({ panels, initialState });
    // chat is order 0; move it below library.
    const header = document.getElementById("panel-header-chat") as HTMLElement;
    header.focus();
    fireEvent.keyDown(header, { key: "ArrowDown", altKey: true });
    const left = changes
      .at(-1)!
      .placements.filter((p) => p.rail === "left")
      .sort((a, b) => a.order - b.order)
      .map((p) => p.panelId);
    expect(left).toEqual(["library", "chat"]);
  });

  it("F6 cycles focus across visible panel headers", () => {
    renderShell();
    const chatHeader = document.getElementById("panel-header-chat") as HTMLElement;
    chatHeader.focus();
    fireEvent.keyDown(chatHeader, { key: "F6" });
    expect(document.activeElement?.id).toBe("panel-header-library");
  });
});

describe("no-remount guarantee", () => {
  it("panel-internal state survives a move to the other rail", async () => {
    renderShell();
    const counter = await screen.findByRole("button", {
      name: /chat count: 0/i,
    });
    await userEvent.click(counter);
    await userEvent.click(counter);
    expect(counter.textContent).toContain("Chat count: 2");

    const header = document.getElementById("panel-header-chat") as HTMLElement;
    header.focus();
    fireEvent.keyDown(header, { key: "ArrowRight", altKey: true });

    // Same DOM node, same React state — not remounted.
    expect(
      screen.getByRole("button", { name: /chat count: 2/i }),
    ).toBeTruthy();
  });

  it("panel-internal state survives collapse and restore", async () => {
    renderShell();
    const counter = await screen.findByRole("button", {
      name: /library count: 0/i,
    });
    await userEvent.click(counter);
    fireEvent.click(
      screen.getByRole("button", { name: "Collapse Library panel" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Restore Library panel" }));
    expect(
      screen.getByRole("button", { name: /library count: 1/i }),
    ).toBeTruthy();
  });
});
