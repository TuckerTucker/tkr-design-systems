/**
 * Progressive loading hook — IntersectionObserver-driven visibility shared
 * by the component gallery and the layout browser. An item's content is
 * fetched only once its card scrolls into view; visibility latches true
 * the first time (content never unloads on scroll-away).
 *
 * Environments without IntersectionObserver (and tests that don't install
 * one) degrade to immediately visible — progressive loading is an
 * optimization, never a gate.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export interface ProgressiveLoad {
  /** Attach to the card's root element. */
  ref: (element: Element | null) => void;
  /** True once the element has intersected the viewport. */
  visible: boolean;
}

export function useProgressiveLoad(rootMargin = "200px"): ProgressiveLoad {
  const supported =
    typeof globalThis.IntersectionObserver !== "undefined";
  const [visible, setVisible] = useState(!supported);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const ref = useCallback(
    (element: Element | null): void => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (element === null || !supported) {
        return;
      }
      const observer = new IntersectionObserver(
        (intersections) => {
          if (intersections.some((entry) => entry.isIntersecting)) {
            setVisible(true);
            observer.disconnect();
            if (observerRef.current === observer) {
              observerRef.current = null;
            }
          }
        },
        { rootMargin },
      );
      observer.observe(element);
      observerRef.current = observer;
    },
    [supported, rootMargin],
  );

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, []);

  return { ref, visible };
}
