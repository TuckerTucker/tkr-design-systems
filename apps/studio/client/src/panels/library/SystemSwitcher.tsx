/**
 * System switcher — lists every registered system (name, tagline, status;
 * draft systems badged and still selectable) and scopes the whole panel
 * to the selection. Radio-group semantics with full keyboard parity:
 * arrows move selection, matching mouse behavior exactly.
 */
import {
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
} from "react";

import type { LibrarySystem } from "@studio/contract";

export interface SystemSwitcherProps {
  systems: readonly LibrarySystem[];
  activeSystemId: string | null;
  onSelect(systemId: string): void;
}

export function SystemSwitcher(props: SystemSwitcherProps): ReactElement {
  const listRef = useRef<HTMLDivElement | null>(null);

  if (props.systems.length === 0) {
    return (
      <p className="library-empty" role="status">
        No design systems are registered. Register one via
        ds_register_system (or the systems registry) and it appears here.
      </p>
    );
  }

  function moveSelection(offset: number): void {
    const index = props.systems.findIndex(
      (system) => system.id === props.activeSystemId,
    );
    const nextIndex = Math.min(
      Math.max(index + offset, 0),
      props.systems.length - 1,
    );
    const next = props.systems[nextIndex];
    if (next !== undefined && next.id !== props.activeSystemId) {
      props.onSelect(next.id);
      // Keep focus on the newly selected radio (roving tabindex).
      requestAnimationFrame(() => {
        listRef.current
          ?.querySelector<HTMLElement>('[aria-checked="true"]')
          ?.focus();
      });
    }
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      moveSelection(1);
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      moveSelection(-1);
    }
  }

  return (
    <div
      ref={listRef}
      className="library-system-switcher"
      role="radiogroup"
      aria-label="Design system"
      onKeyDown={onKeyDown}
    >
      {props.systems.map((system) => {
        const selected = system.id === props.activeSystemId;
        return (
          <button
            key={system.id}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected || props.activeSystemId === null ? 0 : -1}
            className="library-system-option"
            data-selected={selected ? "true" : undefined}
            onClick={() => props.onSelect(system.id)}
          >
            <span className="library-system-name">
              {system.name}
              {system.status !== "available" ? (
                <span className="library-system-badge">{system.status}</span>
              ) : null}
            </span>
            {system.tagline !== undefined && system.tagline !== "" ? (
              <span className="library-system-tagline">{system.tagline}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
