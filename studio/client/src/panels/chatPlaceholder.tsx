/**
 * Chat panel placeholder — the lazy registration target until chat-panel
 * (Wave 6) replaces this module's export with the real panel content. The
 * shell never changes when that happens; only this component does.
 */
import type { ReactElement } from "react";

export function ChatPlaceholder(): ReactElement {
  return (
    <div className="panel-placeholder">
      <p>
        <strong>Chat</strong>
      </p>
      <p>
        The conversation panel arrives with the chat-panel capability. The
        docking shell is ready: this slot, its tab, its icon-strip entry,
        and its persistence already work.
      </p>
    </div>
  );
}

// React.lazy requires a default export from the lazy module boundary; the
// shell's panel registration is the only importer.
// eslint-disable-next-line no-restricted-exports
export default ChatPlaceholder;
