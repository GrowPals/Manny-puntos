import { supabase } from '@/lib/customSupabaseClient';
import { ERROR_MESSAGES } from '@/constants/errors';

// Verificar si el cliente existe y si tiene PIN registrado
export const checkClienteExists = async (telefono) => {
  const telefonoLimpio = String(telefono).replace(/\D/g, '');
  if (!/^[0-9]{10}$/.test(telefonoLimpio)) {
    throw new Error(ERROR_MESSAGES.AUTH.INVALID_PHONE_FORMAT);
  }

  const { data, error } = await supabase.rpc('check_cliente_exists', {
    telefono_input: telefonoLimpio
  });

  if (error) {
    console.error('Error checking cliente:', error);
    throw new Error(ERROR_MESSAGES.AUTH.CONNECTION_ERROR);
  }

  return data; // { exists: boolean, has_pin: boolean, cliente?: {...} }
};

// Login con PIN (para usuarios que ya tienen PIN) - Usa función segura con rate limiting
export const loginWithPin = async (telefono, pin) => {
  const telefonoLimpio = String(telefono).replace(/\D/g, '');

  const { data, error } = await supabase.rpc('verify_client_pin_secure', {
    telefono_input: telefonoLimpio,
    pin_input: pin
  });

  if (error) {
    console.error('Error verifying PIN:', error);
    throw new Error(ERROR_MESSAGES.AUTH.CONNECTION_ERROR);
  }

  if (!data || !data.success) {
    // Check for rate limiting
    if (data?.rate_limited) {
      throw new Error('Demasiados intentos. Por favor espera 5 minutos.');
    }
    throw new Error(data?.error || ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS);
  }

  return data.cliente;
};

// Login sin PIN (primera vez - para onboarding)
export const loginFirstTime = async (telefono) => {
  const result = await checkClienteExists(telefono);

  if (!result.exists) {
    throw new Error(ERROR_MESSAGES.AUTH.CLIENT_NOT_FOUND);
  }

  if (result.has_pin) {
    throw new Error('Este cliente ya tiene PIN registrado');
  }

  return {
    ...result.cliente,
    needsOnboarding: true
  };
};

// Registrar PIN (onboarding) - Usa función segura con hash bcrypt
export const registerPin = async (telefono, newPin) => {
  const telefonoLimpio = String(telefono).replace(/\D/g, '');

  const { data, error } = await supabase.rpc('register_client_pin_secure', {
    telefono_input: telefonoLimpio,
    pin_input: newPin
  });

  if (error) {
    console.error('Error registering PIN:', error);
    throw new Error(ERROR_MESSAGES.AUTH.CONNECTION_ERROR);
  }

  if (!data.success) {
    throw new Error(data.error || 'Error al registrar PIN');
  }

  return data.cliente;
};

// Resetear PIN (admin)
export const resetClientPin = async (clienteId) => {
  const { data, error } = await supabase.rpc('reset_client_pin', {
    cliente_id_input: clienteId
  });

  if (error) {
    console.error('Error resetting PIN:', error);
    throw new Error('Error al resetear PIN');
  }

  if (!data.success) {
    throw new Error(data.error || 'Error al resetear PIN');
  }

  return true;
};
