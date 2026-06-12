/**
 * AuthSetupNotice — the prominent keyless / rejected-key setup state in
 * the chat panel: visible with concrete fix steps while auth is missing
 * or invalid, absent when configured, and clearing live (no dismissal,
 * no toast) the moment auth.status recovers.
 */
import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { renderChat } from "./helpers/chatHarness.js";

function notice(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".chat-auth-notice");
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("auth setup notice", () => {
  it("renders setup steps in place while the key is missing", async () => {
    const view = renderChat();
    view.emitter.auth("missing");

    await waitFor(() =>
      expect(
        screen.getByText("Add your Anthropic API key to enable chat"),
      ).toBeTruthy(),
    );
    expect(notice()?.getAttribute("role")).toBe("status");
    expect(
      screen.getByText("cp apps/studio/.env.example apps/studio/.env"),
    ).toBeTruthy();
    expect(screen.getByText("console.anthropic.com")).toBeTruthy();
    expect(screen.getByText("Restart the studio server")).toBeTruthy();
    expect(
      screen.getByText(/Everything else keeps working without a key/),
    ).toBeTruthy();
  });

  it("renders the rejected-key variant when auth is invalid", async () => {
    const view = renderChat();
    view.emitter.auth("invalid");

    await waitFor(() =>
      expect(
        screen.getByText("Your Anthropic API key was rejected"),
      ).toBeTruthy(),
    );
    expect(screen.getByText(/replace the key/)).toBeTruthy();
  });

  it("is absent when configured and clears live on recovery", async () => {
    const view = renderChat();
    view.emitter.auth("configured");
    await waitFor(() => expect(notice()).toBeNull());

    view.emitter.auth("missing");
    await waitFor(() => expect(notice()).not.toBeNull());

    view.emitter.auth("configured");
    await waitFor(() => expect(notice()).toBeNull());
  });
});
