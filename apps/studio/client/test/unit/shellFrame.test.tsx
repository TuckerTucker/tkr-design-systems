/**
 * ShellFrame rendering — center stage always present, rails populated
 * from the registry defaults, lazy panel contents arrive, and a panel
 * render failure is contained in place while the shell keeps working.
 */
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { makePanel, renderShell } from "./helpers/shellHarness.jsx";

describe("ShellFrame", () => {
  it("renders the center stage with both rails flanking it", async () => {
    renderShell();
    expect(screen.getByText("center stage")).toBeTruthy();
    const frame = screen.getByTestId("shell-frame");
    const children = [...frame.children];
    expect(children[0]?.getAttribute("data-rail")).toBe("left");
    expect(children[1]?.getAttribute("aria-label")).toBe("Center stage");
    expect(children[2]?.getAttribute("data-rail")).toBe("right");
    // Lazy placeholder contents mount into their hosts.
    expect(await screen.findByText("Chat content")).toBeTruthy();
    expect(await screen.findByText("Library content")).toBeTruthy();
  });

  it("a registered panel appears at its default placement with no shell changes", async () => {
    const panels = [
      makePanel("chat", "Chat", "left"),
      makePanel("library", "Library", "right", 0),
      makePanel("compliance-detail", "Compliance", "right", 1),
    ];
    renderShell({ panels });
    // Two panels share the right rail → tabs appear automatically.
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Library",
      "Compliance",
    ]);
    expect(await screen.findByText("Library content")).toBeTruthy();
  });

  it("contains a panel render failure in place; the rest keeps working", async () => {
    const Exploding = (): never => {
      throw new Error("placeholder exploded");
    };
    const panels = [
      makePanel("chat", "Chat", "left"),
      makePanel("broken", "Broken", "right", 0, Exploding as never),
    ];
    renderShell({ panels });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("The Broken panel failed to render.");
    expect(alert.textContent).toContain("placeholder exploded");
    // The healthy panel still renders.
    expect(await screen.findByText("Chat content")).toBeTruthy();
    expect(screen.getByText("center stage")).toBeTruthy();
  });

  it("an empty rail collapses to zero width", () => {
    const panels = [
      makePanel("chat", "Chat", "left", 0),
      makePanel("library", "Library", "left", 1),
    ];
    renderShell({ panels });
    const rails = document.querySelectorAll("[data-rail]");
    const right = [...rails].find(
      (rail) => rail.getAttribute("data-rail") === "right",
    );
    expect(right?.className).toContain("rail-empty");
    expect((right as HTMLElement).style.width).toBe("0px");
  });
});
