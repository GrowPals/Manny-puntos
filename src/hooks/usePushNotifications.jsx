/**
 * usePushNotifications Hook
 * Professional implementation for Web Push Notifications
 *
 * Features:
 * - Automatic service worker registration
 * - Push subscription management
 * - Graceful error handling
 * - Support for both development and production
 * - Automatic sync when clienteId changes
 * - Handles browser subscription without DB record
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;
const SW_PATH = '/sw.js';
const SW_TIMEOUT = 5000;
const SUBSCRIPTION_CHECK_TIMEOUT = 3000;

/**
 * Convert VAPID key from base64 URL-safe format to Uint8Array
 */
const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

/**
 * Get device information for subscription metadata
 */
const getDeviceInfo = () => ({
  userAgent: navigator.userAgent,
  platform: navigator.platform,
  language: navigator.language,
  standalone: window.matchMedia('(display-mode: standalone)').matches,
  screenWidth: window.screen.width,
  screenHeight: window.screen.height,
  timestamp: new Date().toISOString()
});

/**
 * Wait for service worker with timeout
 */
const waitForServiceWorker = async (timeout = SW_TIMEOUT) => {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Service Worker timeout')), timeout)
    )
  ]);
};

/**
 * Register service worker if not already registered
 */
const ensureServiceWorkerRegistered = async () => {
  try {
    // Check if already registered
    const existingRegistration = await navigator.serviceWorker.getRegistration();
    if (existingRegistration) {
      return existingRegistration;
    }

    // Register new service worker
    const registration = await navigator.serviceWorker.register(SW_PATH, {
      scope: '/'
    });

    // Wait for it to be ready
    await navigator.serviceWorker.ready;
    return registration;
  } catch (error) {
    console.error('[Push] Service worker registration failed:', error);
    throw error;
  }
};

/**
 * Main hook for push notifications
 */
