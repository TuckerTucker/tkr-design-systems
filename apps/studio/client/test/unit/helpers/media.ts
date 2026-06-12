/**
 * Controllable matchMedia stub — jsdom does not implement matchMedia.
 * Tests flip the prefers-reduced-motion state with setReducedMotion();
 * subscribed hooks (useReducedMotion) are notified like the real API.
 */
type Listener = () => void;

let reducedMotion = false;
const listeners = new Set<Listener>();

export function installMatchMedia(): void {
  window.matchMedia = (query: string): MediaQueryList => {
    const isReducedMotionQuery = query.includes("prefers-reduced-motion");
    const mql = {
      get matches(): boolean {
        return isReducedMotionQuery ? reducedMotion : false;
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, handler: EventListener): void => {
        if (isReducedMotionQuery) {
          listeners.add(handler as Listener);
        }
      },
      removeEventListener: (_type: string, handler: EventListener): void => {
        listeners.delete(handler as Listener);
      },
      addListener: (): void => undefined,
      removeListener: (): void => undefined,
      dispatchEvent: (): boolean => false,
    };
    return mql as unknown as MediaQueryList;
  };
}

export function setReducedMotion(value: boolean): void {
  if (reducedMotion === value) {
    return;
  }
  reducedMotion = value;
  for (const listener of [...listeners]) {
    listener();
  }
}
