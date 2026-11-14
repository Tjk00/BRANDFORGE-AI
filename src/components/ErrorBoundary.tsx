import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** Human name of the area being protected, e.g. "Research workspace". */
  label: string;
  children: ReactNode;
  /** Optional recovery action, usually navigating somewhere safe. */
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

/**
 * Catches render/lifecycle errors so a single failing screen can never leave the
 * application blank. The fallback keeps navigation usable and reports the real
 * message instead of hiding it.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[brandforge] ${this.props.label} failed to render`, error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <section className="bf-panel" role="alert">
        <h2 className="bf-panel-title">{this.props.label} could not be displayed</h2>
        <p className="bf-panel-hint">
          Something failed while rendering this screen. Your brands, account and saved data are untouched — go back to
          the dashboard and try again, or retry this screen.
        </p>
        <p className="bf-panel-hint">
          <code>{error.message || 'Unknown rendering error'}</code>
        </p>
        <div className="bf-inline">
          <button type="button" className="btn" data-variant="primary" onClick={this.reset}>
            Try again
          </button>
          <button type="button" className="btn" onClick={this.props.onReset}>
            Back to dashboard
          </button>
        </div>
      </section>
    );
  }
}
