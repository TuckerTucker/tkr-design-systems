/**
 * Typed store results — helper constructors over the canonical
 * StoreResult/StoreError contract in @studio/contract. Errors cross the
 * repository seam as values, never as thrown exceptions.
 */
import type { StoreError, StoreResult } from "@studio/contract";

export type {
  StoreError,
  StoreErrorCode,
  StoreResult,
} from "@studio/contract";

/** Successful result. */
export function ok<T>(value: T): StoreResult<T> {
  return { ok: true, value };
}

/** Failed result from a constructed StoreError. */
export function fail<T = never>(error: StoreError): StoreResult<T> {
  return { ok: false, error };
}

export function notFound(message: string, path?: string): StoreError {
  return path === undefined
    ? { code: "not_found", message }
    : { code: "not_found", message, path };
}

/**
 * Corrupt-file error. Workspaces are gitignored, so there is no git copy to
 * restore from — the message names the on-disk path for manual repair.
 */
export function corrupt(path: string, detail: string, cause?: unknown): StoreError {
  return {
    code: "corrupt",
    message: `${path} is damaged (${detail}). The file is plain YAML — fix it by hand at that path; only this item is affected.`,
    path,
    cause,
  };
}

export function conflict(message: string, path?: string): StoreError {
  return path === undefined
    ? { code: "conflict", message }
    : { code: "conflict", message, path };
}

export function ioError(message: string, cause?: unknown, path?: string): StoreError {
  const error: StoreError = { code: "io_error", message, cause };
  if (path !== undefined) {
    error.path = path;
  }
  return error;
}

/** True when an unknown caught value is an errno exception with this code. */
export function hasErrnoCode(err: unknown, code: string): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as NodeJS.ErrnoException).code === code
  );
}

/**
 * Translate a filesystem failure into a StoreError: ENOENT means the item
 * does not exist (not_found); everything else is an io_error wrapping the
 * cause so subsequent calls can retry naturally.
 */
export function fromFsError(
  err: unknown,
  what: string,
  path?: string,
): StoreError {
  if (hasErrnoCode(err, "ENOENT")) {
    return notFound(`${what}: it does not exist`, path);
  }
  const detail = err instanceof Error ? err.message : String(err);
  return ioError(`${what}: ${detail}`, err, path);
}
