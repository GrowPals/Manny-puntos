import { supabase } from '@/lib/customSupabaseClient';

// ==================== CLIENTE ====================

/**
 * Obtiene o crea el código de referido de un cliente
 */
export const getOrCreateReferralCode = async (clienteId) => {
  const { data, error } = await supabase.rpc('get_or_create_referral_code', {
    p_cliente_id: clienteId
  });

  if (error) {
    console.error('Error obteniendo código de referido:', error);
    throw new Error('Error al obtener tu código de referido');
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
    console.error('Error obteniendo referidos:', refError);
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
    console.error('Error obteniendo referidos:', error);
    throw new Error('Error al cargar tus referidos');
  }

  return data || [];
};

/**
 * Valida un código de referido (para landing page)
 */
export const validateReferralCode = async (codigo) => {
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
    .eq('activo', true)
    .maybeSingle();

  if (error) {
    console.error('Error validando código:', error);
    return null;
  }

  return data;
};

/**
 * Aplica un código de referido a un cliente nuevo
 */
export const applyReferralCode = async (referidoId, codigo) => {
  const { data, error } = await supabase.rpc('aplicar_codigo_referido', {
    p_referido_id: referidoId,
    p_codigo: codigo.toUpperCase()
  });

  if (error) {
    console.error('Error aplicando código:', error);
    throw new Error('Error al aplicar el código de referido');
  }

  return data;
};

/**
 * Obtiene la configuración del programa (pública)
 */
export const getReferralConfig = async () => {
  const { data, error } = await supabase
    .from('config_referidos')
    .select('*')
    .eq('activo', true)
    .maybeSingle();

  if (error) {
    console.error('Error obteniendo config:', error);
    return null;
  }

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

  if (e1) throw new Error('Error cargando estadísticas');

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
    console.error('Error obteniendo todos los referidos:', error);
    throw new Error('Error al cargar referidos');
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
    console.error('Error obteniendo config admin:', error);
    throw new Error('Error al cargar configuración');
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
    console.error('Error actualizando config:', error);
    throw new Error('Error al guardar configuración');
  }

  return data;
};

/**
 * Cancela un referido manualmente (admin)
 */
export const cancelReferido = async (referidoId) => {
  const { data, error } = await supabase
    .from('referidos')
    .update({ estado: 'cancelado' })
    .eq('id', referidoId)
    .select()
    .single();

  if (error) {
    console.error('Error cancelando referido:', error);
    throw new Error('Error al cancelar referido');
  }

  return data;
};

/**
 * Activa un referido manualmente (admin override)
 */
export const activateReferidoManual = async (referidoId) => {
  const { data, error } = await supabase.rpc('activar_referido', {
    p_referido_id: referidoId
  });

  if (error) {
    console.error('Error activando referido:', error);
    throw new Error('Error al activar referido');
  }

  return data;
};
