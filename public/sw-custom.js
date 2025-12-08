/**
 * Manny Rewards - Custom Service Worker
 * Handles push notifications with proper error handling and logging
 */

const SW_VERSION = '1.0.0';
const APP_NAME = 'Manny Rewards';

// Logging utility
const log = (message, data = null) => {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`[SW ${SW_VERSION}] ${timestamp} - ${message}`, data);
  } else {
    console.log(`[SW ${SW_VERSION}] ${timestamp} - ${message}`);
  }
};

// Default notification options
const DEFAULT_NOTIFICATION = {
  title: APP_NAME,
  body: 'Tienes una nueva notificacion',
  icon: '/icon.png',
  badge: '/icon.png',
  vibrate: [200, 100, 200],
  tag: 'manny-notification',
  renotify: true,
  requireInteraction: false,
  data: { url: '/dashboard' }
};

/**
 * Handle incoming push notifications
 */
self.addEventListener('push', (event) => {
  log('Push event received');

  const handlePush = async () => {
    let notificationData = { ...DEFAULT_NOTIFICATION };

    try {
      if (event.data) {
        const payload = event.data.json();
        log('Push payload:', payload);

        notificationData = {
          ...notificationData,
          title: payload.title || notificationData.title,
          body: payload.body || notificationData.body,
          icon: payload.icon || notificationData.icon,
          badge: payload.badge || notificationData.badge,
          vibrate: payload.vibrate || notificationData.vibrate,
          tag: payload.tag || notificationData.tag,
          renotify: payload.renotify ?? notificationData.renotify,
          requireInteraction: payload.requireInteraction ?? notificationData.requireInteraction,
          actions: payload.actions || [],
          data: {
            ...notificationData.data,
            ...payload.data
          }
        };
      }
    } catch (error) {
      log('Error parsing push data:', error.message);
    }

    try {
      await self.registration.showNotification(notificationData.title, {
        body: notificationData.body,
        icon: notificationData.icon,
        badge: notificationData.badge,
        vibrate: notificationData.vibrate,
        tag: notificationData.tag,
        renotify: notificationData.renotify,
        requireInteraction: notificationData.requireInteraction,
        actions: notificationData.actions,
        data: notificationData.data
      });
      log('Notification displayed successfully');
    } catch (error) {
      log('Error showing notification:', error.message);
    }
  };

  event.waitUntil(handlePush());
});

/**
 * Handle notification clicks
 */
self.addEventListener('notificationclick', (event) => {
  log('Notification click event', { action: event.action });

  event.notification.close();

  const notificationData = event.notification.data || {};

  const handleClick = async () => {
    // Handle specific actions
    if (event.action === 'whatsapp' && notificationData.whatsapp_url) {
      log('Opening WhatsApp');
      await clients.openWindow(notificationData.whatsapp_url);
      return;
    }

    if (event.action === 'dismiss') {
      log('Notification dismissed');
      return;
    }

    // Default: focus existing window or open new one
    const urlToOpen = new URL(notificationData.url || '/dashboard', self.location.origin).href;
    log('Opening URL:', urlToOpen);

    try {
      const windowClients = await clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });

      // Try to focus an existing window
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          await client.focus();
          if ('navigate' in client) {
            await client.navigate(urlToOpen);
          }
          return;
        }
      }

      // Open new window if none exists
      if (clients.openWindow) {
        await clients.openWindow(urlToOpen);
      }
    } catch (error) {
      log('Error handling notification click:', error.message);
    }
  };

  event.waitUntil(handleClick());
});

/**
 * Handle notification close
 */
self.addEventListener('notificationclose', (event) => {
  log('Notification closed', { tag: event.notification.tag });
});

/**
 * Handle push subscription change
 */
self.addEventListener('pushsubscriptionchange', (event) => {
  log('Push subscription changed');

  const handleSubscriptionChange = async () => {
    try {
      // Re-subscribe with the same options
      const subscription = await self.registration.pushManager.subscribe(
        event.oldSubscription.options
      );
      log('Re-subscribed successfully');

      // Notify the app about the new subscription
      const allClients = await clients.matchAll({ type: 'window' });
      for (const client of allClients) {
        client.postMessage({
          type: 'PUSH_SUBSCRIPTION_CHANGED',
          subscription: subscription.toJSON()
        });
      }
    } catch (error) {
      log('Error re-subscribing:', error.message);
    }
  };

  event.waitUntil(handleSubscriptionChange());
});

log('Custom Service Worker loaded');
