import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { API_CONFIG } from '@/config'
import { logger } from '@/lib/logger'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * Retry an async operation with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxAttempts - Maximum number of attempts (default: 3)
 * @param {number} options.baseDelay - Base delay in ms (default: 1000)
 * @param {Function} options.shouldRetry - Function to determine if error is retryable
 * @returns {Promise} - Result of the function
 */
export async function withRetry(fn, options = {}) {
  const {
    maxAttempts = API_CONFIG.RETRY_ATTEMPTS,
    baseDelay = API_CONFIG.RETRY_DELAY,
    shouldRetry = (error) => {
      // Retry on network errors or 5xx server errors
      const message = error?.message?.toLowerCase() || '';
      return (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('fetch') ||
        error?.status >= 500
      );
    }
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !shouldRetry(error)) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s, etc.
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Format a number as currency (MXN)
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(amount);
}

/**
 * Format a date in Spanish locale
 */
export function formatDate(date, options = {}) {
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options
  };
  return new Date(date).toLocaleDateString('es-MX', defaultOptions);
}

/**
 * Safe localStorage operations with error handling
 */
export const safeStorage = {
  get: (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      logger.warn('Failed to save to localStorage', { key });
      return false;
    }
  },

  remove: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },

  // For storing raw strings (non-JSON) - used by ThemeContext
  getString: (key, defaultValue = null) => {
    try {
      return localStorage.getItem(key) ?? defaultValue;
    } catch {
      return defaultValue;
    }
  },

  setString: (key, value) => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      logger.warn('Failed to save string to localStorage', { key });
      return false;
    }
  },
};

/**
 * Call a Supabase edge function with timeout and retry
 * @param {Object} supabase - Supabase client
 * @param {string} functionName - Name of the edge function
 * @param {Object} body - Request body
 * @param {Object} options - Options (timeout, retries)
 * @returns {Promise<Object>} - Response data
 */
export async function callEdgeFunction(supabase, functionName, body = {}, options = {}) {
  const { timeout = 30000, retries = 2 } = options;

  const invokeWithTimeout = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body,
        signal: controller.signal,
      });

      if (error) throw error;
      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Edge function '${functionName}' timeout after ${timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  return withRetry(invokeWithTimeout, { maxAttempts: retries });
}