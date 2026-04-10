import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[FSM_New_UI ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="section-shell flex min-h-72 flex-col items-center justify-center px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-red-100 text-red-600 shadow-card">
            <span className="text-xl font-semibold">!</span>
          </div>
          <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-surface-500">UI Recovery</div>
          <h3 className="mt-2 text-lg font-semibold text-surface-900">This panel hit an unexpected error.</h3>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-surface-500">
            {this.state.error?.message || 'Something failed while rendering this section. You can retry without leaving the page.'}
          </p>
          <button onClick={this.handleReset} className="btn-md btn-primary mt-5">
            Retry section
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
