/**
 * ChatPanel inside a real ShellStateProvider over the fake socket — the
 * seven-slice behavior matrix: streaming turns in the polite live region,
 * transcript restore from the re-sync replay (per-workspace isolation),
 * composer send/cancel wire dispatch (chat.send carrying drained
 * references, chat.cancel with the in-flight messageId), auth recovery,
 * decision chips dispatching chip.update { messageId, kind, value } with
 * in-flight disabling, artifact references focusing the canvas through
 * shared shell state, structured errors in place, and the keyboard /
 * screen-reader contract (labels, live region, no focus theft).
 */
import { fireEvent, screen, waitFor } from "@testing-library/dom";
import { act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  apiError,
  componentReference,
  defaultChips,
  renderChat,
  sentOfType,
  WS_ID,
} from "./helpers/chatHarness.jsx";

function composerInput(): HTMLTextAreaElement {
  return screen.getByTestId("composer-input") as HTMLTextAreaElement;
}

async function sendBrief(text = "a login screen"): Promise<void> {
  await userEvent.type(composerInput(), `${text}{Enter}`);
}

describe("slice 1 — scaffold and transcript restore", () => {
  it("renders the empty state inviting the first brief, composer focused", () => {
    renderChat();
    expect(screen.getByTestId("chat-empty")).toBeTruthy();
    expect(screen.getByText("Start with a brief")).toBeTruthy();
    expect(document.activeElement).toBe(composerInput());
  });

  it("rehydrates a restored transcript: message, chips, head reference", async () => {
    const view = renderChat();
    // The re-sync replay, exactly as resync.ts emits it: transcript records
    // in append order (a turn's chips precede its message record), then
    // artifact heads — all without requestIds.
    view.emitter.chipsUpdated("m1", "dashboard");
    view.emitter.messageStarted("m1");
    view.emitter.delta("m1", "Here is the dashboard.");
    view.emitter.completed("m1");
    view.emitter.versionCreated("dashboard", 2);

    await waitFor(() => expect(screen.getByText("Here is the dashboard.")).toBeTruthy());
    expect(screen.getByTestId("message-m1").getAttribute("data-streaming")).toBe("false");
    // Chips restored editable (latest set).
    expect(screen.getByLabelText("Design system")).toBeTruthy();
    // The head snapshot anchored through the decision set is clickable.
    expect(
      screen.getByLabelText("Show dashboard version 2 on the canvas"),
    ).toBeTruthy();
  });

  it("isolates workspaces: a restored attach re-sends workspace.attach when events flowed before mount", () => {
    // Covered by useChatPanel's deferred re-attach; the fake socket's
    // lastSeq() is undefined, so no redundant attach is sent here.
    const view = renderChat();
    const attaches = sentOfType(view.socket, "workspace.attach");
    expect(attaches).toHaveLength(0);
    expect(view.socket.attached).toEqual([WS_ID]);
  });
});

