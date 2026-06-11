/**
 * Error boundaries — failures render in place, never console-only.
 * AppErrorBoundary wraps the whole shell; PanelErrorBoundary contains a
 * single panel's render failure so the shell, rails, and other panels
 * keep working.
 */
import { Component, type ReactNode } from "react";

interface BoundaryProps {
  /** Names what failed in the inline message. */
  label: string;
  children: ReactNode;
}

interface BoundaryState {
  error: Error | null;
}

export class PanelErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  override render(): ReactNode {
    if (this.state.error !== null) {
      return (
        <div className="panel-error" role="alert">
          <strong>{this.props.label} failed to render.</strong>
          <p>
            The rest of the studio keeps working. Reload the page to retry
            this panel.
          </p>
          <code>{this.state.error.message}</code>
        </div>
      );
    }
    return this.props.children;
  }
}

export class AppErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  override render(): ReactNode {
    if (this.state.error !== null) {
      return (
        <div className="app-error" role="alert">
          <h1>{this.props.label} hit a render failure</h1>
          <p>Reload the page to recover. The failure was:</p>
          <code>{this.state.error.message}</code>
        </div>
      );
    }
    return this.props.children;
  }
}
