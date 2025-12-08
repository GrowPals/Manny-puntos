/**
 * Push Notification Utilities
 * Shared utilities for Web Push implementation
 */

export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;
export const SW_PATH = '/sw.js';
export const SW_TIMEOUT = 5000;

/**
 * Convert VAPID key from base64 URL-safe format to Uint8Array
 * Required by the Push API for applicationServerKey
 */
export const urlBase64ToUint8Array = (base64String) => {
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
export const getDeviceInfo = () => ({
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
export const waitForServiceWorker = async (timeout = SW_TIMEOUT) => {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Service Worker timeout')), timeout)
    )
  ]);
};

/**
 * Get or create a push subscription from a service worker registration
 * @param {ServiceWorkerRegistration} registration
 * @returns {Promise<PushSubscription>}
 */
export const getOrCreateSubscription = async (registration) => {
  // Check for existing subscription first
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription && VAPID_PUBLIC_KEY) {
    // Subscribe to push notifications
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
  }

  return subscription;
};

/**
 * Extract keys from a push subscription for storage
 * @param {PushSubscription} subscription
 * @returns {{ endpoint: string, p256dh: string, auth: string }}
 */
export const extractSubscriptionKeys = (subscription) => {
  if (!subscription) {
    return { endpoint: null, p256dh: null, auth: null };
  }

  const p256dhKey = subscription.getKey('p256dh');
  const authKey = subscription.getKey('auth');

  return {
    endpoint: subscription.endpoint,
    p256dh: p256dhKey ? btoa(String.fromCharCode(...new Uint8Array(p256dhKey))) : null,
    auth: authKey ? btoa(String.fromCharCode(...new Uint8Array(authKey))) : null
  };
};
