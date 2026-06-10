/**
 * Typed pipeline event bus — the seam between artifact-pipeline (producer)
 * and studio-api (consumer, Wave 4: relays onto the WS stream as
 * "artifact.version_created" / "artifact.compliance_completed").
 *
 * Payload shapes are the canonical contract types (artifact.ts); listeners
 * are isolated — one throwing listener never breaks emission to the rest.
 */
import type {
  ArtifactComplianceCompletedPayload,
  ArtifactVersionCreatedPayload,
} from "@studio/contract";

import type { Logger } from "../logging/create-logger.js";

/** Event name → payload map; the single source for pipeline event typing. */
export interface PipelineEventMap {
  version_created: ArtifactVersionCreatedPayload;
  compliance_completed: ArtifactComplianceCompletedPayload;
}

export type PipelineEventName = keyof PipelineEventMap;

export type PipelineEventListener<E extends PipelineEventName> = (
  payload: PipelineEventMap[E],
) => void;

export interface PipelineEventBus {
  emit<E extends PipelineEventName>(
    event: E,
    payload: PipelineEventMap[E],
  ): void;
  /** Subscribe; returns the unsubscribe function. */
  on<E extends PipelineEventName>(
    event: E,
    listener: PipelineEventListener<E>,
  ): () => void;
}

/**
 * Construct the bus (IoC seam — injected into the pipeline factory; the
 * composition root hands the same instance to studio-api).
 */
export function createPipelineEventBus(logger: Logger): PipelineEventBus {
  const log = logger.child({ component: "artifact-pipeline-events" });
  const listeners = new Map<PipelineEventName, Set<(payload: never) => void>>();

  return {
    emit(event, payload) {
      log.debug({ event, payload }, "pipeline event emitted");
      const subscribed = listeners.get(event);
      if (subscribed === undefined) {
        return;
      }
      for (const listener of subscribed) {
        try {
          (listener as PipelineEventListener<typeof event>)(payload);
        } catch (err) {
          log.error(
            { event, err },
            "pipeline event listener threw; other listeners unaffected",
          );
        }
      }
    },
    on(event, listener) {
      let subscribed = listeners.get(event);
      if (subscribed === undefined) {
        subscribed = new Set();
        listeners.set(event, subscribed);
      }
      subscribed.add(listener as (payload: never) => void);
      return () => {
        subscribed.delete(listener as (payload: never) => void);
      };
    },
  };
}
