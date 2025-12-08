/**
 * useOfflineData Hooks
 * Provides utilities for offline data management
 * Used in conjunction with offlineStorage for IndexedDB caching
 */

import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNetworkStatus } from './useNetworkStatus';
import { offlineStorage } from '@/lib/offlineStorage';
import { api } from '@/services/api';
import { logger, EventType } from '@/lib/logger';

/**
 * Execute a sync action based on its type
 * Returns true if successful, throws error otherwise
 */
const executeSyncAction = async (action) => {
  const { type, payload } = action;

  switch (type) {
    case 'REDEEM_PRODUCT': {
      // Re-attempt redemption with correct signature
      const { cliente_id, producto_id, cliente_nombre, producto_nombre, puntos_producto } = payload;
      await api.redemptions.registrarCanje({
        cliente_id,
        producto_id,
        cliente_nombre,
        producto_nombre,
        puntos_producto
      });
      logger.info('Offline redemption synced', { producto_id, cliente_id }, EventType.SYNC);
      return true;
    }

    case 'CLAIM_GIFT': {
      // Re-attempt gift claim with correct function name
      const { codigo, telefono } = payload;
      await api.gifts.claimGift(codigo, telefono);
      logger.info('Offline gift claim synced', { codigo }, EventType.SYNC);
      return true;
    }

    case 'APPLY_REFERRAL': {
      // Re-attempt referral code application
      const { clienteId, code } = payload;
      await api.referrals.applyReferralCode(clienteId, code);
      logger.info('Offline referral applied', { code }, EventType.SYNC);
      return true;
    }

    default:
      // Unknown action type - log and remove
      logger.warn(`Unknown sync action type: ${type}`, { action }, EventType.SYNC);
      return true; // Return true to remove from queue
  }
};

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
    let successCount = 0;
    let failCount = 0;

    try {
      const pendingActions = await offlineStorage.getPendingSyncActions();

      if (pendingActions.length === 0) {
        return { success: true, synced: 0, failed: 0 };
      }

      logger.info(`Processing ${pendingActions.length} offline actions`, {}, EventType.SYNC);

      for (const action of pendingActions) {
        try {
          // Execute the actual sync action
          await executeSyncAction(action);

          // Remove successfully synced action
          await offlineStorage.removeSyncAction(action.id);
          successCount++;

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
            // Mark as failed after max retries and remove from queue
            logger.error(`Sync action failed permanently after 3 retries`, {
              actionType: action.type,
              error: error.message,
            }, EventType.SYNC);

            await offlineStorage.removeSyncAction(action.id);
            failCount++;
          } else {
            await offlineStorage.updateSyncAction(action.id, {
              retries: newRetries,
              lastError: error.message,
              lastAttempt: Date.now(),
            });
          }
        }
      }

      if (successCount > 0 || failCount > 0) {
        logger.info(`Sync complete: ${successCount} synced, ${failCount} failed`, {}, EventType.SYNC);
      }

      return { success: true, synced: successCount, failed: failCount };
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
 * Helper to queue an offline action for later sync
 * Use this when an operation fails due to being offline
 */
export const queueOfflineAction = async (type, payload, invalidateQueries = []) => {
  if (!offlineStorage.isAvailable()) {
    logger.warn('Cannot queue offline action: IndexedDB not available', { type });
    return false;
  }

  try {
    await offlineStorage.addToSyncQueue({
      type,
      payload,
      invalidateQueries,
    });
    logger.info('Action queued for offline sync', { type }, EventType.SYNC);
    return true;
  } catch (error) {
    logger.error('Failed to queue offline action', { type, error: error.message });
    return false;
  }
};

export default {
  useSyncOfflineActions,
  useClearOfflineCache,
  queueOfflineAction,
};
