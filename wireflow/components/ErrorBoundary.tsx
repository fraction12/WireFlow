'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

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

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
          <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
              <AlertTriangle size={32} className="text-red-600 dark:text-red-400" />
            </div>

            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              Something went wrong
            </h1>

            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
              An unexpected error occurred. Your work may have been saved automatically.
            </p>

            {this.state.error && (
              <details className="text-left mb-6">
                <summary className="text-sm text-zinc-500 dark:text-zinc-400 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300">
                  Error details
                </summary>
                <pre className="mt-2 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 overflow-x-auto">
                  {this.state.error.message}
                </pre>
              </details>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Try again
              </button>
              <button
                onClick={this.handleReload}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                <RefreshCw size={16} />
                Reload page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