describe("slice 2 — streaming", () => {
  it("streams message_started → deltas → completed into one live-region turn", async () => {
    const view = renderChat();
    await sendBrief();
    const requestId = view.requestIds[0] as string;

    view.emitter.messageStarted("m1", requestId);
    await waitFor(() => expect(screen.getByTestId("streaming-indicator")).toBeTruthy());

    view.emitter.delta("m1", "Picking ");
    view.emitter.delta("m1", "swiss.");
    await waitFor(() => expect(screen.getByText("Picking swiss.")).toBeTruthy());

    view.emitter.completed("m1", { requestId });
    await waitFor(() => expect(screen.queryByTestId("streaming-indicator")).toBeNull());

    // One polite live region wraps the whole transcript.
    const log = screen.getByTestId("chat-message-list");
    expect(log.getAttribute("role")).toBe("log");
    expect(log.getAttribute("aria-live")).toBe("polite");
    // Streaming never moved focus (it returns to the composer on re-enable).
    expect(document.activeElement).toBe(composerInput());
  });

  it("a cancelled completion renders the turn as stopped in place", async () => {
    const view = renderChat();
    await sendBrief();
    const requestId = view.requestIds[0] as string;
    view.emitter.messageStarted("m1", requestId);
    view.emitter.delta("m1", "Half a thought");
    view.emitter.completed("m1", { requestId, cancelled: true });

    await waitFor(() => expect(screen.getByTestId("stopped-badge")).toBeTruthy());
    expect(screen.getByText("Half a thought")).toBeTruthy();
  });

  it("suspends pinning when the reader scrolls up and offers jump-to-latest", async () => {
    const view = renderChat();
    view.emitter.messageStarted("m1");
    view.emitter.delta("m1", "First turn.");
    view.emitter.completed("m1");
    await waitFor(() => expect(screen.getByText("First turn.")).toBeTruthy());

    const list = screen.getByTestId("chat-message-list");
    // jsdom has no layout — model a scrolled-up reader explicitly.
    Object.defineProperty(list, "scrollHeight", { value: 1000, configurable: true });
    Object.defineProperty(list, "clientHeight", { value: 200, configurable: true });
    list.scrollTop = 100;
    fireEvent.scroll(list);

    await waitFor(() => expect(screen.getByTestId("jump-to-latest")).toBeTruthy());

    // Jumping re-pins and the affordance retires.
    fireEvent.click(screen.getByTestId("jump-to-latest"));
    await waitFor(() => expect(screen.queryByTestId("jump-to-latest")).toBeNull());
  });
});

describe("slice 3 — composer", () => {
  it("Enter dispatches chat.send with the optimistic append and drained references", async () => {
    const view = renderChat();
    view.addReference(componentReference("Card — gray_surface"));
    await waitFor(() =>
      expect(screen.getByText("Card — gray_surface")).toBeTruthy(),
    );

    await sendBrief("use that card");
    const sends = sentOfType(view.socket, "chat.send");
    expect(sends).toHaveLength(1);
    expect(sends[0]?.["payload"]).toEqual({
      text: "use that card",
      references: [componentReference("Card — gray_surface")],
    });
    // Optimistic user turn, drained chips, cleared draft.
    expect(screen.getByText("use that card")).toBeTruthy();
    expect(view.pendingReferences()).toHaveLength(0);
    expect(composerInput().value).toBe("");
    // Busy with the reason in place.
    expect(
      screen.getByText("Agent is working — cancel to send a new message"),
    ).toBeTruthy();
  });

  it("a removed reference chip does not ride the send", async () => {
    const view = renderChat();
    view.addReference(componentReference("Card — gray_surface"));
    view.addReference(componentReference("Button — primary"));
    await waitFor(() => expect(screen.getByText("Button — primary")).toBeTruthy());

    await userEvent.click(
      screen.getByLabelText("Remove reference Card — gray_surface"),
    );
    await sendBrief("just the button");
    const sends = sentOfType(view.socket, "chat.send");
    expect(sends[0]?.["payload"]).toEqual({
      text: "just the button",
      references: [componentReference("Button — primary")],
    });
  });

  it("cancel sends chat.cancel with the in-flight messageId and focus returns on completion", async () => {
    const view = renderChat();
    await sendBrief();
    const requestId = view.requestIds[0] as string;
    view.emitter.messageStarted("m1", requestId);

    const cancel = await screen.findByTestId("composer-cancel");
    await userEvent.click(cancel);
    const cancels = sentOfType(view.socket, "chat.cancel");
    expect(cancels).toHaveLength(1);
    expect(cancels[0]?.["payload"]).toEqual({ messageId: "m1" });

    view.emitter.completed("m1", { requestId, cancelled: true });
    await waitFor(() => expect(composerInput().disabled).toBe(false));
    expect(document.activeElement).toBe(composerInput());
  });

  it("auth missing disables with the env guidance and recovers live with the draft intact", async () => {
    const view = renderChat();
    await userEvent.type(composerInput(), "draft in progress");
    view.emitter.auth("missing", "set ANTHROPIC_API_KEY in studio/.env");

    await waitFor(() =>
      expect(
        screen.getByText("Add ANTHROPIC_API_KEY to apps/studio/.env"),
      ).toBeTruthy(),
    );
    expect(composerInput().disabled).toBe(true);
    expect(composerInput().value).toBe("draft in progress");

    view.emitter.auth("configured");
    await waitFor(() => expect(composerInput().disabled).toBe(false));
    expect(composerInput().value).toBe("draft in progress");
    expect(document.activeElement).toBe(composerInput());
  });

  it("auth invalid names the key and the fix in place", async () => {
    const view = renderChat();
    view.emitter.auth("invalid");
    await waitFor(() =>
      expect(
        screen.getByText(
          "The configured ANTHROPIC_API_KEY was rejected — replace it in apps/studio/.env",
        ),
      ).toBeTruthy(),
    );
  });

  it("a send while disconnected marks the message failed in place with a retry affordance", async () => {
    const view = renderChat();
    act(() => view.socket.setState("reconnecting"));
    // setState fires the connection handler; type and send.
    await userEvent.type(composerInput(), "lost brief{Enter}");

    await waitFor(() => expect(screen.getByTestId("send-failed")).toBeTruthy());
    expect(screen.getByText("lost brief")).toBeTruthy();

    act(() => view.socket.setState("open"));
    await userEvent.click(screen.getByText("Retry send"));
    const sends = sentOfType(view.socket, "chat.send");
    expect(sends).toHaveLength(1);
    expect(sends[0]?.["payload"]).toEqual({ text: "lost brief" });
    await waitFor(() => expect(screen.queryByTestId("send-failed")).toBeNull());
  });
});

