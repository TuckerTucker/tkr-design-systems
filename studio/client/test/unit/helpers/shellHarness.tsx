/**
 * Shared shell test harness — test panel definitions (lazy, with stateful
 * content to prove docking operations never remount panel contents), a
 * DockProvider + ShellFrame render helper, and geometry stubbing for the
 * drag tests (jsdom has no layout, so rail/header rects are assigned).
 */
import { render, type RenderResult } from "@testing-library/react";
import { lazy, useState, type ReactElement } from "react";

import { DockProvider } from "../../../src/shell/DockContext.jsx";
import { defaultDockState } from "../../../src/shell/dockReducer.js";
import { ShellFrame } from "../../../src/shell/ShellFrame.jsx";
import type { DockState, PanelDefinition } from "../../../src/shell/types.js";

function TestIcon(props: { size?: number }): ReactElement {
  return <svg width={props.size ?? 16} height={props.size ?? 16} aria-hidden="true" />;
}

function StatefulContent(props: { label: string }): ReactElement {
  const [count, setCount] = useState(0);
  return (
    <div>
      <p>{props.label} content</p>
      <button type="button" onClick={() => setCount((value) => value + 1)}>
        {props.label} count: {count}
      </button>
    </div>
  );
}

export function makePanel(
  id: string,
  title: string,
  rail: "left" | "right",
  order = 0,
  ContentOverride?: () => ReactElement,
): PanelDefinition {
  return {
    id,
    title,
    icon: TestIcon,
    component: lazy(async () => ({
      default:
        ContentOverride ?? ((): ReactElement => <StatefulContent label={title} />),
    })),
    defaultPlacement: { rail, order },
    minWidth: 240,
  };
}

export function makeTestPanels(): PanelDefinition[] {
  return [makePanel("chat", "Chat", "left"), makePanel("library", "Library", "right")];
}

export interface ShellRender extends RenderResult {
  panels: PanelDefinition[];
  changes: DockState[];
}

export function renderShell(options: {
  panels?: PanelDefinition[];
  initialState?: DockState;
} = {}): ShellRender {
  const panels = options.panels ?? makeTestPanels();
  const changes: DockState[] = [];
  const result = render(
    <DockProvider
      panels={panels}
      initialState={options.initialState ?? defaultDockState(panels)}
      onChange={(state) => changes.push(state)}
    >
      <ShellFrame center={<div>center stage</div>} />
    </DockProvider>,
  );
  return Object.assign(result, { panels, changes });
}

interface RectSpec {
  left: number;
  top: number;
  width: number;
  height: number;
}

function assignRect(element: Element, spec: RectSpec): void {
  element.getBoundingClientRect = () =>
    ({
      x: spec.left,
      y: spec.top,
      left: spec.left,
      top: spec.top,
      right: spec.left + spec.width,
      bottom: spec.top + spec.height,
      width: spec.width,
      height: spec.height,
      toJSON: () => ({}),
    }) as DOMRect;
}

export const GEOMETRY = {
  leftRail: { left: 0, top: 0, width: 320, height: 800 },
  rightRail: { left: 1000, top: 0, width: 360, height: 800 },
  headerHeight: 36,
} as const;

/**
 * Assign deterministic rects to the rails and panel headers. Call again
 * after any move — the DOM (and therefore the stub targets) changed.
 */
export function stubShellGeometry(root: ParentNode = document): void {
  for (const railEl of root.querySelectorAll<HTMLElement>("[data-rail]")) {
    const side = railEl.dataset["rail"] === "left" ? "leftRail" : "rightRail";
    assignRect(railEl, GEOMETRY[side]);
    const headers = railEl.querySelectorAll<HTMLElement>("[data-panel-header]");
    [...headers].forEach((header, index) => {
      assignRect(header, {
        left: GEOMETRY[side].left,
        top: index * 200,
        width: GEOMETRY[side].width,
        height: GEOMETRY.headerHeight,
      });
    });
  }
}

/** A pointer position inside a rail at a given stack slot. */
export function railPoint(
  rail: "left" | "right",
  y: number,
): { clientX: number; clientY: number } {
  const spec = rail === "left" ? GEOMETRY.leftRail : GEOMETRY.rightRail;
  return { clientX: spec.left + spec.width / 2, clientY: y };
}
