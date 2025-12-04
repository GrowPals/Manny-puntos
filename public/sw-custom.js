// Custom Service Worker handlers for push notifications

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);

  let data = {
    title: 'Manny Rewards',
    body: 'Tienes una nueva notificación',
    icon: '/icons/isotipo.svg',
    badge: '/icons/isotipo.svg',
    data: { url: '/dashboard' }
  };

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (e) {
    console.warn('[SW] Could not parse push data:', e);
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/isotipo.svg',
    badge: data.badge || '/icons/isotipo.svg',
    vibrate: data.vibrate || [200, 100, 200],
    tag: data.tag || 'manny-notification',
    renotify: true,
    requireInteraction: false,
    data: data.data || { url: '/' }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);

  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if there's already a window open
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event);
});