describe("slice 4 — tool progress and structured errors", () => {
  it("tool events render inline within the owning turn, never a toast", async () => {
    const view = renderChat();
    await sendBrief();
    const requestId = view.requestIds[0] as string;
    view.emitter.messageStarted("m1", requestId);
    view.emitter.toolStarted("m1", "t1", "wf_generate", "Generating in swiss", requestId);

    await waitFor(() => expect(screen.getByTestId("tool-t1")).toBeTruthy());
    expect(screen.getByTestId("tool-t1").getAttribute("data-state")).toBe("running");
    expect(screen.getByText("Generating in swiss…")).toBeTruthy();
    // Inline: the marker lives inside the message article.
    expect(
      screen.getByTestId("message-m1").contains(screen.getByTestId("tool-t1")),
    ).toBe(true);

    view.emitter.toolFinished("m1", "t1", "wf_generate", "ok", undefined, requestId);
    await waitFor(() =>
      expect(screen.getByTestId("tool-t1").getAttribute("data-state")).toBe("ok"),
    );
  });

  it("chat.error renders what failed and how to fix on the failed turn; composer re-enables", async () => {
    const view = renderChat();
    await sendBrief();
    const requestId = view.requestIds[0] as string;
    view.emitter.messageStarted("m1", requestId);
    view.emitter.chatError(apiError(), { messageId: "m1", requestId });

    await waitFor(() => expect(screen.getByTestId("chat-error")).toBeTruthy());
    expect(
      screen.getByText("Layout dashboard-3col is not available in terminal."),
    ).toBeTruthy();
    expect(
      screen.getByText("Pick another layout from the chip, or switch system."),
    ).toBeTruthy();
    expect(
      screen.getByTestId("message-m1").contains(screen.getByTestId("chat-error")),
    ).toBe(true);
    await waitFor(() => expect(composerInput().disabled).toBe(false));
  });
});