export const usePushNotifications = (clienteId, isAdmin = false) => {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [subscription, setSubscription] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const subscriptionRef = useRef(null);
  const lastSyncedClienteRef = useRef(null);
  const syncInProgressRef = useRef(false);

  /**
   * Save subscription to Supabase
   */
  const saveSubscriptionToServer = useCallback(async (sub, clientId, adminFlag) => {
    if (!clientId) {
      console.warn('[Push] Cannot save subscription: clientId is required');
      return false;
    }

    try {
      const p256dhKey = sub.getKey('p256dh');
      const authKey = sub.getKey('auth');

      if (!p256dhKey || !authKey) {
        throw new Error('Missing encryption keys from subscription');
      }

      const { error: dbError } = await supabase
        .from('push_subscriptions')
        .upsert({
          cliente_id: clientId,
          endpoint: sub.endpoint,
          p256dh: btoa(String.fromCharCode(...new Uint8Array(p256dhKey))),
          auth: btoa(String.fromCharCode(...new Uint8Array(authKey))),
          is_admin: adminFlag,
          device_info: getDeviceInfo(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'endpoint',
          ignoreDuplicates: false
        });

      if (dbError) throw dbError;
      console.log('[Push] Subscription saved successfully for client:', clientId);
      return true;
    } catch (err) {
      console.error('[Push] Error saving subscription:', err);
      throw err;
    }
  }, []);

  /**
   * Check if subscription exists in database
   */
  const checkSubscriptionInDB = useCallback(async (endpoint) => {
    try {
      const { data, error: dbError } = await supabase
        .from('push_subscriptions')
        .select('id, cliente_id')
        .eq('endpoint', endpoint)
        .maybeSingle();

      if (dbError) {
        console.error('[Push] Error checking subscription in DB:', dbError);
        return null;
      }
      return data;
    } catch (err) {
      console.error('[Push] Error checking subscription:', err);
      return null;
    }
  }, []);

  /**
   * Sync existing browser subscription with database
   * This handles the case where user has browser subscription but no DB record
   */
  const syncSubscriptionWithDB = useCallback(async (sub, clientId, adminFlag) => {
    if (!sub || !clientId || syncInProgressRef.current) return;
    if (lastSyncedClienteRef.current === clientId) return; // Already synced for this client

    syncInProgressRef.current = true;

    try {
      const dbRecord = await checkSubscriptionInDB(sub.endpoint);

      if (!dbRecord) {
        // Subscription exists in browser but not in DB - save it
        console.log('[Push] Found browser subscription without DB record, syncing...');
        await saveSubscriptionToServer(sub, clientId, adminFlag);
        lastSyncedClienteRef.current = clientId;
      } else if (dbRecord.cliente_id !== clientId) {
        // Subscription exists but for different client - update it
        console.log('[Push] Updating subscription cliente_id');
        await saveSubscriptionToServer(sub, clientId, adminFlag);
        lastSyncedClienteRef.current = clientId;
      } else {
        // Already synced
        lastSyncedClienteRef.current = clientId;
      }
    } catch (err) {
      console.error('[Push] Error syncing subscription:', err);
    } finally {
      syncInProgressRef.current = false;
    }
  }, [checkSubscriptionInDB, saveSubscriptionToServer]);

  // Check browser support and existing subscription on mount
  useEffect(() => {
    const checkSupport = () => {
      const supported =
        'Notification' in window &&
        'serviceWorker' in navigator &&
        'PushManager' in window;

      setIsSupported(supported);

      if (supported) {
        setPermission(Notification.permission);
      }

      return supported;
    };

    const checkExistingSubscription = async () => {
      try {
        const registration = await waitForServiceWorker(SUBSCRIPTION_CHECK_TIMEOUT);
        const existingSub = await registration.pushManager.getSubscription();
        if (existingSub) {
          setSubscription(existingSub);
          subscriptionRef.current = existingSub;
        }
      } catch (err) {
        // Silent fail - service worker might not be ready yet
        console.log('[Push] Subscription check skipped:', err.message);
      }
    };

    if (checkSupport()) {
      checkExistingSubscription();
    }

    // Listen for subscription changes from service worker
    const handleMessage = (event) => {
      if (event.data?.type === 'PUSH_SUBSCRIPTION_CHANGED') {
        setSubscription(event.data.subscription);
        subscriptionRef.current = event.data.subscription;
        // Reset sync state so we re-sync with new subscription
        lastSyncedClienteRef.current = null;
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, []);

  // Sync subscription when clienteId becomes available or changes
  useEffect(() => {
    const currentSub = subscriptionRef.current || subscription;
    if (currentSub && clienteId && permission === 'granted') {
      syncSubscriptionWithDB(currentSub, clienteId, isAdmin);
    }
  }, [clienteId, subscription, permission, isAdmin, syncSubscriptionWithDB]);

  /**
   * Request notification permission and subscribe to push
   */
  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      return {
        success: false,
        error: 'Las notificaciones push no estan soportadas en este navegador'
      };
    }

    // Validate clienteId is available
    if (!clienteId) {
      console.error('[Push] Cannot request permission: clienteId is required');
      return {
        success: false,
        error: 'Error interno: usuario no identificado'
      };
    }

    setIsLoading(true);
    setError(null);

    try {
      // Request permission
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== 'granted') {
        setIsLoading(false);
        return {
          success: false,
          error: 'Permiso de notificaciones denegado por el usuario'
        };
      }

      // Check VAPID key
      if (!VAPID_PUBLIC_KEY) {
        console.warn('[Push] VAPID key not configured, using local notifications only');
        setIsLoading(false);
        return { success: true, localOnly: true };
      }

      // Ensure service worker is registered
      let registration;
      try {
        registration = await waitForServiceWorker(SW_TIMEOUT);
      } catch {
        console.log('[Push] Service worker not ready, registering...');
        registration = await ensureServiceWorkerRegistered();
      }

      if (!registration) {
        throw new Error('No se pudo registrar el Service Worker');
      }

      // Check for existing subscription first
      let newSubscription = await registration.pushManager.getSubscription();

      if (!newSubscription) {
        // Subscribe to push notifications
        newSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }

      setSubscription(newSubscription);
      subscriptionRef.current = newSubscription;

      // Save to server (clienteId is guaranteed to exist here)
      await saveSubscriptionToServer(newSubscription, clienteId, isAdmin);
      lastSyncedClienteRef.current = clienteId;

      // Send welcome notification (fire and forget)
      supabase.functions.invoke('send-push-notification', {
        body: {
          tipo: 'bienvenida',
          cliente_id: clienteId
        }
      }).catch(e => console.log('[Push] Welcome notification skipped:', e.message));

      setIsLoading(false);
      return { success: true };

    } catch (err) {
      console.error('[Push] Error requesting permission:', err);
      setError(err.message);
      setIsLoading(false);
      return { success: false, error: err.message };
    }
  }, [isSupported, clienteId, isAdmin, saveSubscriptionToServer]);

  /**
   * Unsubscribe from push notifications
   */
  const unsubscribe = useCallback(async () => {
    const currentSubscription = subscriptionRef.current || subscription;

    if (!currentSubscription) {
      return { success: true };
    }

    setIsLoading(true);
    setError(null);

    try {
      // Remove from database first (before browser unsubscribe)
      if (currentSubscription.endpoint) {
        const { error: dbError } = await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', currentSubscription.endpoint);

        if (dbError) {
          console.warn('[Push] Error removing from DB:', dbError);
          // Continue anyway - we still want to unsubscribe from browser
        }
      }

      // Unsubscribe from browser
      await currentSubscription.unsubscribe();

      setSubscription(null);
      subscriptionRef.current = null;
      lastSyncedClienteRef.current = null;
      setIsLoading(false);

      return { success: true };
    } catch (err) {
      console.error('[Push] Error unsubscribing:', err);
      setError(err.message);
      setIsLoading(false);
      return { success: false, error: err.message };
    }
  }, [subscription]);

  /**
   * Show a local notification (doesn't require server push)
   */
  const showLocalNotification = useCallback(async (title, options = {}) => {
    if (permission !== 'granted') {
      return false;
    }

    try {
      const registration = await waitForServiceWorker(SW_TIMEOUT);
      await registration.showNotification(title, {
        icon: '/icon.png',
        badge: '/icon.png',
        vibrate: [200, 100, 200],
        tag: options.tag || 'manny-local-notification',
        renotify: true,
        requireInteraction: false,
        ...options
      });
      return true;
    } catch (err) {
      console.error('[Push] Error showing local notification:', err);
      return false;
    }
  }, [permission]);

  return {
    // State
    isSupported,
    permission,
    subscription,
    isLoading,
    isSubscribed: !!subscription,
    error,

    // Actions
    requestPermission,
    unsubscribe,
    showLocalNotification
  };
};

export default usePushNotifications;
