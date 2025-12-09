import { supabase } from '@/lib/customSupabaseClient';
import { ERROR_MESSAGES } from '@/constants/errors';
import { isValidPhone, normalizePhone, isValidName } from '@/config';
import { enqueueSyncOperation } from './sync';
import { notifyClienteNivelCambiado, notifyClientePuntosRecibidos } from './notifications';
import { logger } from '@/lib/logger';
import { callEdgeFunction } from '@/lib/utils';

// COLUMNAS VERIFICADAS clientes: id, created_at, nombre, telefono, puntos_actuales, es_admin, ultimo_servicio, fecha_ultimo_servicio, fecha_registro, last_sync_at, notion_page_id, nivel, sync_source, pin, has_pin, referido_por, notion_reward_id, pin_hash, login_attempts, last_login_attempt, updated_at
// NOTA: pin_hash NUNCA se expone - solo se usa en funciones RPC SECURITY DEFINER

export const getTodosLosClientes = async ({ limit = 1000, offset = 0 } = {}) => {
  const { data, error, count } = await supabase
    .from('clientes')
    .select('id, telefono, nombre, puntos_actuales, nivel, es_admin, notion_page_id, notion_reward_id, created_at, updated_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    logger.error('Error obteniendo todos los clientes', { error: error.message });
    throw new Error(ERROR_MESSAGES.CLIENTS.LOAD_ERROR);
  }
  return { data: data || [], count: count || 0, hasMore: (offset + limit) < (count || 0) };
};

export const crearOActualizarCliente = async (clienteData) => {
  if (!isValidName(clienteData.nombre)) throw new Error(ERROR_MESSAGES.CLIENTS.NAME_REQUIRED);
  if (!clienteData.telefono || !isValidPhone(clienteData.telefono)) throw new Error(ERROR_MESSAGES.CLIENTS.PHONE_REQUIRED);

  // Normalize phone number
  clienteData.telefono = normalizePhone(clienteData.telefono);

  const upsertPayload = {
    ...clienteData,
    puntos_actuales: Number(clienteData.puntos_actuales) || 0,
  };

  const { data, error } = await supabase.from('clientes').upsert(upsertPayload).select().single();

  if (error) {
    logger.error('Error creando/actualizando cliente', { error: error.message, telefono: clienteData.telefono });
    if (error.code === '23505') {
        throw new Error(ERROR_MESSAGES.CLIENTS.PHONE_EXISTS);
    }
    if (error.message.includes('violates row-level security policy')) {
            throw new Error(ERROR_MESSAGES.CLIENTS.CREATE_PERMISSION_DENIED);
    }
    throw new Error(ERROR_MESSAGES.CLIENTS.SAVE_ERROR);
  }
  return data;
};

export const asignarPuntosManualmente = async (clienteTelefono, puntos, concepto) => {
  if (!puntos || isNaN(Number(puntos))) throw new Error(ERROR_MESSAGES.CLIENTS.POINTS_INVALID);
  if (!concepto || concepto.trim() === '') throw new Error(ERROR_MESSAGES.CLIENTS.CONCEPT_REQUIRED);

  const { data, error } = await supabase.rpc('asignar_puntos_atomico', {
    p_cliente_telefono: clienteTelefono,
    p_puntos_a_sumar: Number(puntos),
    p_concepto: concepto
  });

  if (error) {
    logger.error('Error asignando puntos', { error: error.message, telefono: clienteTelefono, puntos });
    throw new Error(error.message || ERROR_MESSAGES.CLIENTS.ASSIGN_POINTS_ERROR);
  }

  // Fire and forget: Notify client about points received
  if (data?.cliente_id && Number(puntos) > 0) {
    notifyClientePuntosRecibidos(data.cliente_id, Number(puntos), concepto, data.nuevo_saldo);
  }

  return data;
};

export const getClienteHistorial = async (telefono) => {
    const { data, error } = await supabase
        .from('clientes')
        .select(`id, historial_puntos(*), canjes(*, productos(id, nombre, tipo))`)
        .eq('telefono', telefono)
        .maybeSingle();

    if (error) throw new Error(ERROR_MESSAGES.CLIENTS.HISTORY_ERROR);

    if (!data) return { canjes: [], historialPuntos: [] };

    const canjesMapeados = data.canjes?.map(c => ({
        id: c.id,
        fecha: c.created_at,
        puntos_usados: c.puntos_usados,
        estado: c.estado,
        producto_nombre: c.productos?.nombre || 'Producto Eliminado',
        tipo: c.productos?.tipo || c.tipo_producto_original,
    })) || [];

    return { canjes: canjesMapeados, historialPuntos: data.historial_puntos || [] };
};

