/**
 * Library search — one field scoped to the active system, filtering
 * tokens AND components live as the user types (client-side over the
 * cached index; zero network per keystroke). Disabled with the reason
 * inline until the index is cached — never an error after typing. Escape
 * clears.
 */
import {
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
} from "react";

export interface LibrarySearchProps {
  query: string;
  onQueryChange(query: string): void;
  /** False until tokens and the component index are cached. */
  ready: boolean;
  systemName: string | null;
  /** ArrowDown moves focus from the field into the first result. */
  onArrowDown?(): void;
}

export function LibrarySearch(props: LibrarySearchProps): ReactElement {
  function onChange(event: ChangeEvent<HTMLInputElement>): void {
    props.onQueryChange(event.target.value);
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Escape" && props.query !== "") {
      event.preventDefault();
      event.stopPropagation();
      props.onQueryChange("");
    } else if (event.key === "ArrowDown" && props.onArrowDown !== undefined) {
      event.preventDefault();
      props.onArrowDown();
    }
  }

  return (
    <div className="library-search">
      <input
        type="search"
        className="library-search-input"
        aria-label={
          props.systemName === null
            ? "Search library"
            : `Search ${props.systemName} tokens and components`
        }
        placeholder="Search tokens and components"
        value={props.query}
        disabled={!props.ready}
        onChange={onChange}
        onKeyDown={onKeyDown}
      />
      {!props.ready ? (
        <p className="library-search-hint" role="status">
          Search activates once tokens and components finish loading.
        </p>
      ) : null}
    </div>
  );
}
