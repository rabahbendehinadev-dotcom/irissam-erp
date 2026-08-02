/**
 * PageErrorBoundary — global class-based error boundary for all pages.
 *
 * Catches any Runtime Error thrown inside a page, logs route/name/message/
 * component stack WITHOUT logging patient or auth data, and shows a friendly
 * recovery UI with Retry and Back-to-dashboard buttons.
 *
 * Usage:
 *   <PageErrorBoundary>
 *     <SomePage />
 *   </PageErrorBoundary>
 */
import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  /** Optional label for logging — defaults to the current pathname */
  pageName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class PageErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });

    // Log only non-sensitive identifiers — route, error type and message, component stack.
    // Never log token, session, patient data, or form values.
    console.error('[PageErrorBoundary]', {
      route: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
      name: error.name,
      message: error.message,
      componentStack: errorInfo.componentStack?.slice(0, 500),
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 max-w-md w-full p-8 text-center">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-red-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">
              Une erreur est survenue
            </h2>
            <p className="text-sm text-gray-500 mb-1">
              Une erreur est survenue lors du chargement de cette page.
            </p>
            <p className="text-xs text-gray-400 mb-6">
              Veuillez réessayer ou retourner au tableau de bord.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Réessayer
              </button>
              <a
                href="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Home className="w-4 h-4" />
                Tableau de bord
              </a>
            </div>
            {process.env.NODE_ENV !== 'production' && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                  Détails techniques
                </summary>
                <pre className="mt-2 text-[10px] text-red-600 bg-red-50 rounded-lg p-3 overflow-auto max-h-40 whitespace-pre-wrap">
                  {this.state.error.name}: {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
