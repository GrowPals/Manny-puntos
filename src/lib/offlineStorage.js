/**
 * IndexedDB Offline Storage for Manny Rewards
 * Provides persistent offline caching for critical data
 */

import { logger } from '@/lib/logger';

const DB_NAME = 'manny-rewards-offline';
const DB_VERSION = 1;

// Store names
const STORES = {
  USER_DATA: 'userData',
  PRODUCTS: 'products',
  SERVICES: 'services',
  REFERRAL_STATS: 'referralStats',
  SYNC_QUEUE: 'syncQueue',
};

let dbInstance = null;
let dbOpenPromise = null;

/**
 * Check if IndexedDB is available
 */
const isIndexedDBAvailable = () => {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
};

/**
 * Opens or creates the IndexedDB database
 * Uses singleton pattern to prevent multiple simultaneous open attempts
 */
const openDB = () => {
  // If IndexedDB is not available, reject immediately
  if (!isIndexedDBAvailable()) {
    return Promise.reject(new Error('IndexedDB not available'));
  }

  // Return existing instance if available
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  // Return existing open promise if in progress (prevents race condition)
  if (dbOpenPromise) {
    return dbOpenPromise;
  }

  dbOpenPromise = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        logger.error('IndexedDB error', { error: request.error?.message });
        dbOpenPromise = null;
        reject(request.error);
      };

      request.onsuccess = () => {
        dbInstance = request.result;

        // Handle connection closing unexpectedly
        dbInstance.onclose = () => {
          dbInstance = null;
          dbOpenPromise = null;
        };

        // Handle version change (another tab upgraded)
        dbInstance.onversionchange = () => {
          dbInstance.close();
          dbInstance = null;
          dbOpenPromise = null;
        };

        resolve(dbInstance);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // User data store
        if (!db.objectStoreNames.contains(STORES.USER_DATA)) {
          db.createObjectStore(STORES.USER_DATA, { keyPath: 'id' });
        }

        // Products store
        if (!db.objectStoreNames.contains(STORES.PRODUCTS)) {
          const productStore = db.createObjectStore(STORES.PRODUCTS, { keyPath: 'id' });
          productStore.createIndex('activo', 'activo', { unique: false });
        }

        // Services store (user's services)
        if (!db.objectStoreNames.contains(STORES.SERVICES)) {
          const serviceStore = db.createObjectStore(STORES.SERVICES, { keyPath: 'id' });
          serviceStore.createIndex('cliente_id', 'cliente_id', { unique: false });
        }

        // Referral stats store
        if (!db.objectStoreNames.contains(STORES.REFERRAL_STATS)) {
          db.createObjectStore(STORES.REFERRAL_STATS, { keyPath: 'userId' });
        }

        // Sync queue for offline actions
        if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
          const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id', autoIncrement: true });
          syncStore.createIndex('status', 'status', { unique: false });
          syncStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };

      request.onblocked = () => {
        logger.warn('IndexedDB blocked - close other tabs');
        dbOpenPromise = null;
        reject(new Error('Database blocked'));
      };
    } catch (error) {
      dbOpenPromise = null;
      reject(error);
    }
  });

  return dbOpenPromise;
};

/**
 * Generic function to save data to a store
 */
