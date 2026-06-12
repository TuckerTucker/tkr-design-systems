/**
 * chat-panel — named exports. The shell registers the panel through
 * panels.tsx (lazy default import of ChatPanel.tsx); everything else
 * imports from here.
 */
export { ArtifactReference, type ArtifactReferenceProps } from "./ArtifactReference.jsx";
export { ChatPanel, type ChatPanelProps } from "./ChatPanel.jsx";
export {
  Composer,
  type ComposerDisabledKind,
  type ComposerDisabledReason,
  type ComposerProps,
} from "./Composer.jsx";
export { DecisionChips, type DecisionChipsProps } from "./DecisionChips.jsx";
export { Message, type MessageProps } from "./Message.jsx";
export { MessageList, type MessageListProps } from "./MessageList.jsx";
export { StructuredError, type StructuredErrorProps } from "./StructuredError.jsx";
export { ToolProgress, type ToolProgressProps } from "./ToolProgress.jsx";
export {
  chatReducer,
  initialChatState,
  isBusy,
  type ArtifactRefView,
  type ChatAction,
  type ChatMessageView,
  type ChatRole,
  type ChatViewState,
  type ChipRerun,
  type ChipRowView,
  type ToolProgressView,
} from "./messageViewModel.js";
export { progressLabel } from "./progressLabels.js";
export {
  useChatPanel,
  type ChatPanelController,
  type ChatSendOutcome,
  type UseChatPanelOptions,
} from "./useChatPanel.js";
