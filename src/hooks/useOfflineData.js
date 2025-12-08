/**
 * useOfflineData Hooks
 * Provides utilities for offline data management
 * Used in conjunction with offlineStorage for IndexedDB caching
 */

import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNetworkStatus } from './useNetworkStatus';
import { offlineStorage } from '@/lib/offlineStorage';

/**
 * Hook to sync pending offline actions when back online
 * This processes any queued operations that failed while offline
 */
export const useSyncOfflineActions = () => {
  const { isOnline } = useNetworkStatus();
  const queryClient = useQueryClient();
  const isProcessing = useRef(false);

  const processSyncQueue = useCallback(async () => {
    // Prevent concurrent processing
    if (!isOnline || isProcessing.current) return;

    // Check if IndexedDB is available
    if (!offlineStorage.isAvailable()) return;

    isProcessing.current = true;

    try {
      const pendingActions = await offlineStorage.getPendingSyncActions();

      for (const action of pendingActions) {
        try {
          // For now, just remove completed actions
          // Future: Add actual sync logic based on action.type
          await offlineStorage.removeSyncAction(action.id);

          // Invalidate related queries to trigger refetch
          if (action.invalidateQueries && Array.isArray(action.invalidateQueries)) {
            for (const queryKey of action.invalidateQueries) {
              queryClient.invalidateQueries({ queryKey });
            }
          }
        } catch (error) {
          // Update retry count on failure
          const newRetries = (action.retries || 0) + 1;

          if (newRetries >= 3) {
            // Mark as failed after max retries
            await offlineStorage.updateSyncAction(action.id, {
              status: 'failed',
              lastError: error.message,
              lastAttempt: Date.now(),
            });
          } else {
            await offlineStorage.updateSyncAction(action.id, {
              retries: newRetries,
              lastError: error.message,
              lastAttempt: Date.now(),
            });
          }
        }
      }
    } finally {
      isProcessing.current = false;
    }
  }, [isOnline, queryClient]);

  // Process sync queue when coming back online
  useEffect(() => {
    if (isOnline) {
      // Small delay to ensure network is stable
      const timer = setTimeout(processSyncQueue, 1000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, processSyncQueue]);

  return { processSyncQueue };
};

/**
 * Hook to clear offline cache (for logout)
 */
export const useClearOfflineCache = () => {
  return useCallback(async () => {
    if (offlineStorage.isAvailable()) {
      await offlineStorage.clearAll();
    }
  }, []);
};

/**
 * Hook to prefill React Query cache from IndexedDB on mount
 * Use this in components that need offline data immediately
 */
export const usePrefillFromOfflineCache = (queryKey, getCacheFn) => {
  const queryClient = useQueryClient();
  const hasPrefilled = useRef(false);

  useEffect(() => {
    const prefill = async () => {
      if (hasPrefilled.current) return;
      if (!offlineStorage.isAvailable()) return;

      const currentData = queryClient.getQueryData(queryKey);
      if (currentData) return; // Already has data

      try {
        const cached = await getCacheFn();
        if (cached && (Array.isArray(cached) ? cached.length > 0 : true)) {
          queryClient.setQueryData(queryKey, cached);
          hasPrefilled.current = true;
        }
      } catch (error) {
        console.warn('Failed to prefill from offline cache:', error);
      }
    };

    prefill();
  }, [queryClient, queryKey, getCacheFn]);
};

export default {
  useSyncOfflineActions,
  useClearOfflineCache,
  usePrefillFromOfflineCache,
};
