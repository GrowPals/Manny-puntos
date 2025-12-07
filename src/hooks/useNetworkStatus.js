import { useState, useEffect, useCallback } from 'react';

/**
 * Hook para detectar estado de conexión a internet
 * Proporciona:
 * - isOnline: boolean indicando si hay conexión
 * - isSlowConnection: boolean si la conexión es lenta (2g/slow-2g)
 * - connectionType: tipo de conexión (wifi, cellular, etc.)
 * - checkConnection: función para verificar conexión manualmente
 */
export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(() => {
    // SSR safe check
    if (typeof window === 'undefined') return true;
    return navigator.onLine;
  });

  const [connectionInfo, setConnectionInfo] = useState(() => {
    if (typeof window === 'undefined' || !navigator.connection) {
      return { effectiveType: 'unknown', type: 'unknown' };
    }
    return {
      effectiveType: navigator.connection.effectiveType || 'unknown',
      type: navigator.connection.type || 'unknown',
    };
  });

  // Verificar conexión real haciendo un ping al servidor
  const checkConnection = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('/favicon.ico', {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleConnectionChange = () => {
      if (navigator.connection) {
        setConnectionInfo({
          effectiveType: navigator.connection.effectiveType || 'unknown',
          type: navigator.connection.type || 'unknown',
        });
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (navigator.connection) {
      navigator.connection.addEventListener('change', handleConnectionChange);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);

      if (navigator.connection) {
        navigator.connection.removeEventListener('change', handleConnectionChange);
      }
    };
  }, []);

  const isSlowConnection = connectionInfo.effectiveType === 'slow-2g' ||
    connectionInfo.effectiveType === '2g';

  return {
    isOnline,
    isSlowConnection,
    connectionType: connectionInfo.type,
    effectiveType: connectionInfo.effectiveType,
    checkConnection,
  };
};

export default useNetworkStatus;
