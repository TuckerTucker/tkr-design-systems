/**
 * In-place structured error block — what failed and how to fix it, on the
 * turn where it happened. No toast, no console-only error; the message
 * list's polite live region announces the addition.
 */
import type { ReactElement } from "react";

import type { ApiError } from "@studio/contract";

export interface StructuredErrorProps {
  error: ApiError;
}

export function StructuredError(props: StructuredErrorProps): ReactElement {
  const { error } = props;
  return (
    <div className="chat-error" data-testid="chat-error">
      <p className="chat-error-what">{error.message}</p>
      <p className="chat-error-fix">{error.fix}</p>
      {error.field !== undefined ? (
        <details className="chat-error-detail">
          <summary>Detail</summary>
          <p>
            Offending field: <code>{error.field}</code> ({error.code})
          </p>
        </details>
      ) : null}
    </div>
  );
}
