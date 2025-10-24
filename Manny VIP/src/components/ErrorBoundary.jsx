import React from 'react';
import { Button } from '@/components/ui/button';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error: error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
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