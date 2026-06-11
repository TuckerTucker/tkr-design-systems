/**
 * jsdom test setup — Testing Library cleanup plus the browser APIs jsdom
 * does not implement: matchMedia (with a controllable reduced-motion
 * state) and PointerEvent/pointer-capture stubs for the drag tests.
 */
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import { installMatchMedia, setReducedMotion } from "./unit/helpers/media.js";

installMatchMedia();

afterEach(() => {
  cleanup();
  setReducedMotion(false);
});

// jsdom has no PointerEvent; the drag controller only reads clientX/Y.
if (typeof window.PointerEvent === "undefined") {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  }
  // @ts-expect-error — assigning the polyfill onto the jsdom window
  window.PointerEvent = PointerEventPolyfill;
}

if (typeof Element.prototype.setPointerCapture !== "function") {
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
  Element.prototype.hasPointerCapture = () => false;
}
