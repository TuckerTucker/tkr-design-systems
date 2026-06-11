/**
 * Per-panel settings menu — the pointer-free fallback for every docking
 * operation (move to the other rail, collapse) plus the inline layout
 * sync status. Unavailable actions stay visible but disabled with the
 * reason (UX philosophy: gray out, don't hide).
 */
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
} from "react";

import { useDock } from "./DockContext.jsx";
import { syncStatusLabel, useSyncStatus } from "./SyncStatusContext.jsx";
import { type DockPlacement, type RailSide } from "./types.js";

export interface PanelSettingsMenuProps {
  placement: DockPlacement;
  panelTitle: string;
}

interface MenuItem {
  id: string;
  label: string;
  disabledReason: string | null;
  run: () => void;
}

export function PanelSettingsMenu(props: PanelSettingsMenuProps): ReactElement {
  const { placement, panelTitle } = props;
  const { dispatch, requestFocus } = useDock();
  const syncStatus = useSyncStatus();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) {
      buttonRef.current?.focus();
    }
  }, []);

  // Click outside closes the menu.
  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: PointerEvent): void {
      const target = event.target as Node;
      if (
        menuRef.current?.contains(target) !== true &&
        buttonRef.current?.contains(target) !== true
      ) {
        close(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);

  function moveTo(rail: RailSide): void {
    dispatch({ type: "move", panelId: placement.panelId, rail });
    requestFocus(placement.panelId, "header");
    close(false);
  }

  const items: MenuItem[] = [
    {
      id: "move-left",
      label: "Move to left rail",
      disabledReason:
        placement.rail === "left" && !placement.collapsed
          ? "Already on the left rail"
          : null,
      run: () => moveTo("left"),
    },
    {
      id: "move-right",
      label: "Move to right rail",
      disabledReason:
        placement.rail === "right" && !placement.collapsed
          ? "Already on the right rail"
          : null,
      run: () => moveTo("right"),
    },
    {
      id: "collapse",
      label: "Collapse panel",
      disabledReason: placement.collapsed ? "Panel is already collapsed" : null,
      run: () => {
        dispatch({ type: "collapse", panelId: placement.panelId });
        requestFocus(placement.panelId, "icon");
        close(false);
      },
    },
  ];

  function onMenuKeyDown(event: ReactKeyboardEvent): void {
    const itemEls = menuRef.current?.querySelectorAll<HTMLElement>(
      '[role="menuitem"]',
    );
    if (itemEls === undefined || itemEls.length === 0) {
      return;
    }
    const list = [...itemEls];
    const activeIndex = list.findIndex((el) => el === document.activeElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      list[(activeIndex + 1) % list.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      list[(activeIndex - 1 + list.length) % list.length]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === "Home") {
      event.preventDefault();
      list[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      list[list.length - 1]?.focus();
    }
  }

  // Focus the first item when the menu opens.
  useEffect(() => {
    if (open) {
      const first = menuRef.current?.querySelector<HTMLElement>(
        '[role="menuitem"]',
      );
      first?.focus();
    }
  }, [open]);

  return (
    <div className="panel-menu-wrap">
      <button
        ref={buttonRef}
        type="button"
        className="panel-header-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`${panelTitle} panel settings`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => setOpen((value) => !value)}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="3" r="1.5" fill="currentColor" />
          <circle cx="8" cy="8" r="1.5" fill="currentColor" />
          <circle cx="8" cy="13" r="1.5" fill="currentColor" />
        </svg>
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          className="panel-menu"
          role="menu"
          aria-label={`${panelTitle} panel settings`}
          onKeyDown={onMenuKeyDown}
        >
          {items.map((item) => {
            const disabled = item.disabledReason !== null;
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                aria-disabled={disabled}
                title={item.disabledReason ?? undefined}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => {
                  if (!disabled) {
                    item.run();
                  }
                }}
              >
                {item.label}
                {disabled ? ` — ${item.disabledReason}` : ""}
              </button>
            );
          })}
          <div className="panel-menu-status" role="status">
            {syncStatusLabel(syncStatus)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
