/**
 * Push Notification Service
 * Centralized service for sending push notifications via Supabase Edge Functions
 */

import { supabase } from '@/lib/customSupabaseClient';

/**
 * Send a push notification to a specific client
 * @param {string} tipo - Type of notification (must match NOTIFICATION_TEMPLATES in edge function)
 * @param {string} clienteId - Target client ID
 * @param {Object} data - Additional data for template placeholders
 * @param {string} url - URL to open when notification is clicked
 */
export const sendPushToClient = async (tipo, clienteId, data = {}, url = '/dashboard') => {
  if (!clienteId) {
    console.warn('[Notifications] Cannot send push: clienteId is required');
    return { success: false, error: 'Client ID required' };
  }

  try {
    const { data: result, error } = await supabase.functions.invoke('send-push-notification', {
      body: { tipo, cliente_id: clienteId, data, url }
    });

    if (error) {
      console.error('[Notifications] Error sending push to client:', error);
      return { success: false, error: error.message };
    }

    console.log('[Notifications] Push sent to client:', result);
    return { success: true, ...result };
  } catch (err) {
    console.error('[Notifications] Failed to send push:', err);
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
      console.error('[Notifications] Error sending push to admins:', error);
      return { success: false, error: error.message };
    }

    console.log('[Notifications] Push sent to admins:', result);
    return { success: true, ...result };
  } catch (err) {
    console.error('[Notifications] Failed to send push to admins:', err);
    return { success: false, error: err.message };
  }
};

// =====================================================
// NOTIFICATION TRIGGERS (fire and forget)
// These are wrapper functions that catch errors silently
// =====================================================

/**
 * Notify client when they successfully redeem points for a product
 * Called after registrarCanje succeeds
 */
export const notifyClienteCanjeRegistrado = (clienteId, productoNombre, puntosUsados) => {
  // Fire and forget - don't block the main flow
  sendPushToClient('canje_listo', clienteId, {
    producto: productoNombre
  }, '/mis-canjes').catch(() => {});
};

/**
 * Notify admins when a new redemption is created
 * Called after registrarCanje succeeds
 */
export const notifyAdminsNuevoCanje = (clienteNombre, productoNombre, puntosUsados) => {
  sendPushToAdmins('nuevo_canje', {
    cliente: clienteNombre,
    producto: productoNombre,
    puntos: puntosUsados
  }, '/admin/entregas').catch(() => {});
};

/**
 * Notify client when their redemption is ready for pickup
 * Called when estado changes to 'pendiente_entrega'
 */
export const notifyClienteCanjeListoParaRecoger = (clienteId, productoNombre) => {
  sendPushToClient('canje_listo', clienteId, {
    producto: productoNombre
  }, '/mis-canjes').catch(() => {});
};

/**
 * Notify client when their redemption has been delivered
 * Called when estado changes to 'entregado'
 */
export const notifyClienteCanjeEntregado = (clienteId) => {
  sendPushToClient('canje_completado', clienteId, {}, '/dashboard').catch(() => {});
};

/**
 * Notify client when they receive points from a service
 * Called after a service is registered in historial_servicios
 */
export const notifyClientePuntosRecibidos = (clienteId, puntos, concepto, saldoActual) => {
  sendPushToClient('puntos_recibidos', clienteId, {
    puntos,
    concepto: concepto || 'Servicio',
    saldo: saldoActual
  }, '/dashboard').catch(() => {});
};

/**
 * Notify client when a benefit is successfully claimed
 */
export const notifyClienteBeneficioReclamado = (clienteId, nombreBeneficio) => {
  sendPushToClient('beneficio_reclamado', clienteId, {
    nombre: nombreBeneficio
  }, '/dashboard').catch(() => {});
};

/**
 * Notify admins when a client claims a benefit
 */
export const notifyAdminsNuevoBeneficio = (clienteNombre, beneficioNombre) => {
  sendPushToAdmins('nuevo_beneficio', {
    cliente: clienteNombre,
    beneficio: beneficioNombre
  }, '/admin').catch(() => {});
};

/**
 * Notify client when their level changes (partner → vip)
 */
export const notifyClienteNivelCambiado = (clienteId, nuevoNivel) => {
  sendPushToClient('nivel_cambiado', clienteId, {
    nivel: nuevoNivel === 'vip' ? 'VIP' : 'Partner'
  }, '/dashboard').catch(() => {});
};

/**
 * Notify referidor when their referido is activated and they receive bonus points
 */
export const notifyReferidorReferidoActivado = (referidorId, referidoNombre, puntosGanados) => {
  sendPushToClient('referido_activado', referidorId, {
    referido: referidoNombre,
    puntos: puntosGanados
  }, '/mis-referidos').catch(() => {});
};

/**
 * Notify client when their benefit has been marked as used
 */
export const notifyClienteBeneficioUsado = (clienteId) => {
  sendPushToClient('beneficio_usado', clienteId, {}, '/dashboard').catch(() => {});
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
