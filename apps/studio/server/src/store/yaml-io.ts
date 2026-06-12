/**
 * YAML I/O helpers over the `yaml` package (never hand-rolled parsing) with
 * corrupt-result translation: a parse failure degrades exactly the item
 * being read to a typed `corrupt` StoreError, never the whole store.
 * Multiline strings serialize as block scalars, keeping every file on disk
 * human-readable.
 */
import { readFile } from "node:fs/promises";

import { parse, stringify } from "yaml";

import { atomicWriteFile, type AtomicWriteHooks } from "./atomic-write.js";
import {
  corrupt,
  fail,
  fromFsError,
  ok,
  type StoreResult,
} from "./errors.js";

/**
 * Read and parse one YAML file.
 *
 * @param filePath - Absolute path to read.
 * @param relPath - The same path relative to the store root, used in error
 *   messages so the user can find and fix the file.
 * @returns Parsed document; `not_found` when absent; `corrupt` when the
 *   content is not valid YAML.
 */
export async function readYamlFile(
  filePath: string,
  relPath: string,
): Promise<StoreResult<unknown>> {
  let text: string;
  try {
    text = await readFile(filePath, "utf8");
  } catch (err) {
    return fail(fromFsError(err, `Cannot read ${relPath}`, relPath));
  }
  try {
    return ok(parse(text));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return fail(corrupt(relPath, `not valid YAML: ${detail}`, err));
  }
}

/** Serialize a document to YAML text (block scalars for multiline strings). */
export function toYaml(document: unknown): string {
  return stringify(document);
}

/**
 * Serialize and atomically write one YAML document.
 *
 * @param filePath - Absolute target path.
 * @param document - Value to serialize via the yaml package.
 * @param relPath - Store-root-relative path for error messages.
 * @param hooks - Optional fault-injection hooks (tests only).
 */
export async function writeYamlFile(
  filePath: string,
  document: unknown,
  relPath: string,
  hooks: AtomicWriteHooks = {},
): Promise<StoreResult<void>> {
  try {
    await atomicWriteFile(filePath, toYaml(document), hooks);
    return ok(undefined);
  } catch (err) {
    return fail(fromFsError(err, `Cannot write ${relPath}`, relPath));
  }
}
