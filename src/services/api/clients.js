import { supabase } from '@/lib/customSupabaseClient';
import { ERROR_MESSAGES } from '@/constants/errors';
import { isValidPhone, normalizePhone } from '@/config';
import { enqueueSyncOperation } from './sync';
import { notifyClienteNivelCambiado } from './notifications';

export const getTodosLosClientes = async () => {
  const { data, error } = await supabase.from('clientes').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error("Error en getTodosLosClientes:", error);
    throw new Error(ERROR_MESSAGES.CLIENTS.LOAD_ERROR);
  }
  return data || [];
};

export const crearOActualizarCliente = async (clienteData) => {
  if (!clienteData.nombre || clienteData.nombre.trim().length < 3) throw new Error(ERROR_MESSAGES.CLIENTS.NAME_REQUIRED);
  if (!clienteData.telefono || !isValidPhone(clienteData.telefono)) throw new Error(ERROR_MESSAGES.CLIENTS.PHONE_REQUIRED);

  // Normalize phone number
  clienteData.telefono = normalizePhone(clienteData.telefono);

  const upsertPayload = {
    ...clienteData,
    puntos_actuales: Number(clienteData.puntos_actuales) || 0,
  };

  const { data, error } = await supabase.from('clientes').upsert(upsertPayload).select().single();

  if (error) {
    console.error("Error en crearOActualizarCliente:", error);
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
    console.error('Error en RPC asignar_puntos_atomico:', error);
    throw new Error(error.message || ERROR_MESSAGES.CLIENTS.ASSIGN_POINTS_ERROR);
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
    const { data: cliente, error: clienteError } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', clienteId)
        .single();

    if (clienteError) throw new Error(ERROR_MESSAGES.CLIENTS.NOT_FOUND);

    const { data: canjes, error: canjesError } = await supabase
        .from('canjes')
        .select('*, productos(nombre, tipo)')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });

    if (canjesError) throw new Error(ERROR_MESSAGES.CLIENTS.LOAD_REDEMPTIONS_ERROR);

    const { data: historialPuntos, error: historialError } = await supabase
        .from('historial_puntos')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });

    if (historialError) throw new Error(ERROR_MESSAGES.CLIENTS.LOAD_POINTS_ERROR);

    const { data: serviciosAsignados, error: serviciosError } = await supabase
        .from('servicios_asignados')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });

    if (serviciosError) throw new Error(ERROR_MESSAGES.CLIENTS.LOAD_SERVICES_ERROR);

    // Historial de servicios (trabajos realizados por Manny)
    const { data: historialServicios, error: histServError } = await supabase
        .from('historial_servicios')
        .select('*')
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

    const { data, error } = await supabase.functions.invoke('update-cliente-nivel', {
        body: { cliente_id: clienteId, nuevo_nivel: nuevoNivel }
    });

    if (error) {
        console.error('Error en cambiarNivelCliente:', error);
        throw new Error(ERROR_MESSAGES.CLIENTS.LEVEL_CHANGE_ERROR);
    }

    // Fire and forget: Notify client about level change
    notifyClienteNivelCambiado(clienteId, nuevoNivel);

    return data;
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
            if (logError) console.warn('Error logging admin role change:', logError);
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
        const { data, error } = await supabase.functions.invoke('sync-cliente-to-notion', {
            body: { cliente_id: clienteId }
        });

        if (error) {
            throw error;
        }

        return data;
    } catch (error) {
        console.warn('Direct Notion sync failed, queueing for retry:', error.message);

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

