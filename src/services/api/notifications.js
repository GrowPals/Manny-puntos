/**
 * Push Notification Service
 * Centralized service for sending push notifications via Supabase Edge Functions
 */

import { supabase } from '@/lib/customSupabaseClient';
import { logger, EventType } from '@/lib/logger';

/**
 * Send a push notification to a specific client
 * @param {string} tipo - Type of notification (must match NOTIFICATION_TEMPLATES in edge function)
 * @param {string} clienteId - Target client ID
 * @param {Object} data - Additional data for template placeholders
 * @param {string} url - URL to open when notification is clicked
 */
export const sendPushToClient = async (tipo, clienteId, data = {}, url = '/dashboard') => {
  if (!clienteId) {
    logger.warn('Cannot send push: clienteId is required', { tipo }, EventType.PUSH_NOTIFICATION);
    return { success: false, error: 'Client ID required' };
  }

  try {
    const { data: result, error } = await supabase.functions.invoke('send-push-notification', {
      body: { tipo, cliente_id: clienteId, data, url }
    });

    if (error) {
      logger.error('Error sending push to client', { tipo, clienteId, error: error.message }, EventType.PUSH_NOTIFICATION);
      return { success: false, error: error.message };
    }

    logger.info('Push sent to client', { tipo, clienteId, sent: result?.sent }, EventType.PUSH_NOTIFICATION);
    return { success: true, ...result };
  } catch (err) {
    logger.error('Failed to send push', { tipo, clienteId, error: err.message }, EventType.PUSH_NOTIFICATION);
    return { success: false, error: err.message };
  }
};

/**
 * Send a push notification to all admin users
 * @param {string} tipo - Type of notification
 * @param {Object} data - Additional data for template placeholders
 * @param {string} url - URL to open when notification is clicked
 */
export const sendPushToAdmins = async (tipo, data = {}, url = '/admin') => {
  try {
    const { data: result, error } = await supabase.functions.invoke('send-push-notification', {
      body: { tipo, to_admins: true, data, url }
    });

    if (error) {
      logger.error('Error sending push to admins', { tipo, error: error.message }, EventType.PUSH_NOTIFICATION);
      return { success: false, error: error.message };
    }

    logger.info('Push sent to admins', { tipo, sent: result?.sent }, EventType.PUSH_NOTIFICATION);
    return { success: true, ...result };
  } catch (err) {
    logger.error('Failed to send push to admins', { tipo, error: err.message }, EventType.PUSH_NOTIFICATION);
    return { success: false, error: err.message };
  }
};

// =====================================================
// NOTIFICATION TRIGGERS (fire and forget with logging)
// These are wrapper functions that log errors but don't block
// =====================================================

/**
 * Helper to handle fire-and-forget notifications with proper logging
 */
const fireAndForget = (promise, context) => {
  promise.then(result => {
    if (!result.success) {
      logger.warn('Notification trigger failed', { context, error: result.error }, EventType.PUSH_NOTIFICATION);
    }
  }).catch(err => {
    logger.error('Notification trigger error', { context, error: err.message }, EventType.PUSH_NOTIFICATION);
  });
};

/**
 * Notify client when they successfully redeem points for a product
 * Called after registrarCanje succeeds
 */
export const notifyClienteCanjeRegistrado = (clienteId, productoNombre, puntosUsados) => {
  fireAndForget(
    sendPushToClient('canje_listo', clienteId, { producto: productoNombre }, '/mis-canjes'),
    { trigger: 'canje_registrado', clienteId, productoNombre }
  );
};

/**
 * Notify admins when a new redemption is created
 * Called after registrarCanje succeeds
 */
export const notifyAdminsNuevoCanje = (clienteNombre, productoNombre, puntosUsados) => {
  fireAndForget(
    sendPushToAdmins('nuevo_canje', { cliente: clienteNombre, producto: productoNombre, puntos: puntosUsados }, '/admin/entregas'),
    { trigger: 'nuevo_canje', clienteNombre, productoNombre }
  );
};

/**
 * Notify client when their redemption is ready for pickup
 * Called when estado changes to 'pendiente_entrega'
 */
export const notifyClienteCanjeListoParaRecoger = (clienteId, productoNombre) => {
  fireAndForget(
    sendPushToClient('canje_listo', clienteId, { producto: productoNombre }, '/mis-canjes'),
    { trigger: 'canje_listo', clienteId, productoNombre }
  );
};

/**
 * Notify client when their redemption has been delivered
 * Called when estado changes to 'entregado'
 */
export const notifyClienteCanjeEntregado = (clienteId) => {
  fireAndForget(
    sendPushToClient('canje_completado', clienteId, {}, '/dashboard'),
    { trigger: 'canje_entregado', clienteId }
  );
};

/**
 * Notify client when they receive points from a service
 * Called after a service is registered in historial_servicios
 */
export const notifyClientePuntosRecibidos = (clienteId, puntos, concepto, saldoActual) => {
  fireAndForget(
    sendPushToClient('puntos_recibidos', clienteId, { puntos, concepto: concepto || 'Servicio', saldo: saldoActual }, '/dashboard'),
    { trigger: 'puntos_recibidos', clienteId, puntos }
  );
};

/**
 * Notify client when a benefit is successfully claimed
 */
export const notifyClienteBeneficioReclamado = (clienteId, nombreBeneficio) => {
  fireAndForget(
    sendPushToClient('beneficio_reclamado', clienteId, { nombre: nombreBeneficio }, '/dashboard'),
    { trigger: 'beneficio_reclamado', clienteId, nombreBeneficio }
  );
};

/**
 * Notify admins when a client claims a benefit
 */
export const notifyAdminsNuevoBeneficio = (clienteNombre, beneficioNombre) => {
  fireAndForget(
    sendPushToAdmins('nuevo_beneficio', { cliente: clienteNombre, beneficio: beneficioNombre }, '/admin'),
    { trigger: 'nuevo_beneficio', clienteNombre, beneficioNombre }
  );
};

/**
 * Notify client when their level changes (partner → vip)
 */
export const notifyClienteNivelCambiado = (clienteId, nuevoNivel) => {
  fireAndForget(
    sendPushToClient('nivel_cambiado', clienteId, { nivel: nuevoNivel === 'vip' ? 'VIP' : 'Partner' }, '/dashboard'),
    { trigger: 'nivel_cambiado', clienteId, nuevoNivel }
  );
};

/**
 * Notify referidor when their referido is activated and they receive bonus points
 */
export const notifyReferidorReferidoActivado = (referidorId, referidoNombre, puntosGanados) => {
  fireAndForget(
    sendPushToClient('referido_activado', referidorId, { referido: referidoNombre, puntos: puntosGanados }, '/mis-referidos'),
    { trigger: 'referido_activado', referidorId, referidoNombre }
  );
};

/**
 * Notify client when their benefit has been marked as used
 */
export const notifyClienteBeneficioUsado = (clienteId) => {
  fireAndForget(
    sendPushToClient('beneficio_usado', clienteId, {}, '/dashboard'),
    { trigger: 'beneficio_usado', clienteId }
  );
};

export default {
  sendPushToClient,
  sendPushToAdmins,
  notifyClienteCanjeRegistrado,
  notifyAdminsNuevoCanje,
  notifyClienteCanjeListoParaRecoger,
  notifyClienteCanjeEntregado,
  notifyClientePuntosRecibidos,
  notifyClienteBeneficioReclamado,
  notifyAdminsNuevoBeneficio,
  notifyClienteNivelCambiado,
  notifyReferidorReferidoActivado,
  notifyClienteBeneficioUsado
};