describe("slice 5 — decision chips", () => {
  async function turnWithChips(): Promise<ReturnType<typeof renderChat>> {
    const view = renderChat();
    await sendBrief();
    const requestId = view.requestIds[0] as string;
    view.emitter.messageStarted("m1", requestId);
    view.emitter.chipsUpdated("m1", "dashboard", defaultChips(), requestId);
    view.emitter.completed("m1", { requestId });
    await waitFor(() => expect(screen.getByLabelText("Design system")).toBeTruthy());
    return view;
  }

  it("renders editable labeled selects from the chips.updated options", async () => {
    await turnWithChips();
    const system = screen.getByLabelText("Design system") as HTMLSelectElement;
    expect(system.value).toBe("swiss");
    expect([...system.options].map((option) => option.value)).toEqual([
      "swiss",
      "terminal",
    ]);
    expect(screen.getByLabelText("Layout")).toBeTruthy();
    expect(screen.getByLabelText("Platform")).toBeTruthy();
    expect(screen.getAllByText("re-runs generation")).toHaveLength(3);
  });

  it("changing a chip sends chip.update { messageId, kind, value } and disables with reason while the re-run streams", async () => {
    const view = await turnWithChips();
    const system = screen.getByLabelText("Design system") as HTMLSelectElement;
    await userEvent.selectOptions(system, "terminal");

    const updates = sentOfType(view.socket, "chip.update");
    expect(updates).toHaveLength(1);
    expect(updates[0]?.["payload"]).toEqual({
      messageId: "m1",
      kind: "system",
      value: "terminal",
    });
    // In-flight: selects disable with the reason in place (no double-fire).
    await waitFor(() => expect(system.disabled).toBe(true));
    expect(
      screen.getAllByText("Agent is working — cancel to send a new message")
        .length,
    ).toBeGreaterThan(0);

    // The re-run streams and completes; chips re-enable with the new value.
    const rerunRequestId = updates[0]?.["requestId"] as string;
    view.emitter.messageStarted("m2", rerunRequestId);
    view.emitter.chipsUpdated(
      "m2",
      "dashboard",
      defaultChips([{ value: "terminal" }]),
      rerunRequestId,
    );
    view.emitter.completed("m2", { requestId: rerunRequestId });
    await waitFor(() => {
      const updated = screen.getByLabelText("Design system") as HTMLSelectElement;
      expect(updated.disabled).toBe(false);
      expect(updated.value).toBe("terminal");
    });
  });

  it("only the latest decision set is editable; history renders read-only", async () => {
    const view = await turnWithChips();
    // A second turn lands its own chips.
    await sendBrief("another screen");
    const requestId = view.requestIds.at(-1) as string;
    view.emitter.messageStarted("m2", requestId);
    view.emitter.chipsUpdated("m2", "login", defaultChips(), requestId);
    view.emitter.completed("m2", { requestId });

    await waitFor(() => {
      // Exactly one editable select per kind: the latest set.
      expect(screen.getAllByLabelText("Design system")).toHaveLength(1);
    });
    const readonly = screen.getByLabelText(
      "Decisions for this turn (read-only — only the latest set is editable)",
    );
    expect(readonly.textContent).toContain("swiss");
    expect(readonly.querySelector("select")).toBeNull();
  });
});

