/**
 * Centralized Configuration for Manny Rewards
 * All magic numbers, constants, and configuration values should be defined here.
 */

// ============================================
// API & NETWORK CONFIGURATION
// ============================================
export const API_CONFIG = {
  // Request timeouts
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second base delay (exponential backoff)

  // Rate limiting
  MAX_PIN_ATTEMPTS: 5,
  PIN_LOCKOUT_MINUTES: 5,
};

// ============================================
// CACHE CONFIGURATION (React Query)
// ============================================
export const CACHE_CONFIG = {
  STALE_TIME: 5 * 60 * 1000, // 5 minutes
  GC_TIME: 10 * 60 * 1000, // 10 minutes (garbage collection)
  REFETCH_ON_WINDOW_FOCUS: true,
  REFETCH_ON_MOUNT: true,
};

// ============================================
// STORAGE CONFIGURATION
// ============================================
export const STORAGE_CONFIG = {
  MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  LOCAL_STORAGE_KEYS: {
    USER: 'manny_user',
    THEME: 'theme',
    PWA_PROMPT_DISMISSED: 'pwa-prompt-dismissed',
    PENDING_REFERRAL_CODE: 'pending_referral_code',
  },
};

// ============================================
// VALIDATION RULES
// ============================================
export const VALIDATION = {
  PHONE: {
    LENGTH: 10,
    PATTERN: /^\d{10}$/,
    INVALID_PATTERNS: [/^0{10}$/, /^1{10}$/, /^9{10}$/],
  },
  PIN: {
    LENGTH: 4,
    PATTERN: /^\d{4}$/,
  },
  REFERRAL_CODE: {
    MIN_LENGTH: 6,
    MAX_LENGTH: 8,
  },
  GIFT_CODE: {
    MIN_LENGTH: 6,
    MAX_LENGTH: 8,
  },
};

// ============================================
// BUSINESS RULES
// ============================================
export const BUSINESS_RULES = {
  // Points
  POINTS_PERCENTAGE: 0.05, // 5% of service amount
  MIN_POINTS_REDEMPTION: 100,

  // Referrals
  DEFAULT_REFERRAL_EXPIRY_DAYS: 90,
  DEFAULT_REFERRAL_POINTS_REFERIDOR: 100,
  DEFAULT_REFERRAL_POINTS_REFERIDO: 50,

  // Gifts
  DEFAULT_BENEFIT_EXPIRY_DAYS: 365,
  CAMPAIGN_CODE_LENGTH: 8,
  INDIVIDUAL_CODE_LENGTH: 6,

  // Levels
  LEVELS: {
    PARTNER: 'partner',
    VIP: 'vip',
    PREMIUM: 'premium',
  },
};

// ============================================
// UI CONFIGURATION
// ============================================
export const UI_CONFIG = {
  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  ADMIN_PAGE_SIZE: 50,

  // Animations
  CONFETTI_DURATION: 1500, // milliseconds
  TOAST_DURATION: 4000, // milliseconds
  REDIRECT_DELAY: 3000, // milliseconds after success

  // Debounce/Throttle
  SEARCH_DEBOUNCE: 300, // milliseconds

  // Colors (for charts and dynamic styling)
  CHART_COLORS: [
    '#E91E63', // Primary pink
    '#9C27B0', // Purple
    '#6366f1', // Indigo
    '#22c55e', // Green
    '#f59e0b', // Amber
    '#ef4444', // Red
  ],
};

// ============================================
// NOTION INTEGRATION
// ============================================
export const NOTION_CONFIG = {
  DATABASE_IDS: {
    MANNY_REWARDS: '2bfc6cfd-8c1e-8026-9291-e4bc8c18ee01',
    CONTACTOS: '17ac6cfd-8c1e-8068-8bc0-d32488189164',
    TICKETS: '17ac6cfd-8c1e-8162-b724-d4047a7e7635',
  },
  SYNC_BATCH_SIZE: 50,
  SYNC_DELAY_MS: 350, // Delay between API calls to avoid rate limits
};

// ============================================
// ERROR CODES (for structured error handling)
// ============================================
export const ERROR_CODES = {
  // Auth errors
  INVALID_CREDENTIALS: 'AUTH_001',
  RATE_LIMITED: 'AUTH_002',
  SESSION_EXPIRED: 'AUTH_003',

  // Gift errors
  GIFT_NOT_FOUND: 'GIFT_001',
  GIFT_EXPIRED: 'GIFT_002',
  GIFT_ALREADY_CLAIMED: 'GIFT_003',
  GIFT_CAMPAIGN_FULL: 'GIFT_004',
  GIFT_WRONG_RECIPIENT: 'GIFT_005',

  // Referral errors
  REFERRAL_NOT_FOUND: 'REF_001',
  REFERRAL_EXPIRED: 'REF_002',
  REFERRAL_SELF_REFERRAL: 'REF_003',
  REFERRAL_ALREADY_REFERRED: 'REF_004',
  REFERRAL_LIMIT_REACHED: 'REF_005',

  // Redemption errors
  INSUFFICIENT_POINTS: 'REDEEM_001',
  PRODUCT_UNAVAILABLE: 'REDEEM_002',

  // Network errors
  NETWORK_ERROR: 'NET_001',
  TIMEOUT: 'NET_002',
};

// ============================================
// FEATURE FLAGS
// ============================================
export const FEATURES = {
  PUSH_NOTIFICATIONS: import.meta.env.VITE_ENABLE_PUSH_NOTIFICATIONS !== 'false',
  PWA: import.meta.env.VITE_ENABLE_PWA !== 'false',
  NOTION_SYNC: import.meta.env.VITE_ENABLE_NOTION_SYNC !== 'false',
  DEBUG_MODE: import.meta.env.VITE_DEBUG_MODE === 'true',
};

// ============================================
// ENVIRONMENT
// ============================================
export const ENV = {
  IS_PRODUCTION: import.meta.env.PROD,
  IS_DEVELOPMENT: import.meta.env.DEV,
  BASE_URL: import.meta.env.BASE_URL || '/',
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Validates a Mexican phone number
 */
export const isValidPhone = (phone) => {
  const cleaned = String(phone).replace(/\D/g, '');
  if (!VALIDATION.PHONE.PATTERN.test(cleaned)) return false;
  return !VALIDATION.PHONE.INVALID_PATTERNS.some(pattern => pattern.test(cleaned));
};

/**
 * Normalizes a phone number (removes country code, non-digits)
 */
export const normalizePhone = (phone) => {
  let normalized = String(phone).replace(/\D/g, '');
  if (normalized.startsWith('52') && normalized.length > 11) {
    normalized = normalized.slice(2);
  }
  if (normalized.startsWith('1') && normalized.length === 11) {
    normalized = normalized.slice(1);
  }
  return normalized.slice(-10);
};

/**
 * Validates a PIN
 */
export const isValidPin = (pin) => {
  return VALIDATION.PIN.PATTERN.test(String(pin));
};

export default {
  API_CONFIG,
  CACHE_CONFIG,
  STORAGE_CONFIG,
  VALIDATION,
  BUSINESS_RULES,
  UI_CONFIG,
  NOTION_CONFIG,
  ERROR_CODES,
  FEATURES,
  ENV,
  isValidPhone,
  normalizePhone,
  isValidPin,
};
