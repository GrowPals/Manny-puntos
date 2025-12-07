import React from 'react';
import { Button } from '@/components/ui/button';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, isChunkError: false };
  }

  static getDerivedStateFromError(error) {
    const errorMessage = error?.message || error?.toString() || '';
    const isChunkError =
      errorMessage.includes('Failed to fetch dynamically imported module') ||
      errorMessage.includes('Loading chunk') ||
      errorMessage.includes('ChunkLoadError');

    return { hasError: true, error: error, isChunkError };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
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
      // Special handling for chunk loading errors (after new deployment)
      if (this.state.isChunkError) {
        return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
            <div className="text-center bg-card p-8 rounded-2xl shadow-xl border border-primary/50 max-w-lg">
              <h1 className="text-2xl font-bold text-primary mb-2">Nueva versión disponible</h1>
              <p className="text-muted-foreground mb-4">
                Hemos actualizado la aplicación. Por favor, recarga para obtener la última versión.
              </p>
              <Button onClick={this.handleHardReload}>Actualizar ahora</Button>
            </div>
          </div>
        );
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
          <div className="text-center bg-card p-8 rounded-2xl shadow-xl border border-destructive/50 max-w-lg">
            <h1 className="text-2xl font-bold text-destructive mb-2">¡Oops! Algo salió mal.</h1>
            <p className="text-muted-foreground mb-4">
              Hemos encontrado un error inesperado. Por favor, intenta recargar la página.
            </p>
            <details className="text-left bg-muted p-2 rounded text-xs text-muted-foreground mb-4">
              <summary>Detalles del error</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words">
                {this.state.error?.toString()}
              </pre>
            </details>
            <Button onClick={() => window.location.reload()}>Recargar página</Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;