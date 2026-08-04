/**
 * ChunkErrorBoundary — catches dynamic-import (chunk) failures caused by
 * network drops during lazy-route navigation.
 *
 * Strategy:
 *  • If the error looks like a chunk-load failure → show a friendly card
 *    with a "Reload page" button (window.location.reload()) so the browser
 *    can fetch the missing chunk again.
 *  • Any other error is re-thrown from render() so it propagates to the
 *    nearest parent boundary (e.g. PageErrorBoundary) for normal handling.
 *
 * This boundary intentionally does NOT handle runtime errors originating
 * from within page components — those are left for PageErrorBoundary.
 */
import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

// ---------------------------------------------------------------------------
// Chunk-load error detection
// Vite / webpack both produce TypeError / ChunkLoadError with one of these
// message patterns when a dynamic import fails to fetch.
// ---------------------------------------------------------------------------
function isChunkLoadError(error: Error): boolean {
  if (error.name === 'ChunkLoadError') return true;
  const msg = error.message ?? '';
  return (
    /loading chunk/i.test(msg) ||
    /failed to fetch dynamically imported module/i.test(msg) ||
    /importing a module script failed/i.test(msg) ||
    /unable to preload css/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg)
  );
}

interface Props {
  children: React.ReactNode;
}

interface State {
  /** Set when we own the error (chunk load failure). */
  chunkError: Error | null;
  /** Set when we do NOT own the error — will be re-thrown in render(). */
  nonChunkError: Error | null;
}

export class ChunkErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { chunkError: null, nonChunkError: null };
  }

  static getDerivedStateFromError(error: Error): State {
    if (isChunkLoadError(error)) {
      return { chunkError: error, nonChunkError: null };
    }
    // Store the error so render() can re-throw it to the parent boundary.
    return { chunkError: null, nonChunkError: error };
  }

  componentDidCatch(error: Error, _info: React.ErrorInfo) {
    if (isChunkLoadError(error)) {
      console.warn('[ChunkErrorBoundary] chunk load failed:', error.message);
    }
    // Non-chunk errors are intentionally not logged here; the parent
    // PageErrorBoundary will handle logging once the error propagates.
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { chunkError, nonChunkError } = this.state;

    // Re-throw non-chunk errors so the parent PageErrorBoundary handles them.
    if (nonChunkError) {
      throw nonChunkError;
    }

    if (chunkError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 max-w-md w-full p-8 text-center">
            <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <WifiOff className="w-7 h-7 text-amber-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">
              Impossible de charger la page
            </h2>
            <p className="text-sm text-gray-500 mb-1">
              Le fichier de cette page n'a pas pu être téléchargé.
            </p>
            <p className="text-xs text-gray-400 mb-6">
              Vérifiez votre connexion puis rechargez.
            </p>
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Recharger la page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
