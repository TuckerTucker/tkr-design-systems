/**
 * Panel composition — THE place panels are registered with the shell.
 *
 * Wave 6 capabilities (chat-panel, library-panel) and every future panel
 * (compliance detail, history, blueprint tree) plug in here by swapping
 * the lazy import target or appending one registry.register() call — zero
 * shell changes by design.
 */
import { lazy, type ReactElement } from "react";

import type { PanelRegistry } from "../shell/types.js";

function ChatIcon(props: { size?: number }): ReactElement {
  const size = props.size ?? 16;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M2 3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v6a1.5 1.5 0 0 1-1.5 1.5H8l-3.2 2.7A.5.5 0 0 1 4 13.3V11h-.5A1.5 1.5 0 0 1 2 9.5v-6Z"
        fill="currentColor"
      />
    </svg>
  );
}

function LibraryIcon(props: { size?: number }): ReactElement {
  const size = props.size ?? 16;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2" y="2" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="9" y="2" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="2" y="9" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="9" y="9" width="5" height="5" rx="1" fill="currentColor" />
    </svg>
  );
}

/**
 * Register the studio's panels. First-run defaults: chat on the left
 * rail, library on the right (story: user-opens-studio-shell).
 */
export function registerStudioPanels(registry: PanelRegistry): void {
  registry.register({
    id: "chat",
    title: "Chat",
    icon: ChatIcon,
    component: lazy(() => import("../panels/chat/ChatPanel.jsx")),
    defaultPlacement: { rail: "left", order: 0 },
    minWidth: 280,
  });

  registry.register({
    id: "library",
    title: "Library",
    icon: LibraryIcon,
    component: lazy(() => import("../panels/library/LibraryPanel.jsx")),
    defaultPlacement: { rail: "right", order: 0 },
    minWidth: 300,
  });
}
