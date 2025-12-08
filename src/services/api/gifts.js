import { supabase } from '@/lib/customSupabaseClient';
import { withRetry } from '@/lib/utils';
import { ERROR_MESSAGES } from '@/constants/errors';
import { isValidPhone } from '@/config';
import { enqueueSyncOperation } from './sync';
import {
  notifyClienteBeneficioReclamado,
  notifyAdminsNuevoBeneficio,
  notifyClienteBeneficioUsado
} from './notifications';

// ==================== PÚBLICO ====================

/**
 * Obtiene info de un link de regalo por código (público)
 * Soporta links individuales y campañas masivas
 */
export const getGiftByCode = async (codigo) => {
  // Primero incrementar vistas usando RPC para increment atómico
  await supabase.rpc('incrementar_vistas_link', {
    p_codigo: codigo.toUpperCase()
  });

  const { data, error } = await supabase
    .from('links_regalo')
    .select(`
      id,
      codigo,
      tipo,
      nombre_beneficio,
      descripcion_beneficio,
      puntos_regalo,
      mensaje_personalizado,
      imagen_url,
      imagen_banner,
      color_tema,
      estado,
      fecha_expiracion,
      destinatario_telefono,
      es_campana,
      nombre_campana,
      max_canjes,
      canjes_realizados,
      terminos_condiciones,
      instrucciones_uso,
      vigencia_beneficio
    `)
    .eq('codigo', codigo.toUpperCase())
    .maybeSingle();

  if (error) {
    console.error('Error obteniendo regalo:', error);
    return null;
  }

  if (!data) return null;

  // Verificar expiración del link
  if (data.fecha_expiracion && new Date(data.fecha_expiracion) < new Date()) {
    data.estado = 'expirado';
  }

  // Para campañas, verificar si alcanzó el límite
  if (data.es_campana && data.max_canjes && data.canjes_realizados >= data.max_canjes) {
    data.estado = 'agotado';
  }

  return data;
};

/**
 * Canjea un link de regalo (usa la nueva función v3 con locking para race conditions)
 */
export const claimGift = async (codigo, telefono) => {
  // Validate inputs before sending to server
  const codigoLimpio = String(codigo).trim().toUpperCase();
  const telefonoLimpio = String(telefono).replace(/\D/g, '');

  if (!codigoLimpio || codigoLimpio.length < 6) {
    throw new Error(ERROR_MESSAGES.GIFTS.INVALID_CODE);
  }

  if (!isValidPhone(telefonoLimpio)) {
    throw new Error(ERROR_MESSAGES.GIFTS.INVALID_PHONE);
  }

  // Use retry logic for the critical gift claiming operation
  return await withRetry(
    async () => {
      const { data, error } = await supabase.rpc('canjear_link_regalo_v3', {
        p_codigo: codigoLimpio,
        p_telefono: telefonoLimpio
      });

      if (error) {
        console.error('Error canjeando regalo:', error);
        throw new Error(ERROR_MESSAGES.GIFTS.CLAIM_ERROR);
      }

      if (!data || !data.success) {
        // Don't retry business logic errors (already claimed, expired, etc.)
        const businessError = new Error(data?.error || 'No se pudo canjear el regalo');
        businessError.isBusinessError = true;
        throw businessError;
      }

      // Fire and forget: Send notifications
      if (data.cliente_id && data.nombre_beneficio) {
        notifyClienteBeneficioReclamado(data.cliente_id, data.nombre_beneficio);

        // Get client name for admin notification
        supabase
          .from('clientes')
          .select('nombre')
          .eq('id', data.cliente_id)
          .single()
          .then(({ data: cliente }) => {
            if (cliente?.nombre) {
              notifyAdminsNuevoBeneficio(cliente.nombre, data.nombre_beneficio);
            }
          })
          .catch(() => {}); // Silent fail
      }

      return data;
    },
    {
      shouldRetry: (error) => !error.isBusinessError
    }
  );
};

/**
 * Obtiene beneficios activos de un cliente
 */
export const getMisBeneficios = async (clienteId) => {
  const { data, error } = await supabase.rpc('get_beneficios_cliente', {
    p_cliente_id: clienteId
  });

  if (error) {
    console.error('Error obteniendo beneficios:', error);
    throw new Error(ERROR_MESSAGES.GIFTS.BENEFITS_LOAD_ERROR);
  }

  return data || [];
};

