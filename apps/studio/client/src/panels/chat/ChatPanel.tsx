/**
 * ChatPanel — the conversation surface, registered with the docking shell
 * through panels.tsx (lazy target). Composes the shell seams (StudioSocket,
 * auth/bridge status, artifact focus, the library→chat reference channel)
 * with the pure chat view model:
 *
 * - transcript with streaming assistant turns inside one polite live region
 * - multiline composer with disabled-with-reason (busy, keyless, invalid
 *   key, no workspace) and a cancel control during generation
 * - decision chips (editable on the latest set) dispatching chip.update
 *   { messageId, kind, value }
 * - inline tool progress and structured errors, contextual to the turn —
 *   never a toast
 * - artifact references focusing the canvas through shared shell state
 *
 * The panel stays mounted while collapsed (PanelContentLayer), so draft
 * text and scroll position survive collapse/restore without persistence.
 */
import { useCallback, useState, type ReactElement } from "react";

import { useShellState } from "../../app/shellState.jsx";
import { AuthSetupNotice } from "./AuthSetupNotice.jsx";
import { Composer, type ComposerDisabledReason } from "./Composer.jsx";
import { MessageList } from "./MessageList.jsx";
import type { ArtifactRefView } from "./messageViewModel.js";
import { useChatPanel } from "./useChatPanel.js";

import "./chat.css";

const AUTH_MISSING_GUIDANCE = "Add ANTHROPIC_API_KEY to apps/studio/.env";
const AUTH_INVALID_GUIDANCE =
  "The configured ANTHROPIC_API_KEY was rejected — replace it in apps/studio/.env";
const BUSY_REASON = "Agent is working — cancel to send a new message";
const NO_WORKSPACE_REASON =
  "Select or create a workspace to start the conversation";
const BRIDGE_DOWN_NOTE =
  "Design-system tools are restarting — generation may pause briefly";

export interface ChatPanelProps {
  /** Injected in tests for deterministic correlation ids. */
  generateRequestId?: () => string;
}

export function ChatPanel(props: ChatPanelProps): ReactElement {
  const {
    socket,
    activeWorkspaceId,
    authStatus,
    bridgeStatus,
    focusedArtifactId,
    focusArtifact,
    pendingReferences,
    addReference,
    removeReference,
    consumeReferences,
  } = useShellState();

  const chat = useChatPanel({
    socket,
    workspaceId: activeWorkspaceId,
    generateRequestId: props.generateRequestId,
  });
  const { send, retry, cancel, updateChip } = chat;

  const [draft, setDraft] = useState("");

  // Disabled-with-reason precedence: no workspace, then auth, then busy.
  // The reason renders adjacent to the input (Composer), never a tooltip.
  const disabled: ComposerDisabledReason | null =
    activeWorkspaceId === null
      ? { kind: "no_workspace", message: NO_WORKSPACE_REASON }
      : authStatus !== null && authStatus.state === "missing"
        ? { kind: "auth_missing", message: AUTH_MISSING_GUIDANCE }
        : authStatus !== null && authStatus.state === "invalid"
          ? { kind: "auth_invalid", message: AUTH_INVALID_GUIDANCE }
          : chat.busy
            ? { kind: "agent_busy", message: BUSY_REASON }
            : null;

  // Chip selects share the disabled reason: in-flight runs must not
  // double-fire, and keyless mode renders the transcript read-only.
  const chipsDisabledReason = disabled === null ? null : disabled.message;

  const onSend = useCallback(
    (text: string): void => {
      // Drain the shell's pending references into this send; a failed
      // dispatch keeps them recoverable on the message's retry affordance.
      const references = consumeReferences();
      send(text, references);
      setDraft("");
    },
    [consumeReferences, send],
  );

  const onArtifactFocus = useCallback(
    (reference: ArtifactRefView): void => {
      focusArtifact(reference.artifactId);
    },
    [focusArtifact],
  );

  return (
    <section className="chat-panel" aria-label="Conversation">
      <MessageList
        messages={chat.state.messages}
        latestChipsMessageId={chat.state.latestChipsMessageId}
        chipsDisabledReason={chipsDisabledReason}
        focusedArtifactId={focusedArtifactId}
        onChipChange={updateChip}
        onArtifactFocus={onArtifactFocus}
        onRetrySend={retry}
      />
      {authStatus !== null && authStatus.state === "missing" ? (
        <AuthSetupNotice variant="missing" />
      ) : authStatus !== null && authStatus.state === "invalid" ? (
        <AuthSetupNotice variant="invalid" />
      ) : null}
      <Composer
        draft={draft}
        onDraftChange={setDraft}
        references={pendingReferences}
        onReferenceAdd={addReference}
        onReferenceRemove={removeReference}
        disabled={disabled}
        cancelAvailable={chat.state.activeMessageId !== null}
        inlineNote={
          bridgeStatus !== null && bridgeStatus.state !== "up"
            ? BRIDGE_DOWN_NOTE
            : null
        }
        onSend={onSend}
        onCancel={cancel}
      />
    </section>
  );
}

// React.lazy requires a default export from the lazy module boundary; the
// shell's panel registration is the only importer.
// eslint-disable-next-line no-restricted-exports
export default ChatPanel;
