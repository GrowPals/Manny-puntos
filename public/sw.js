/**
 * Manny Rewards - Service Worker
 * Development and fallback version
 *
 * In production, Workbox will generate sw.js with caching strategies.
 * This file is used in development or as a fallback.
 */

const SW_VERSION = '1.0.0';
const IS_DEV = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

// Import custom push notification handlers
importScripts('/sw-custom.js');

// Install event
self.addEventListener('install', (event) => {
  console.log(`[SW ${SW_VERSION}] Installing...`);
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log(`[SW ${SW_VERSION}] Activating...`);
  // Claim all clients immediately
  event.waitUntil(clients.claim());
});

// Fetch event - minimal caching for development
self.addEventListener('fetch', (event) => {
  // In development, pass through all requests
  if (IS_DEV) {
    return;
  }

  // In production (when used as fallback), use network-first strategy
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});

console.log(`[SW ${SW_VERSION}] Service Worker loaded (${IS_DEV ? 'development' : 'production'} mode)`);
