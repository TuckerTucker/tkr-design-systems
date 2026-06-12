/**
 * In-process per-key serialization. Mutations of one file (transcript
 * appends, head moves) and per-parent allocations (slug and version-number
 * assignment) run through a queue keyed by the path they contend on, so
 * concurrent calls within the process never interleave. Single-user means
 * no cross-process writer exists (architecture decision).
 */

export interface KeyedQueue {
  /** Run `task` after every previously queued task for `key` has settled. */
  run<T>(key: string, task: () => Promise<T>): Promise<T>;
}

export function createKeyedQueue(): KeyedQueue {
  const tails = new Map<string, Promise<void>>();

  return {
    run<T>(key: string, task: () => Promise<T>): Promise<T> {
      const tail = tails.get(key) ?? Promise.resolve();
      const result = tail.then(() => task());
      const settled = result.then(
        () => undefined,
        () => undefined,
      );
      tails.set(key, settled);
      void settled.then(() => {
        if (tails.get(key) === settled) {
          tails.delete(key);
        }
      });
      return result;
    },
  };
}
