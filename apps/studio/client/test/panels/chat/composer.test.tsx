/**
 * Composer — keyboard mechanics (Enter sends, Shift+Enter inserts a
 * newline, whitespace-only drafts never send), disabled-with-reason
 * rendered adjacent to the input (described-by wiring), the cancel control
 * replacing send during a turn, focus returning on re-enable, the
 * reference chips (render, remove, drop intake via the library MIME), and
 * draft preservation across disabled transitions.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import type { LibraryReference } from "@studio/contract";

import {
  Composer,
  type ComposerDisabledReason,
  type ComposerProps,
} from "../../../src/panels/chat/Composer.jsx";
import { LIBRARY_REFERENCE_MIME } from "../../../src/panels/library/reference/referencePayload.js";
import { createFakeDataTransfer } from "../library/helpers/libraryHarness.jsx";
import { componentReference } from "./helpers/chatHarness.jsx";

function baseProps(overrides: Partial<ComposerProps> = {}): ComposerProps {
  return {
    draft: "",
    onDraftChange: () => undefined,
    references: [],
    onReferenceAdd: () => undefined,
    onReferenceRemove: () => undefined,
    disabled: null,
    cancelAvailable: false,
    inlineNote: null,
    onSend: () => undefined,
    onCancel: () => undefined,
    ...overrides,
  };
}

/** Stateful wrapper so typing flows draft → value like the panel does. */
function StatefulComposer(
  props: Partial<ComposerProps> & { initialDraft?: string },
): ReactElement {
  const [draft, setDraft] = useState(props.initialDraft ?? "");
  return (
    <Composer
      {...baseProps(props)}
      draft={draft}
      onDraftChange={setDraft}
    />
  );
}

function input(): HTMLTextAreaElement {
  return screen.getByTestId("composer-input") as HTMLTextAreaElement;
}

describe("keyboard mechanics", () => {
  it("Enter sends the draft", async () => {
    const onSend = vi.fn();
    render(<StatefulComposer onSend={onSend} />);
    await userEvent.type(input(), "a login screen{Enter}");
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith("a login screen");
  });

  it("Shift+Enter inserts a newline and never sends", async () => {
    const onSend = vi.fn();
    render(<StatefulComposer onSend={onSend} />);
    await userEvent.type(input(), "line one{Shift>}{Enter}{/Shift}line two");
    expect(onSend).not.toHaveBeenCalled();
    expect(input().value).toBe("line one\nline two");
  });

  it("a whitespace-only draft does not send and the affordance is disabled", async () => {
    const onSend = vi.fn();
    render(<StatefulComposer onSend={onSend} />);
    await userEvent.type(input(), "   {Enter}");
    expect(onSend).not.toHaveBeenCalled();
    expect(
      (screen.getByTestId("composer-send") as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

describe("disabled-with-reason", () => {
  const busy: ComposerDisabledReason = {
    kind: "agent_busy",
    message: "Agent is working — cancel to send a new message",
  };

  it("renders the reason adjacent to the input and wires aria-describedby", () => {
    render(<StatefulComposer disabled={busy} initialDraft="kept" />);
    const reason = document.getElementById("chat-composer-reason");
    expect(reason?.textContent).toBe(
      "Agent is working — cancel to send a new message",
    );
    expect(reason?.getAttribute("data-kind")).toBe("agent_busy");
    expect(input().getAttribute("aria-describedby")).toBe(
      "chat-composer-reason",
    );
    expect(input().disabled).toBe(true);
    // The draft survives the disabled transition.
    expect(input().value).toBe("kept");
  });

  it("auth_missing renders the env guidance in place — no toast", () => {
    render(
      <StatefulComposer
        disabled={{
          kind: "auth_missing",
          message: "Add ANTHROPIC_API_KEY to apps/studio/.env",
        }}
      />,
    );
    expect(
      screen.getByText("Add ANTHROPIC_API_KEY to apps/studio/.env"),
    ).toBeTruthy();
  });

  it("focus returns to the textarea when the composer re-enables", () => {
    const { rerender } = render(
      <Composer {...baseProps({ disabled: busy, draft: "draft" })} />,
    );
    expect(document.activeElement).not.toBe(input());
    rerender(<Composer {...baseProps({ disabled: null, draft: "draft" })} />);
    expect(document.activeElement).toBe(input());
  });

  it("focuses the composer on mount when enabled (zero clicks before typing)", () => {
    render(<StatefulComposer />);
    expect(document.activeElement).toBe(input());
  });

  it("never steals focus while mounted disabled", () => {
    render(<StatefulComposer disabled={busy} />);
    expect(document.activeElement).not.toBe(input());
  });
});

describe("cancel control", () => {
  it("replaces send during a turn and dispatches onCancel", async () => {
    const onCancel = vi.fn();
    render(
      <StatefulComposer
        cancelAvailable={true}
        disabled={{ kind: "agent_busy", message: "busy" }}
        onCancel={onCancel}
      />,
    );
    expect(screen.queryByTestId("composer-send")).toBeNull();
    const cancel = screen.getByTestId("composer-cancel");
    expect(cancel.getAttribute("aria-label")).toBe(
      "Stop the current generation",
    );
    await userEvent.click(cancel);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe("library reference chips", () => {
  it("renders pending references as removable chips", async () => {
    const onRemove = vi.fn();
    const references: LibraryReference[] = [
      componentReference("Card — gray_surface"),
      componentReference("Button — primary"),
    ];
    render(
      <StatefulComposer references={references} onReferenceRemove={onRemove} />,
    );
    const list = screen.getByLabelText("References attached to this message");
    expect(list.querySelectorAll("li")).toHaveLength(2);
    await userEvent.click(
      screen.getByLabelText("Remove reference Button — primary"),
    );
    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it("accepts a library drag drop and ignores foreign drag data", () => {
    const onAdd = vi.fn();
    render(<StatefulComposer onReferenceAdd={onAdd} />);
    const target = screen.getByTestId("chat-composer");

    const foreign = createFakeDataTransfer();
    foreign.setData("text/plain", "not a reference");
    fireEvent.drop(target, { dataTransfer: foreign });
    expect(onAdd).not.toHaveBeenCalled();

    const reference = componentReference();
    const transfer = createFakeDataTransfer();
    transfer.setData(LIBRARY_REFERENCE_MIME, JSON.stringify(reference));
    fireEvent.drop(target, { dataTransfer: transfer });
    expect(onAdd).toHaveBeenCalledWith(reference);
  });
});

describe("inline note", () => {
  it("renders the degradation note without blocking sending", () => {
    render(<StatefulComposer inlineNote="Bridge restarting" initialDraft="x" />);
    expect(screen.getByText("Bridge restarting")).toBeTruthy();
    expect(input().disabled).toBe(false);
  });
});