const saveToStore = async (storeName, data) => {
  try {
    const db = await openDB();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    if (Array.isArray(data)) {
      for (const item of data) {
        store.put({ ...item, _cachedAt: Date.now() });
      }
    } else {
      store.put({ ...data, _cachedAt: Date.now() });
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    logger.error(`Error saving to ${storeName}`, { error: error.message });
    return false;
  }
};

/**
 * Generic function to get data from a store
 */
const getFromStore = async (storeName, key = null) => {
  try {
    const db = await openDB();
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = key ? store.get(key) : store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    logger.error(`Error reading from ${storeName}`, { error: error.message });
    return key ? null : [];
  }
};

/**
 * Clear all data from a store
 */
const clearStore = async (storeName) => {
  try {
    const db = await openDB();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.clear();

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    logger.error(`Error clearing ${storeName}`, { error: error.message });
    return false;
  }
};

/**
 * Check if cached data is still valid
 */
const isCacheValid = (cachedData, maxAgeMs) => {
  if (!cachedData || !cachedData._cachedAt) return false;
  return Date.now() - cachedData._cachedAt < maxAgeMs;
};

// ============================================
// PUBLIC API
// ============================================

export const offlineStorage = {
  // User Data
  async saveUser(userData) {
    return saveToStore(STORES.USER_DATA, userData);
  },

  async getUser(userId) {
    return getFromStore(STORES.USER_DATA, userId);
  },

  async clearUser() {
    return clearStore(STORES.USER_DATA);
  },

  // Products
  async saveProducts(products) {
    await clearStore(STORES.PRODUCTS);
    return saveToStore(STORES.PRODUCTS, products);
  },

  async getProducts() {
    return getFromStore(STORES.PRODUCTS);
  },

  async getActiveProducts() {
    const products = await getFromStore(STORES.PRODUCTS);
    return products.filter(p => p.activo);
  },

  // Services
  async saveServices(services, clienteId) {
    // Clear only this client's services
    const allServices = await getFromStore(STORES.SERVICES);
    const otherServices = allServices.filter(s => s.cliente_id !== clienteId);
    await clearStore(STORES.SERVICES);
    if (otherServices.length) {
      await saveToStore(STORES.SERVICES, otherServices);
    }
    return saveToStore(STORES.SERVICES, services);
  },

  async getServices(clienteId) {
    const services = await getFromStore(STORES.SERVICES);
    return services.filter(s => s.cliente_id === clienteId);
  },

  // Referral Stats
  async saveReferralStats(userId, stats) {
    return saveToStore(STORES.REFERRAL_STATS, { ...stats, userId });
  },

  async getReferralStats(userId) {
    return getFromStore(STORES.REFERRAL_STATS, userId);
  },

  // Sync Queue for offline actions
  async addToSyncQueue(action) {
    try {
      const db = await openDB();
      const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
      const store = tx.objectStore(STORES.SYNC_QUEUE);

      store.add({
        ...action,
        status: 'pending',
        createdAt: Date.now(),
        retries: 0,
      });

      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch (error) {
      logger.error('Error adding to sync queue', { error: error.message });
      return false;
    }
  },

  async getPendingSyncActions() {
    try {
      const db = await openDB();
      const tx = db.transaction(STORES.SYNC_QUEUE, 'readonly');
      const store = tx.objectStore(STORES.SYNC_QUEUE);
      const index = store.index('status');

      return new Promise((resolve, reject) => {
        const request = index.getAll('pending');
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      logger.error('Error getting pending sync actions', { error: error.message });
      return [];
    }
  },

  async removeSyncAction(id) {
    try {
      const db = await openDB();
      const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
      const store = tx.objectStore(STORES.SYNC_QUEUE);
      store.delete(id);

      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch (error) {
      logger.error('Error removing sync action', { error: error.message });
      return false;
    }
  },

  async updateSyncAction(id, updates) {
    try {
      const db = await openDB();
      const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
      const store = tx.objectStore(STORES.SYNC_QUEUE);

      return new Promise((resolve, reject) => {
        const getRequest = store.get(id);
        getRequest.onsuccess = () => {
          const item = getRequest.result;
          if (item) {
            store.put({ ...item, ...updates });
          }
        };
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch (error) {
      logger.error('Error updating sync action', { error: error.message });
      return false;
    }
  },

  // Cache validation
  isCacheValid,

  // Check if IndexedDB is available
  isAvailable: isIndexedDBAvailable,

  // Clear all offline data (logout)
  // IMPORTANT: Also clears sync queue to prevent actions from wrong user being synced
  async clearAll() {
    if (!isIndexedDBAvailable()) return;

    try {
      await Promise.all([
        clearStore(STORES.USER_DATA),
        clearStore(STORES.PRODUCTS),
        clearStore(STORES.SERVICES),
        clearStore(STORES.REFERRAL_STATS),
        clearStore(STORES.SYNC_QUEUE), // Clear pending actions to prevent cross-account sync issues
      ]);
    } catch (error) {
      logger.error('Error clearing offline storage', { error: error.message });
    }
  },

  // Clear only sync queue (use when user cancels pending operations)
  async clearSyncQueue() {
    if (!isIndexedDBAvailable()) return;
    return clearStore(STORES.SYNC_QUEUE);
  },
};

export default offlineStorage;
