/**
 * Layout sync status context — surfaced inline in the panel settings menu
 * (spec: PUT failure handling is visible there, never a toast). Defaults
 * to "synced" so the shell renders without a provider in isolated tests.
 */
import { createContext, useContext } from "react";

import type { SyncStatus } from "../preferences/layoutPersistence.js";

const SyncStatusContext = createContext<SyncStatus>("synced");

export const SyncStatusProvider = SyncStatusContext.Provider;

export function useSyncStatus(): SyncStatus {
  return useContext(SyncStatusContext);
}

export function syncStatusLabel(status: SyncStatus): string {
  switch (status) {
    case "synced":
      return "Layout saved";
    case "saving":
      return "Saving layout…";
    case "retrying":
      return "Layout save pending — retrying in the background";
  }
}
