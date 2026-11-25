import React from 'react';
import { RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Something unexpected happened.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('UI ErrorBoundary caught error:', error, info.componentStack);
  }

  handleRecover = () => {
    this.props.onReset?.();
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#e9f2fc] text-slate-900">
          <div className="max-w-md w-full bg-white border border-blue-200 rounded-xl shadow-sm p-6 space-y-4 text-center">
            <h1 className="font-display text-lg font-semibold text-[#0f294d]">
              Abundant Knowledge hit a bump
            </h1>
            <p className="text-sm text-slate-600">
              {this.state.message || 'Please reload your study room to continue.'}
            </p>
            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={this.handleRecover}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-[#1d4ed8] to-[#0284c7] text-white inline-flex items-center gap-2 shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Resume Workspace</span>
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-blue-200 text-blue-900 hover:bg-blue-50"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
