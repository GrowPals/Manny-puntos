import { supabase } from '@/lib/customSupabaseClient';
import { withRetry } from '@/lib/utils';
import { ERROR_MESSAGES } from '@/constants/errors';
import { logger } from '@/lib/logger';

// ==================== CLIENTE ====================

/**
 * Obtiene o crea el código de referido de un cliente
 */
export const getOrCreateReferralCode = async (clienteId) => {
  const { data, error } = await supabase.rpc('get_or_create_referral_code', {
    p_cliente_id: clienteId
  });

  if (error) {
    logger.error('Error obteniendo código de referido', { error: error.message, clienteId });
    throw new Error(ERROR_MESSAGES.REFERRALS.CODE_ERROR);
  }

  return data?.[0] || null;
};

/**
 * Obtiene estadísticas de referidos de un cliente (incluye código)
 */
export const getReferralStats = async (clienteId) => {
  // Primero obtener o crear el código
  const codeResult = await getOrCreateReferralCode(clienteId);
  const codigo = codeResult?.codigo;

  // Obtener referidos del cliente
  const { data: referidos, error: refError } = await supabase
    .from('referidos')
    .select('estado, puntos_referidor, created_at')
    .eq('referidor_id', clienteId);

  if (refError) {
    logger.error('Error obteniendo referidos para stats', { error: refError.message, clienteId });
  }

  // Obtener config para límites
  const config = await getReferralConfig();

  // Calcular stats
  const activos = referidos?.filter(r => r.estado === 'activo') || [];
  const pendientes = referidos?.filter(r => r.estado === 'pendiente') || [];
  const puntosGanados = activos.reduce((sum, r) => sum + (r.puntos_referidor || 0), 0);

  // Calcular puntos este mes
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const puntosEsteMes = activos
    .filter(r => new Date(r.created_at) >= inicioMes)
    .reduce((sum, r) => sum + (r.puntos_referidor || 0), 0);

  return {
    codigo,
    referidos_activos: activos.length,
    referidos_pendientes: pendientes.length,
    puntos_ganados: puntosGanados,
    puntos_este_mes: puntosEsteMes,
    limite_mensual: config?.limite_mensual || 0,
    limite_total: config?.limite_total || 0
  };
};

/**
 * Obtiene la lista de referidos de un cliente
 */
export const getMisReferidos = async (clienteId) => {
  const { data, error } = await supabase
    .from('referidos')
    .select(`
      id,
      estado,
      puntos_referidor,
      fecha_activacion,
      fecha_expiracion,
      created_at,
      referido:referido_id (
        id,
        nombre,
        telefono
      )
    `)
    .eq('referidor_id', clienteId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Error obteniendo mis referidos', { error: error.message, clienteId });
    throw new Error(ERROR_MESSAGES.REFERRALS.LOAD_ERROR);
  }

  return data || [];
};

/**
 * Valida un código de referido (para landing page)
 * Retorna objeto con status para diferenciar entre código inexistente vs inactivo
 * @returns {{ valid: boolean, data: object|null, reason: string|null }}
 */
export const validateReferralCode = async (codigo) => {
  // Primero buscar el código sin filtrar por activo
  const { data, error } = await supabase
    .from('codigos_referido')
    .select(`
      codigo,
      activo,
      cliente:cliente_id (
        id,
        nombre
      )
    `)
    .eq('codigo', codigo.toUpperCase())
    .maybeSingle();

  if (error) {
    logger.error('Error validando código de referido', { error: error.message, codigo });
    throw new Error(ERROR_MESSAGES.REFERRALS.VALIDATION_ERROR || 'Error al validar código');
  }

  // Código no existe
  if (!data) {
    return { valid: false, data: null, reason: 'not_found' };
  }

  // Código existe pero está inactivo
  if (!data.activo) {
    logger.info('Código de referido inactivo', { codigo });
    return { valid: false, data: null, reason: 'inactive' };
  }

  // Código válido y activo
  return { valid: true, data, reason: null };
};

/**
 * Aplica un código de referido a un cliente nuevo (usa v2 con locking)
 */