// ADMIN: Obtener detalle completo de un cliente por ID
export const getClienteDetalleAdmin = async (clienteId) => {
    // COLUMNAS VERIFICADAS: id, created_at, nombre, telefono, puntos_actuales, es_admin, nivel, notion_page_id, notion_reward_id, has_pin, updated_at
    const { data: cliente, error: clienteError } = await supabase
        .from('clientes')
        .select('id, telefono, nombre, puntos_actuales, nivel, es_admin, notion_page_id, notion_reward_id, has_pin, created_at, updated_at')
        .eq('id', clienteId)
        .single();

    if (clienteError) throw new Error(ERROR_MESSAGES.CLIENTS.NOT_FOUND);

    const { data: canjes, error: canjesError } = await supabase
        .from('canjes')
        .select(`
            id, created_at, cliente_id, producto_id, puntos_usados, estado,
            fecha_entrega, tipo_producto_original, notion_page_id, notion_ticket_id, notion_reward_id,
            productos(nombre, tipo)
        `)
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });

    if (canjesError) throw new Error(ERROR_MESSAGES.CLIENTS.LOAD_REDEMPTIONS_ERROR);

    const { data: historialPuntos, error: historialError } = await supabase
        .from('historial_puntos')
        .select('id, cliente_id, puntos, concepto, canje_id, created_at')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });

    if (historialError) throw new Error(ERROR_MESSAGES.CLIENTS.LOAD_POINTS_ERROR);

    const { data: serviciosAsignados, error: serviciosError } = await supabase
        .from('servicios_asignados')
        .select('id, cliente_id, nombre, descripcion, estado, fecha_canje, created_at')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });

    if (serviciosError) throw new Error(ERROR_MESSAGES.CLIENTS.LOAD_SERVICES_ERROR);

    // Historial de servicios (trabajos realizados por Manny)
    const { data: historialServicios, error: histServError } = await supabase
        .from('historial_servicios')
        .select('id, cliente_id, notion_ticket_id, ticket_number, tipo_trabajo, titulo, descripcion, monto, puntos_generados, fecha_servicio, created_at')
        .eq('cliente_id', clienteId)
        .order('fecha_servicio', { ascending: false });

    if (histServError) throw new Error(ERROR_MESSAGES.CLIENTS.LOAD_HISTORY_SERVICES_ERROR);

    // Estadísticas calculadas
    const stats = {
        total_servicios: historialServicios?.length || 0,
        total_invertido: historialServicios?.reduce((sum, s) => sum + (s.monto ? Number(s.monto) : 0), 0) || 0,
        total_puntos_generados: historialServicios?.reduce((sum, s) => sum + (s.puntos_generados || 0), 0) || 0,
        total_canjes: canjes?.length || 0,
        puntos_canjeados: canjes?.reduce((sum, c) => sum + (c.puntos_usados || 0), 0) || 0,
        ultimo_servicio: historialServicios?.[0]?.fecha_servicio || null,
        primer_servicio: historialServicios?.length > 0 ? historialServicios[historialServicios.length - 1]?.fecha_servicio : null,
    };

    return {
        cliente,
        canjes: canjes?.map(c => ({
            ...c,
            producto_nombre: c.productos?.nombre || 'Producto Eliminado',
            tipo: c.productos?.tipo || c.tipo_producto_original,
        })) || [],
        historialPuntos: historialPuntos || [],
        serviciosAsignados: serviciosAsignados || [],
        historialServicios: historialServicios || [],
        stats
    };
};

export const cambiarNivelCliente = async (clienteId, nuevoNivel) => {
    if (nuevoNivel !== 'partner' && nuevoNivel !== 'vip') {
        throw new Error(ERROR_MESSAGES.CLIENTS.LEVEL_INVALID);
    }

    try {
        const data = await callEdgeFunction(supabase, 'update-cliente-nivel', {
            cliente_id: clienteId,
            nuevo_nivel: nuevoNivel
        }, { timeout: 15000, retries: 2 });

        // Fire and forget: Notify client about level change
        notifyClienteNivelCambiado(clienteId, nuevoNivel);

        return data;
    } catch (error) {
        logger.error('Error cambiando nivel de cliente', { error: error.message, clienteId, nuevoNivel });
        throw new Error(ERROR_MESSAGES.CLIENTS.LEVEL_CHANGE_ERROR);
    }
};

export const cambiarRolAdmin = async (clienteId, esAdmin, changedById) => {
    const { data, error } = await supabase
        .from('clientes')
        .update({ es_admin: esAdmin })
        .eq('id', clienteId)
        .select()
        .single();

    if (error) throw new Error(ERROR_MESSAGES.CLIENTS.ROLE_CHANGE_ERROR);

    // Registrar el cambio en el log (fire and forget)
    if (changedById) {
        supabase.from('admin_role_logs').insert({
            cliente_id: clienteId,
            changed_by_id: changedById,
            action: esAdmin ? 'granted' : 'revoked'
        }).then(({ error: logError }) => {
            if (logError) logger.warn('Error logging admin role change', { error: logError.message });
        });
    }

    return data;
};

/**
 * Sincroniza un cliente de Supabase a Notion
 * Crea el Contacto y Manny Reward si no existen
 * Ahora con fallback a cola de reintentos si falla
 */
export const syncToNotion = async (clienteId) => {
    try {
        const data = await callEdgeFunction(supabase, 'sync-cliente-to-notion', {
            cliente_id: clienteId
        }, { timeout: 30000, retries: 1 });

        return data;
    } catch (error) {
        logger.warn('Direct Notion sync failed, queueing for retry', { error: error.message, clienteId });

        // Queue for retry instead of failing silently
        await enqueueSyncOperation('sync_cliente', clienteId, {
            original_error: error.message
        }, 'clients_service');

        // Return a pending status so the caller knows it's queued
        return {
            status: 'queued',
            message: 'La sincronización se completará en breve',
            queued: true
        };
    }
};

