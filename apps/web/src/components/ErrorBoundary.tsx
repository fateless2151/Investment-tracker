import { Component, ErrorInfo, ReactNode } from 'react';

interface State {
  error: Error | null;
}

/** Catches render errors anywhere below it so the app shows a fallback instead
 * of a blank white screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info);
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="mx-auto mt-10 max-w-md rounded-lg border bg-white p-6 text-center">
          <h2 className="font-medium">Something went wrong.</h2>
          <p className="mt-1 text-sm text-gray-500">
            {this.state.error.message}
          </p>
          <button
            className="mt-4 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
