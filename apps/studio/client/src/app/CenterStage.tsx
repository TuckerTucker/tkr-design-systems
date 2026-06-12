/**
 * Center stage — the always-center slot the shell guarantees at every
 * arrangement. The canvas capability mounts here: artifact rendering,
 * device frames, zoom/pan, inspect, history, and compliance all live in
 * src/canvas/; this file only bridges the shell's stage slot to it.
 */
import type { ReactElement } from "react";

import { CanvasPanel } from "../canvas/index.js";

export function CenterStage(): ReactElement {
  return <CanvasPanel />;
}
