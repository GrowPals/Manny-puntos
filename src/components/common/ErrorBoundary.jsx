import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';

/**
 * ErrorBoundary - Catches JavaScript errors anywhere in the child component tree
 * and displays a fallback UI instead of crashing the whole app.
 *
 * Features:
 * - Handles chunk loading errors (after deployment) with automatic reload option
 * - Provides detailed error information in development
 * - Accessible error messages
 *
 * @param {React.ReactNode} children - Child components to render
 * @param {React.ReactNode} fallback - Optional custom fallback UI
 * @param {function} onError - Optional callback when error occurs
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, isChunkError: false };
  }

  static getDerivedStateFromError(error) {
    const errorMessage = error?.message || error?.toString() || '';
    const errorName = error?.name || '';
    const isChunkError =
      errorMessage.includes('Failed to fetch dynamically imported module') ||
      errorMessage.includes('Loading chunk') ||
      errorMessage.includes('ChunkLoadError') ||
      errorMessage.includes('dynamically imported module') ||
      errorName === 'ChunkLoadError' ||
      (errorMessage.includes('Failed to fetch') && errorMessage.includes('.js'));

    return { hasError: true, error: error, isChunkError };
  }

  componentDidCatch(error, errorInfo) {
    logger.error('ErrorBoundary caught an error', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack
    });

    // Call optional error callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleHardReload = async () => {
    // Unregister service workers to clear cache
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
    }
    // Clear caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
    // Force reload from server
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Special handling for chunk loading errors (after new deployment)
      if (this.state.isChunkError) {
        return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4" role="alert">
            <div className="text-center bg-card p-8 rounded-2xl shadow-xl border border-primary/50 max-w-lg">
              <RefreshCw className="w-12 h-12 text-primary mx-auto mb-4" aria-hidden="true" />
              <h1 className="text-2xl font-bold text-primary mb-2">Nueva versión disponible</h1>
              <p className="text-muted-foreground mb-4">
                Hemos actualizado la aplicación. Por favor, recarga para obtener la última versión.
              </p>
              <Button onClick={this.handleHardReload}>
                <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
                Actualizar ahora
              </Button>
            </div>
          </div>
        );
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4" role="alert">
          <div className="text-center bg-card p-8 rounded-2xl shadow-xl border border-destructive/50 max-w-lg">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" aria-hidden="true" />
            <h1 className="text-2xl font-bold text-destructive mb-2">¡Oops! Algo salió mal.</h1>
            <p className="text-muted-foreground mb-4">
              Hemos encontrado un error inesperado. Por favor, intenta recargar la página.
            </p>
            <details className="text-left bg-muted p-2 rounded text-xs text-muted-foreground mb-4">
              <summary className="cursor-pointer">Detalles del error</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words">
                {this.state.error?.toString()}
              </pre>
            </details>
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
              Recargar página
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * withErrorBoundary - HOC to wrap components with ErrorBoundary
 *
 * @param {React.Component} Component - Component to wrap
 * @param {Object} errorBoundaryProps - Props to pass to ErrorBoundary
 */
export const withErrorBoundary = (Component, errorBoundaryProps = {}) => {
  const WrappedComponent = (props) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name || 'Component'})`;

  return WrappedComponent;
};

export default ErrorBoundary;