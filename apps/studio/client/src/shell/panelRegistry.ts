/**
 * Panel registry — the single place panels are declared to the shell.
 * Registration order is meaningful only as a tiebreak; placement comes
 * from each definition's defaultPlacement until a persisted layout says
 * otherwise. Duplicate ids fail fast at startup (developer error).
 */
import type { PanelDefinition, PanelRegistry } from "./types.js";

const KEBAB_ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export function createPanelRegistry(): PanelRegistry {
  const panels = new Map<string, PanelDefinition>();

  return {
    register(definition: PanelDefinition): void {
      if (!KEBAB_ID.test(definition.id)) {
        throw new Error(
          `Panel id "${definition.id}" must be a kebab-case slug (e.g. "compliance-detail").`,
        );
      }
      const existing = panels.get(definition.id);
      if (existing !== undefined) {
        throw new Error(
          `Duplicate panel id "${definition.id}": already registered as "${existing.title}", ` +
            `rejected registration "${definition.title}". Panel ids must be unique.`,
        );
      }
      panels.set(definition.id, definition);
    },
    get(id: string): PanelDefinition | undefined {
      return panels.get(id);
    },
    list(): readonly PanelDefinition[] {
      return [...panels.values()];
    },
  };
}
