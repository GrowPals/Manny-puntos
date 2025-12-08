/**
 * Centralized Configuration for Manny Rewards
 * All magic numbers, constants, and configuration values should be defined here.
 */

// ============================================
// CONTACT & WHATSAPP CONFIGURATION
// ============================================
export const CONTACT_CONFIG = {
  // Main WhatsApp number for general support
  WHATSAPP_MAIN: '5214625905222',
  // WhatsApp number for service scheduling
  WHATSAPP_SERVICES: '5214624844148',
  // Support email
  EMAIL: 'soporte@mannysoytupartner.com',
};

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
  // Default cache times - optimized for performance
  STALE_TIME: 15 * 60 * 1000, // 15 minutes - data doesn't change frequently
  GC_TIME: 30 * 60 * 1000, // 30 minutes garbage collection
  REFETCH_ON_WINDOW_FOCUS: false, // Prevent unnecessary refetches on tab switch
  REFETCH_ON_MOUNT: 'stale', // Only refetch if data is stale (valid values: false, true, 'stale')

  // Specific cache times for different data types
  PRODUCTS_STALE_TIME: 60 * 60 * 1000, // 1 hour - products rarely change
  USER_STALE_TIME: 10 * 60 * 1000, // 10 minutes - points may update
  REFERRALS_STALE_TIME: 5 * 60 * 1000, // 5 minutes - more dynamic
  ADMIN_STALE_TIME: 2 * 60 * 1000, // 2 minutes - admins need fresher data
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
  NAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 100,
  },
  PRODUCT: {
    NAME_MIN_LENGTH: 3,
    MIN_POINTS: 1,
    MIN_STOCK: 0,
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

/**
 * Validates a name (minimum 3 characters)
 */
export const isValidName = (name) => {
  const trimmed = String(name || '').trim();
  return trimmed.length >= VALIDATION.NAME.MIN_LENGTH && trimmed.length <= VALIDATION.NAME.MAX_LENGTH;
};

/**
 * Validates product form data
 * @returns {{ valid: boolean, errors: Object }}
 */
export const validateProductForm = (formData) => {
  const errors = {};

  if (!formData.nombre || formData.nombre.trim().length < VALIDATION.PRODUCT.NAME_MIN_LENGTH) {
    errors.nombre = `El nombre debe tener al menos ${VALIDATION.PRODUCT.NAME_MIN_LENGTH} caracteres`;
  }

  if (!formData.puntos_requeridos || Number(formData.puntos_requeridos) < VALIDATION.PRODUCT.MIN_POINTS) {
    errors.puntos_requeridos = 'Ingresa un número mayor a 0';
  }

  if (formData.tipo === 'producto' && (formData.stock === '' || formData.stock === null || Number(formData.stock) < VALIDATION.PRODUCT.MIN_STOCK)) {
    errors.stock = 'Ingresa el stock disponible';
  }

  return { valid: Object.keys(errors).length === 0, errors };
};

/**
 * Validates client form data
 * @returns {{ valid: boolean, errors: Object }}
 */
export const validateClientForm = (formData) => {
  const errors = {};

  if (!isValidName(formData.nombre)) {
    errors.nombre = `El nombre debe tener al menos ${VALIDATION.NAME.MIN_LENGTH} caracteres`;
  }

  if (!formData.telefono || !isValidPhone(formData.telefono)) {
    errors.telefono = 'Ingresa un teléfono válido de 10 dígitos';
  }

  return { valid: Object.keys(errors).length === 0, errors };
};