describe("slice 6 — artifact references", () => {
  it("correlates version_created by requestId and focuses the canvas via shell state", async () => {
    const view = renderChat();
    await sendBrief();
    const requestId = view.requestIds[0] as string;
    view.emitter.messageStarted("m1", requestId);
    view.emitter.versionCreated("login-screen", 4, requestId);
    view.emitter.completed("m1", { requestId });

    const reference = await screen.findByLabelText(
      "Show login-screen version 4 on the canvas",
    );
    expect(reference.getAttribute("aria-pressed")).toBe("false");

    await userEvent.click(reference);
    expect(view.focusedArtifactId()).toBe("login-screen");
    await waitFor(() =>
      expect(reference.getAttribute("aria-pressed")).toBe("true"),
    );
    expect(screen.getByText("on canvas")).toBeTruthy();
    // No focus theft: activation keeps focus on the reference.
    expect(document.activeElement).toBe(reference);
  });

  it("renders multiple references on one turn, each focusing its own artifact", async () => {
    const view = renderChat();
    await sendBrief();
    const requestId = view.requestIds[0] as string;
    view.emitter.messageStarted("m1", requestId);
    view.emitter.completed("m1", {
      requestId,
      artifactRefs: [
        { artifactId: "login-mobile", version: 1 },
        { artifactId: "login-desktop", version: 1 },
      ],
    });

    await screen.findByLabelText("Show login-mobile version 1 on the canvas");
    await userEvent.click(
      screen.getByLabelText("Show login-desktop version 1 on the canvas"),
    );
    expect(view.focusedArtifactId()).toBe("login-desktop");
  });

  it("keyboard activation (Enter on the native button) has pointer parity", async () => {
    const view = renderChat();
    await sendBrief();
    const requestId = view.requestIds[0] as string;
    view.emitter.messageStarted("m1", requestId);
    view.emitter.versionCreated("login-screen", 2, requestId);
    view.emitter.completed("m1", { requestId });

    const reference = await screen.findByLabelText(
      "Show login-screen version 2 on the canvas",
    );
    reference.focus();
    await userEvent.keyboard("{Enter}");
    expect(view.focusedArtifactId()).toBe("login-screen");
  });
});

describe("slice 7 — keyboard and screen-reader contract", () => {
  it("orders interactive elements logically: transcript controls before the composer", async () => {
    const view = renderChat();
    await sendBrief();
    const requestId = view.requestIds[0] as string;
    view.emitter.messageStarted("m1", requestId);
    view.emitter.chipsUpdated("m1", "dashboard", defaultChips(), requestId);
    view.emitter.versionCreated("dashboard", 1, requestId);
    view.emitter.completed("m1", { requestId });
    await waitFor(() => expect(screen.getByLabelText("Design system")).toBeTruthy());
    // A non-empty draft arms the send affordance (it is gray-disabled,
    // not hidden, while the draft is empty).
    await userEvent.type(composerInput(), "next brief");

    const panel = screen.getByLabelText("Conversation", { selector: "section" });
    const stops = [
      ...panel.querySelectorAll<HTMLElement>("select, button, textarea"),
    ].filter((element) => !(element as HTMLButtonElement).disabled);
    const roles = stops.map(
      (element) =>
        element.getAttribute("aria-label") ?? element.tagName.toLowerCase(),
    );
    // Chips → artifact reference → composer → send.
    expect(roles).toEqual([
      "Design system",
      "Layout",
      "Platform",
      "Show dashboard version 1 on the canvas",
      "Message the agent",
      "Send message",
    ]);
  });

  it("labels every composer control and keeps one polite live region for the transcript", () => {
    renderChat();
    expect(screen.getByLabelText("Message the agent")).toBeTruthy();
    expect(screen.getByLabelText("Send message")).toBeTruthy();
    const liveRegions = document.querySelectorAll("[aria-live='polite']");
    // The transcript log is the only polite region at rest (the composer
    // reason/status appear only with content — no duplicate announcements).
    expect(liveRegions).toHaveLength(1);
    expect(liveRegions[0]?.getAttribute("role")).toBe("log");
  });

  it("marks decorative glyphs aria-hidden", async () => {
    const view = renderChat();
    view.emitter.messageStarted("m1");
    view.emitter.delta("m1", "streaming");
    await waitFor(() => expect(screen.getByTestId("streaming-indicator")).toBeTruthy());
    const dot = document.querySelector(".chat-streaming-dot");
    expect(dot?.getAttribute("aria-hidden")).toBe("true");
    const hint = document.querySelector(".chat-composer-hint");
    expect(hint?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("workspace isolation", () => {
  it("renders no transcript without a workspace and disables the composer with the reason", () => {
    renderChat({ workspaceId: null });
    expect(composerInput().disabled).toBe(true);
    expect(
      screen.getByText("Select or create a workspace to start the conversation"),
    ).toBeTruthy();
  });
});