// ==================== ADMIN ====================

/**
 * Crea un nuevo link de regalo o campaña
 */
export const createGiftLink = async ({
  tipo,
  creado_por = null,
  nombre_beneficio = null,
  descripcion_beneficio = null,
  puntos_regalo = null,
  mensaje_personalizado = null,
  destinatario_telefono = null,
  dias_expiracion = 30,
  // Nuevos campos para campañas
  es_campana = false,
  nombre_campana = null,
  max_canjes = null,
  terminos_condiciones = null,
  instrucciones_uso = null,
  vigencia_beneficio = 365,
  imagen_banner = null,
  color_tema = '#E91E63'
}) => {
  // Generar código único
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let codigo = '';
  for (let i = 0; i < (es_campana ? 8 : 6); i++) {
    codigo += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const fechaExpiracion = new Date();
  fechaExpiracion.setDate(fechaExpiracion.getDate() + dias_expiracion);

  const { data, error } = await supabase
    .from('links_regalo')
    .insert({
      codigo,
      tipo,
      creado_por,
      nombre_beneficio,
      descripcion_beneficio,
      puntos_regalo,
      mensaje_personalizado,
      destinatario_telefono,
      fecha_expiracion: fechaExpiracion.toISOString(),
      es_campana,
      nombre_campana,
      max_canjes: es_campana ? max_canjes : 1,
      terminos_condiciones,
      instrucciones_uso,
      vigencia_beneficio,
      imagen_banner,
      color_tema,
      estado: 'pendiente',
      canjes_realizados: 0
    })
    .select()
    .single();

  if (error) {
    console.error('Error creando link:', error);
    throw new Error(ERROR_MESSAGES.GIFTS.CREATE_ERROR);
  }

  return {
    success: true,
    codigo: data.codigo,
    id: data.id,
    url: `${window.location.origin}/g/${data.codigo}`
  };
};

/**
 * Obtiene todos los links de regalo (admin)
 */
export const getAllGiftLinks = async () => {
  const { data, error } = await supabase
    .from('links_regalo')
    .select(`
      *,
      creador:creado_por (id, nombre),
      canjeador:canjeado_por (id, nombre, telefono)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error obteniendo links:', error);
    throw new Error(ERROR_MESSAGES.GIFTS.LOAD_ERROR);
  }

  return data || [];
};

/**
 * Obtiene estadísticas de links de regalo incluyendo campañas
 */
export const getGiftStats = async () => {
  const { data: links, error: e1 } = await supabase
    .from('links_regalo')
    .select('estado, tipo, puntos_regalo, veces_visto, es_campana, canjes_realizados');

  const { data: beneficios, error: e2 } = await supabase
    .from('beneficios_cliente')
    .select('estado, puntos_otorgados');

  if (e1) {
    console.error('Error obteniendo stats:', e1);
    throw new Error(ERROR_MESSAGES.GIFTS.STATS_ERROR);
  }

  const stats = {
    total: links?.length || 0,
    pendientes: links?.filter(l => l.estado === 'pendiente').length || 0,
    canjeados: links?.filter(l => l.estado === 'canjeado').length || 0,
    expirados: links?.filter(l => l.estado === 'expirado').length || 0,
    campanas: links?.filter(l => l.es_campana).length || 0,
    total_vistas: links?.reduce((sum, l) => sum + (l.veces_visto || 0), 0) || 0,
    total_canjes: links?.reduce((sum, l) => sum + (l.canjes_realizados || 0), 0) || 0,
    por_tipo: {
      servicio: links?.filter(l => l.tipo === 'servicio').length || 0,
      puntos: links?.filter(l => l.tipo === 'puntos').length || 0,
    },
    // Beneficios otorgados
    beneficios_activos: beneficios?.filter(b => b.estado === 'activo').length || 0,
    beneficios_usados: beneficios?.filter(b => b.estado === 'usado').length || 0,
    puntos_regalados: beneficios?.reduce((sum, b) => sum + (b.puntos_otorgados || 0), 0) || 0
  };

  return stats;
};

/**
 * Obtiene beneficios canjeados de un link específico
 */
export const getLinkBeneficiarios = async (linkId) => {
  const { data, error } = await supabase
    .from('beneficios_cliente')
    .select(`
      *,
      cliente:cliente_id (id, nombre, telefono)
    `)
    .eq('link_regalo_id', linkId)
    .order('fecha_canje', { ascending: false });

  if (error) {
    console.error('Error obteniendo beneficiarios:', error);
    throw new Error(ERROR_MESSAGES.GIFTS.BENEFICIARIES_ERROR);
  }

  return data || [];
};

/**
 * Obtiene beneficios de un cliente específico (admin)
 */
export const getClienteBeneficios = async (clienteId) => {
  const { data, error } = await supabase
    .from('beneficios_cliente')
    .select(`
      *,
      link:link_regalo_id (codigo, nombre_campana, imagen_banner)
    `)
    .eq('cliente_id', clienteId)
    .order('fecha_canje', { ascending: false });

  if (error) {
    console.error('Error obteniendo beneficios del cliente:', error);
    throw new Error(ERROR_MESSAGES.GIFTS.BENEFITS_LOAD_ERROR);
  }

  return data || [];
};

/**
 * Marca un beneficio como usado
 */
export const marcarBeneficioUsado = async (beneficioId, adminId, notas = null) => {
  // Get beneficio info before marking for notification
  const { data: beneficioInfo } = await supabase
    .from('beneficios_cliente')
    .select('cliente_id, nombre_beneficio')
    .eq('id', beneficioId)
    .single();

  const { data, error } = await supabase.rpc('marcar_beneficio_usado', {
    p_beneficio_id: beneficioId,
    p_admin_id: adminId,
    p_notas: notas
  });

  if (error) {
    console.error('Error marcando beneficio:', error);
    throw new Error(ERROR_MESSAGES.GIFTS.MARK_USED_ERROR);
  }

  if (!data.success) {
    throw new Error(data.error || 'No se pudo marcar el beneficio');
  }

  // Fire and forget: Notify client that their benefit was used
  if (beneficioInfo?.cliente_id) {
    notifyClienteBeneficioUsado(beneficioInfo.cliente_id);
  }

  return data;
};

/**
 * Cancela/expira un link de regalo
 */
export const expireGiftLink = async (linkId) => {
  const { data, error } = await supabase
    .from('links_regalo')
    .update({ estado: 'expirado' })
    .eq('id', linkId)
    .eq('estado', 'pendiente')
    .select()
    .single();

  if (error) {
    console.error('Error expirando link:', error);
    throw new Error(ERROR_MESSAGES.GIFTS.EXPIRE_ERROR);
  }

  return data;
};

/**
 * Elimina un link de regalo (solo si no tiene canjes)
 */
export const deleteGiftLink = async (linkId) => {
  // Primero verificar que no tenga beneficios asociados
  const { data: beneficios } = await supabase
    .from('beneficios_cliente')
    .select('id')
    .eq('link_regalo_id', linkId)
    .limit(1);

  if (beneficios && beneficios.length > 0) {
    throw new Error(ERROR_MESSAGES.GIFTS.DELETE_HAS_BENEFICIARIES);
  }

  const { error } = await supabase
    .from('links_regalo')
    .delete()
    .eq('id', linkId);

  if (error) {
    console.error('Error eliminando link:', error);
    throw new Error(ERROR_MESSAGES.GIFTS.DELETE_ERROR);
  }

  return true;
};

/**
 * Crea un ticket en Notion para un beneficio
 * Se llama automáticamente cuando un cliente reclama un beneficio de servicio
 * Ahora con fallback a cola de reintentos si falla
 */
export const createBenefitTicket = async (beneficioId) => {
  try {
    const { data, error } = await supabase.functions.invoke('create-reward-ticket', {
      body: { tipo: 'beneficio', id: beneficioId }
    });

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.warn('Direct Notion sync failed, queueing for retry:', error.message);

    // Queue for retry instead of failing silently
    await enqueueSyncOperation('create_benefit_ticket', beneficioId, {
      original_error: error.message
    }, 'gifts_service');

    // Return a pending status so the caller knows it's queued
    return {
      status: 'queued',
      message: 'El ticket será creado en breve',
      queued: true
    };
  }
};

