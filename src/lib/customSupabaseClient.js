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

/**
 * Cliente Supabase con headers dinámicos
 * Envía x-cliente-id en cada request para RLS
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: () => {
      const clienteId = getCurrentClienteId();
      if (clienteId) {
        return { 'x-cliente-id': clienteId };
      }
      return {};
    }
  }
});

/**
 * Actualiza los headers del cliente cuando el usuario cambia
 * Llamar después de login/logout
 */
export const refreshSupabaseHeaders = () => {
  // Los headers se obtienen dinámicamente en cada request
  // Esta función existe para compatibilidad futura si se necesita
};
