import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ArrowLeft } from 'lucide-react';
import { Button } from './button.js';
import { Badge } from './badge.js';

interface ErrorBoundaryProps {
  children: ReactNode;
  level?: 'app' | 'admin';
  overviewPath?: string;
  onReset?: () => void;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to the console as required, preserving documentation and debugging
    console.error(
      'ErrorBoundary caught an unhandled render error:',
      error,
      errorInfo,
    );
    // Explicitly guarantee: session is NOT cleared here
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  handleGoToOverview = () => {
    this.setState({ hasError: false, error: null });
    const target =
      this.props.overviewPath ??
      (this.props.level === 'admin' ? '/administrator' : '/');
    if (typeof window !== 'undefined') {
      window.location.href = target;
    }
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }

      const isAdmin = this.props.level === 'admin';

      return (
        <div className="flex min-h-[360px] w-full flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="mx-auto max-w-lg rounded-2xl border border-rose-200 bg-white p-6 shadow-sm dark:border-rose-950 dark:bg-slate-900">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <div className="mb-2">
              <Badge
                variant="bracketed"
                size="sm"
                className="text-rose-600 dark:text-rose-400"
              >
                {isAdmin ? 'Admin Console Notice' : 'System Notice'}
              </Badge>
            </div>

            <h2 className="font-sans text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Something went wrong
            </h2>

            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {isAdmin
                ? 'An error occurred while displaying this administrative section. Your session remains active.'
                : 'An unexpected application error occurred. Your session has not been cleared.'}
            </p>

            <div className="my-4 rounded-xl border border-slate-100 bg-slate-50 p-3 text-left font-mono text-xs text-rose-700 dark:border-slate-800 dark:bg-slate-950 dark:text-rose-300 overflow-x-auto">
              <code>{this.state.error.message || 'Unknown render error'}</code>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button
                variant="primary"
                size="md"
                onClick={this.handleReset}
                icon={<RefreshCw className="h-4 w-4" />}
              >
                Retry
              </Button>

              <Button
                variant="outline"
                size="md"
                onClick={this.handleGoToOverview}
                icon={
                  isAdmin ? (
                    <ArrowLeft className="h-4 w-4" />
                  ) : (
                    <Home className="h-4 w-4" />
                  )
                }
              >
                {isAdmin ? 'Back to Overview' : 'Return Home'}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
