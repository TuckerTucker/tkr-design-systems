/**
 * Application entry — composition root. Registers the panels, resolves
 * the persisted layout BEFORE the first paint (no default-then-stored
 * layout flash; one localhost round-trip), resolves the initial workspace
 * (URL deep link beats the preference's lastWorkspaceId), connects the
 * socket, and renders the shell.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { createApiClient } from "./api/apiClient.js";
import { App, resolveBootLayout } from "./app/App.jsx";
import { registerStudioPanels } from "./app/panels.jsx";
import { createLayoutPersistence } from "./preferences/layoutPersistence.js";
import { createWorkspaceHistory } from "./routing/workspaceRoutes.js";
import { createPanelRegistry } from "./shell/panelRegistry.js";
import { createStudioSocket } from "./ws/studioSocket.js";
import "./styles/shell.css";

async function boot(): Promise<void> {
  const registry = createPanelRegistry();
  registerStudioPanels(registry);
  const panels = registry.list();

  const api = createApiClient();
  const stored = await api.getPreferences();
  const { layout, failed } = resolveBootLayout(
    stored.ok,
    stored.ok ? stored.value : null,
    panels,
  );

  const history = createWorkspaceHistory();
  const urlWorkspaceId = history.current();
  const initialWorkspaceId = urlWorkspaceId ?? layout.lastWorkspaceId;

  const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
  const socket = createStudioSocket({
    url: `${wsProtocol}://${window.location.host}/ws`,
  });
  socket.connect();

  const persistence = createLayoutPersistence({ api });

  const container = document.getElementById("root");
  if (container === null) {
    throw new Error("index.html is missing the #root container.");
  }
  createRoot(container).render(
    <StrictMode>
      <App
        panels={panels}
        api={api}
        socket={socket}
        history={history}
        persistence={persistence}
        initialLayout={layout}
        initialLoadFailed={failed}
        initialWorkspaceId={initialWorkspaceId}
        initialFromPreferences={urlWorkspaceId === null}
      />
    </StrictMode>,
  );
}

void boot();
