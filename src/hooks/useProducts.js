import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useNetworkStatus } from './useNetworkStatus';
import { offlineStorage } from '@/lib/offlineStorage';
import { CACHE_CONFIG } from '@/config';
import { logger } from '@/lib/logger';

export const useProducts = () => {
  const { isOnline } = useNetworkStatus();
  const queryClient = useQueryClient();
  const hasPrefilled = useRef(false);

  const { data: productos = [], isLoading: loading, error } = useQuery({
    queryKey: ['productos'],
    queryFn: async () => {
      try {
        const data = await api.products.getProductosCanje();

        // Cache to IndexedDB on success (non-blocking)
        if (data && data.length && offlineStorage.isAvailable()) {
          offlineStorage.saveProducts(data).catch((err) => {
            logger.warn('Failed to cache products to IndexedDB', { error: err.message });
          });
        }

        return data;
      } catch (err) {
        // If offline or network error, try to get from cache
        if (!isOnline && offlineStorage.isAvailable()) {
          try {
            const cached = await offlineStorage.getActiveProducts();
            if (cached && cached.length) {
              return cached;
            }
          } catch (cacheErr) {
            logger.warn('Failed to get products from cache', { error: cacheErr.message });
          }
        }
        throw err;
      }
    },
    staleTime: CACHE_CONFIG.PRODUCTS_STALE_TIME,
    gcTime: CACHE_CONFIG.GC_TIME,
    refetchOnWindowFocus: false,
    retry: isOnline ? 2 : 0,
  });

  // Prefill from cache on mount (runs only once, before query completes)
  useEffect(() => {
    if (hasPrefilled.current) return;
    if (!offlineStorage.isAvailable()) return;
    hasPrefilled.current = true; // Mark immediately to prevent race conditions

    const prefillFromCache = async () => {
      const currentData = queryClient.getQueryData(['productos']);
      if (currentData && currentData.length > 0) return;

      try {
        const cached = await offlineStorage.getActiveProducts();
        if (cached && cached.length) {
          // Only set if still no data (query might have completed during async operation)
          const freshData = queryClient.getQueryData(['productos']);
          if (!freshData || freshData.length === 0) {
            queryClient.setQueryData(['productos'], cached);
          }
        }
      } catch (err) {
        logger.warn('Failed to prefill products from cache', { error: err.message });
      }
    };

    prefillFromCache();
  }, [queryClient]);

  return { productos, loading, error };
};
