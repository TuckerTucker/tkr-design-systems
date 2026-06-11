/**
 * Keyboard-operable variant switch — radio-group semantics; arrows and
 * click select identically; the selected variant is announced and
 * retained per card while the panel lives.
 */
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
} from "react";

export interface VariantToggleProps {
  componentId: string;
  variants: readonly string[];
  selected: string;
  onSelect(variantId: string): void;
}

export function VariantToggle(props: VariantToggleProps): ReactElement {
  function move(offset: number): void {
    const index = props.variants.indexOf(props.selected);
    const next =
      props.variants[
        Math.min(Math.max(index + offset, 0), props.variants.length - 1)
      ];
    if (next !== undefined && next !== props.selected) {
      props.onSelect(next);
    }
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
    }
  }

  return (
    <div
      className="library-variant-toggle"
      role="radiogroup"
      aria-label={`${props.componentId} variants`}
      onKeyDown={onKeyDown}
    >
      {props.variants.map((variant) => {
        const selected = variant === props.selected;
        return (
          <button
            key={variant}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            className="library-variant-option"
            data-selected={selected ? "true" : undefined}
            onClick={() => props.onSelect(variant)}
          >
            {variant}
          </button>
        );
      })}
    </div>
  );
}
