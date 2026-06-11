/**
 * PreferencesRepository — the LayoutPreference document (owned by
 * docking-shell) persisted opaquely at <rootDir>/preferences.yaml.
 *
 * The store never interprets fields: get() returns whatever the file
 * parses to, put() serializes whatever the caller hands over — unknown
 * keys round-trip verbatim (forward compatibility with future panels).
 * An absent file reads as null (first launch needs no setup; docking-shell
 * applies its defaults); a corrupt file reads as a typed corrupt result and
 * the next put() repairs it.
 */
import type {
  LayoutPreference,
  PreferencesRepository,
  StoreResult,
} from "@studio/contract";

import type { StoreContext } from "./context.js";
import { ok, type StoreError } from "./errors.js";
import { PREFERENCES_FILE, preferencesFile } from "./layout.js";
import { readYamlFile, writeYamlFile } from "./yaml-io.js";

export function createPreferencesRepository(
  ctx: StoreContext,
): PreferencesRepository {
  const logger = ctx.logger.child({ repository: "preferences" });
  const filePath = preferencesFile(ctx.rootDir);

  return {
    async get(): Promise<StoreResult<LayoutPreference | null>> {
      const ready = await ctx.init();
      if (!ready.ok) {
        return ready;
      }
      const doc = await readYamlFile(filePath, PREFERENCES_FILE);
      if (!doc.ok) {
        if (doc.error.code === "not_found") {
          return ok(null); // first launch — no setup step, defaults apply
        }
        logger.warn(
          { path: PREFERENCES_FILE, code: doc.error.code },
          "preferences degraded; defaults apply until the next write",
        );
        return doc as { ok: false; error: StoreError };
      }
      if (doc.value === null || doc.value === undefined) {
        return ok(null); // empty file — same as absent
      }
      // Opaque persistence: the document is returned as parsed, fields
      // uninterpreted; docking-shell owns the shape.
      return ok(doc.value as LayoutPreference);
    },

    async put(prefs: LayoutPreference): Promise<StoreResult<void>> {
      const ready = await ctx.init();
      if (!ready.ok) {
        return ready;
      }
      // Whole-document replace, serialized per file; last write wins
      // (single-user). A previously corrupt file is repaired here.
      return ctx.queue.run(filePath, async () => {
        const written = await writeYamlFile(
          filePath,
          prefs,
          PREFERENCES_FILE,
          ctx.hooks,
        );
        if (written.ok) {
          logger.debug("preferences persisted");
        }
        return written;
      });
    },
  };
}
