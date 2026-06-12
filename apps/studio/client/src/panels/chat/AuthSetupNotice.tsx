/**
 * AuthSetupNotice — the prominent in-place setup state shown when the
 * server reports no usable Anthropic API key. Chat is the only surface a
 * key unlocks, so the notice lives here: what's blocked, the exact steps
 * to fix it, and what keeps working meanwhile. It clears automatically
 * when auth.status flips to configured — no dismissal, no toast.
 */
import type { ReactElement } from "react";

export type AuthNoticeVariant = "missing" | "invalid";

export interface AuthSetupNoticeProps {
  variant: AuthNoticeVariant;
}

export function AuthSetupNotice(props: AuthSetupNoticeProps): ReactElement {
  return (
    <div className="chat-auth-notice" role="status">
      <p className="chat-auth-notice-title">
        {props.variant === "missing"
          ? "Add your Anthropic API key to enable chat"
          : "Your Anthropic API key was rejected"}
      </p>
      <ol className="chat-auth-notice-steps">
        {props.variant === "missing" ? (
          <li>
            Copy the template:{" "}
            <code>cp apps/studio/.env.example apps/studio/.env</code>
          </li>
        ) : (
          <li>
            Open <code>apps/studio/.env</code> and replace the key
          </li>
        )}
        <li>
          Set <code>ANTHROPIC_API_KEY</code> to a key from{" "}
          <code>console.anthropic.com</code>
        </li>
        <li>Restart the studio server</li>
      </ol>
      <p className="chat-auth-notice-aside">
        Everything else keeps working without a key — browse the library,
        review artifacts, and inspect compliance.
      </p>
    </div>
  );
}