export const applyReferralCode = async (referidoId, codigo) => {
  const codigoLimpio = String(codigo).trim().toUpperCase();

  if (!codigoLimpio || codigoLimpio.length < 6) {
    throw new Error(ERROR_MESSAGES.REFERRALS.INVALID_CODE);
  }

  // Use retry logic for this critical operation
  return await withRetry(
    async () => {
      const { data, error } = await supabase.rpc('aplicar_codigo_referido_v2', {
        p_referido_id: referidoId,
        p_codigo: codigoLimpio
      });

      if (error) {
        logger.error('Error aplicando código de referido', { error: error.message, codigo: codigoLimpio, referidoId });
        throw new Error(ERROR_MESSAGES.REFERRALS.APPLY_ERROR);
      }

      if (!data || !data.success) {
        // Don't retry business logic errors
        const businessError = new Error(data?.error || 'No se pudo aplicar el código');
        businessError.isBusinessError = true;
        throw businessError;
      }

      return data;
    },
    {
      shouldRetry: (error) => !error.isBusinessError
    }
  );
};

/**
 * Obtiene la configuración del programa (pública)
 * Returns null if no active config exists (not an error)
 * Throws on database errors
 */
export const getReferralConfig = async () => {
  const { data, error } = await supabase
    .from('config_referidos')
    .select('*')
    .eq('activo', true)
    .maybeSingle();

  if (error) {
    logger.error('Error obteniendo config de referidos', { error: error.message });
    throw new Error(ERROR_MESSAGES.REFERRALS.CONFIG_LOAD_ERROR || 'Error al cargar configuración');
  }

  // null is valid - means no active config
  return data;
};

// ==================== ADMIN ====================

/**
 * Obtiene estadísticas globales del programa de referidos
 */
export const getAdminReferralStats = async () => {
  // Total de referidos por estado
  const { data: referidosPorEstado, error: e1 } = await supabase
    .from('referidos')
    .select('estado');

  if (e1) throw new Error(ERROR_MESSAGES.REFERRALS.STATS_ERROR);

  const stats = {
    total: referidosPorEstado?.length || 0,
    activos: referidosPorEstado?.filter(r => r.estado === 'activo').length || 0,
    pendientes: referidosPorEstado?.filter(r => r.estado === 'pendiente').length || 0,
    expirados: referidosPorEstado?.filter(r => r.estado === 'expirado').length || 0,
  };

  // Puntos totales otorgados
  const { data: puntosData, error: e2 } = await supabase
    .from('referidos')
    .select('puntos_referidor, puntos_referido')
    .eq('estado', 'activo');

  if (!e2 && puntosData) {
    stats.puntos_referidores = puntosData.reduce((sum, r) => sum + (r.puntos_referidor || 0), 0);
    stats.puntos_referidos = puntosData.reduce((sum, r) => sum + (r.puntos_referido || 0), 0);
    stats.puntos_totales = stats.puntos_referidores + stats.puntos_referidos;
  }

  // Top referidores
  const { data: topReferidores, error: e3 } = await supabase
    .from('referidos')
    .select(`
      referidor_id,
      referidor:referidor_id (nombre, telefono)
    `)
    .eq('estado', 'activo');

  if (!e3 && topReferidores) {
    const conteo = {};
    topReferidores.forEach(r => {
      const id = r.referidor_id;
      if (!conteo[id]) {
        conteo[id] = { ...r.referidor, count: 0 };
      }
      conteo[id].count++;
    });

    stats.top_referidores = Object.values(conteo)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  return stats;
};

/**
 * Obtiene todos los referidos (admin)
 */
export const getAllReferidos = async () => {
  const { data, error } = await supabase
    .from('referidos')
    .select(`
      *,
      referidor:referidor_id (id, nombre, telefono),
      referido:referido_id (id, nombre, telefono)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Error obteniendo todos los referidos (admin)', { error: error.message });
    throw new Error(ERROR_MESSAGES.REFERRALS.ALL_LOAD_ERROR);
  }

  return data || [];
};

/**
 * Obtiene la configuración completa (admin)
 */
export const getAdminReferralConfig = async () => {
  const { data, error } = await supabase
    .from('config_referidos')
    .select('*')
    .limit(1)
    .single();

  if (error) {
    logger.error('Error obteniendo config admin de referidos', { error: error.message });
    throw new Error(ERROR_MESSAGES.REFERRALS.CONFIG_LOAD_ERROR);
  }

  return data;
};

/**
 * Actualiza la configuración del programa (admin)
 * Recibe el objeto config completo (con id incluido)
 */
export const updateReferralConfig = async (config) => {
  const { id, created_at, ...updates } = config;

  const { data, error } = await supabase
    .from('config_referidos')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error('Error actualizando config de referidos', { error: error.message, configId: id });
    throw new Error(ERROR_MESSAGES.REFERRALS.CONFIG_SAVE_ERROR);
  }

  return data;
};
