import { createClient } from '@supabase/supabase-js';
import { STORAGE_CONFIG } from '@/config';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase configuration. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.'
  );
}

/**
 * Obtiene el cliente_id del usuario actual desde localStorage
 * Se usa para enviar en headers de cada request a Supabase
 */
const getCurrentClienteId = () => {
  try {
    const stored = localStorage.getItem(STORAGE_CONFIG.LOCAL_STORAGE_KEYS.USER);
    if (stored) {
      const user = JSON.parse(stored);
      return user?.id || null;
    }
  } catch {
    // Silent fail - no user logged in
  }
  return null;
};

// Supabase client instance - will be recreated when user changes
let _supabaseClient = null;
let _currentClienteId = null;

/**
 * Creates a new Supabase client with the current user's headers
 */
const createSupabaseClient = (clienteId) => {
  const headers = clienteId ? { 'x-cliente-id': clienteId } : {};
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers }
  });
};

/**
 * Gets the Supabase client, recreating it if the user changed
 * This ensures headers are always in sync with the current user
 */
const getSupabaseClient = () => {
  const clienteId = getCurrentClienteId();

  // Recreate client if user changed
  if (_supabaseClient === null || _currentClienteId !== clienteId) {
    _currentClienteId = clienteId;
    _supabaseClient = createSupabaseClient(clienteId);
  }

  return _supabaseClient;
};

/**
 * Proxy that always returns the current Supabase client
 * This allows using `supabase.from(...)` syntax while ensuring
 * the client is always up-to-date with the current user
 */
export const supabase = new Proxy({}, {
  get(target, prop) {
    const client = getSupabaseClient();
    const value = client[prop];
    // Bind methods to the client instance
    return typeof value === 'function' ? value.bind(client) : value;
  }
});

/**
 * Forces recreation of the Supabase client
 * Call this after login/logout to ensure headers are updated
 */
export const refreshSupabaseHeaders = () => {
  _currentClienteId = null;
  _supabaseClient = null;
};
