import { Component } from "react";

/** Without this, any uncaught render error anywhere in the app (a null
 * field on an unexpected API response shape, etc.) unmounts the entire
 * React tree — the visitor gets a blank white page with zero explanation
 * and no way to recover short of guessing to hit refresh. One boundary at
 * the root turns that into a real, actionable screen instead. */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("Unhandled render error:", error, info?.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-6">
        <div className="card p-8 max-w-sm w-full text-center">
          <div className="eyebrow mb-2">Something went wrong</div>
          <h1 className="font-heading text-xl font-semibold mb-2">This page hit a snag.</h1>
          <p className="text-sm text-[var(--fg-muted)] mb-6">Reloading usually fixes it. If it keeps happening, head back to the home feed.</p>
          <div className="flex flex-col gap-2">
            <button onClick={() => window.location.reload()} className="btn-primary" data-testid="error-boundary-reload">Reload</button>
            <button onClick={() => { window.location.href = "/"; }} className="btn-outline" data-testid="error-boundary-home">Go home</button>
          </div>
        </div>
      </div>
    );
  }
}
