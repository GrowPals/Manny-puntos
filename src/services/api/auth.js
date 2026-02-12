import { supabase } from '@/lib/customSupabaseClient';
import { ERROR_MESSAGES } from '@/constants/errors';
import { logger } from '@/lib/logger';

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
    logger.error('Error checking cliente', { error: error.message, telefono: telefonoLimpio });
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
    logger.error('Error verifying PIN', { error: error.message });
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
    logger.error('Error registering PIN', { error: error.message });
    throw new Error(ERROR_MESSAGES.AUTH.CONNECTION_ERROR);
  }

  if (!data.success) {
    throw new Error(data.error || 'Error al registrar PIN');
  }

  return data.cliente;
};

// Registrar nuevo cliente (auto-registro público)
export const registerNewClient = async (telefono, nombre) => {
  const telefonoLimpio = String(telefono).replace(/\D/g, '');
  const nombreLimpio = String(nombre).trim();

  if (!/^[0-9]{10}$/.test(telefonoLimpio)) {
    throw new Error(ERROR_MESSAGES.AUTH.INVALID_PHONE_FORMAT);
  }

  if (nombreLimpio.length < 3 || nombreLimpio.length > 100) {
    throw new Error(ERROR_MESSAGES.REGISTER.INVALID_NAME);
  }

  const { data, error } = await supabase.rpc('registrar_cliente_publico', {
    p_telefono: telefonoLimpio,
    p_nombre: nombreLimpio
  });

  if (error) {
    logger.error('Error registering new client', { error: error.message, telefono: telefonoLimpio });
    throw new Error(ERROR_MESSAGES.REGISTER.FAILED);
  }

  if (!data || !data.success) {
    throw new Error(data?.error || ERROR_MESSAGES.REGISTER.FAILED);
  }

  return data; // { success, cliente_nuevo, cliente: {...} }
};

// Resetear PIN (admin)
export const resetClientPin = async (clienteId) => {
  const { data, error } = await supabase.rpc('reset_client_pin', {
    cliente_id_input: clienteId
  });

  if (error) {
    logger.error('Error resetting PIN', { error: error.message, clienteId });
    throw new Error('Error al resetear PIN');
  }

  if (!data.success) {
    throw new Error(data.error || 'Error al resetear PIN');
  }

  return true;
};
