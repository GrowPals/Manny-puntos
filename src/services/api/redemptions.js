import { supabase } from '@/lib/customSupabaseClient';
import { ERROR_MESSAGES } from '@/constants/errors';
import { withRetry } from '@/lib/utils';
import { logger } from '@/lib/logger';
import {
    notifyClienteCanjeListoParaRecoger,
    notifyClienteCanjeEntregado,
    notifyAdminsNuevoCanje,
    notifyClienteCanjeRegistrado
} from './notifications';

export const getTodosLosCanjes = async ({ limit = 100, offset = 0 } = {}) => {
    const { data, error, count } = await supabase
        .from('canjes')
        .select(`*, clientes(nombre, telefono), productos(nombre, tipo)`, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) throw new Error(ERROR_MESSAGES.REDEMPTIONS.LOAD_ERROR);

    const mappedData = data?.map(c => ({
        ...c,
        fecha: c.created_at,
        cliente_nombre: c.clientes?.nombre || 'N/A',
        cliente_telefono: c.clientes?.telefono || 'N/A',
        producto_nombre: c.productos?.nombre || 'Producto Eliminado',
        tipo: c.productos?.tipo || c.tipo_producto_original,
    })) || [];

    return { data: mappedData, count: count || 0, hasMore: (offset + limit) < (count || 0) };
};

export const getCanjesPendientes = async ({ limit = 50, offset = 0 } = {}) => {
    const { data, error, count } = await supabase
        .from('canjes')
        .select(`*, clientes(nombre, telefono), productos(nombre, tipo)`, { count: 'exact' })
        .in('estado', ['pendiente_entrega', 'en_lista'])
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1);

    if (error) throw new Error(ERROR_MESSAGES.REDEMPTIONS.LOAD_PENDING_ERROR);

    const mappedData = data?.map(c => ({
        ...c,
        fecha: c.created_at,
        cliente_nombre: c.clientes?.nombre || 'N/A',
        cliente_telefono: c.clientes?.telefono || 'N/A',
        producto_nombre: c.productos?.nombre || 'Producto Eliminado',
        tipo: c.productos?.tipo || c.tipo_producto_original,
    })) || [];

    return { data: mappedData, count: count || 0, hasMore: (offset + limit) < (count || 0) };
};

export const actualizarEstadoCanje = async (canjeId, nuevoEstado) => {
    // Get canje data before updating for notification
    const { data: canjeData, error: fetchError } = await supabase
        .from('canjes')
        .select('cliente_id, productos(nombre)')
        .eq('id', canjeId)
        .maybeSingle();

    if (fetchError) {
        logger.error('Error fetching canje for status update', { error: fetchError.message, canjeId });
        throw new Error(ERROR_MESSAGES.REDEMPTIONS.NOT_FOUND || 'Canje no encontrado');
    }

    if (!canjeData) {
        logger.warn('Canje not found for status update', { canjeId });
        throw new Error(ERROR_MESSAGES.REDEMPTIONS.NOT_FOUND || 'Canje no encontrado');
    }

    const { error } = await supabase
        .from('canjes')
        .update({ estado: nuevoEstado })
        .eq('id', canjeId);

    if (error) throw new Error(ERROR_MESSAGES.REDEMPTIONS.UPDATE_STATUS_ERROR);

    // Send push notifications based on new state (fire and forget)
    if (canjeData?.cliente_id) {
        if (nuevoEstado === 'pendiente_entrega') {
            notifyClienteCanjeListoParaRecoger(canjeData.cliente_id, canjeData.productos?.nombre || 'tu producto');
        } else if (nuevoEstado === 'entregado') {
            notifyClienteCanjeEntregado(canjeData.cliente_id);
        }
    }

    // Sync status change to Notion (fire and forget)
    try {
        await supabase.functions.invoke('update-canje-status-notion', {
            body: { canje_id: canjeId, nuevo_estado: nuevoEstado }
        });
    } catch (e) { logger.warn('Error syncing canje status to Notion', { error: e.message, canjeId }); }

    return true;
};

export const registrarCanje = async ({ cliente_id, producto_id, cliente_nombre, producto_nombre, puntos_producto }) => {
    // Use retry logic for the critical redemption operation
    const data = await withRetry(
        async () => {
            const { data, error } = await supabase.rpc('registrar_canje_atomico', {
                p_cliente_id: cliente_id,
                p_producto_id: producto_id
            });

            if (error) {
                logger.error('Error en registrar_canje_atomico', { error: error.message, cliente_id, producto_id });
                // Don't retry business logic errors
                if (error.message.includes('Puntos insuficientes')) {
                    const businessError = new Error(ERROR_MESSAGES.REDEMPTIONS.INSUFFICIENT_POINTS);
                    businessError.isBusinessError = true;
                    throw businessError;
                }
                if (error.message.includes('Producto agotado')) {
                    const businessError = new Error(ERROR_MESSAGES.REDEMPTIONS.OUT_OF_STOCK);
                    businessError.isBusinessError = true;
                    throw businessError;
                }
                throw new Error(ERROR_MESSAGES.REDEMPTIONS.PROCESS_ERROR);
            }

            return data;
        },
        {
            shouldRetry: (error) => !error.isBusinessError
        }
    );

    // Fire and forget: Notify client about their redemption
    if (cliente_id && producto_nombre) {
        notifyClienteCanjeRegistrado(cliente_id, producto_nombre, puntos_producto || 0);
    }

    // Fire and forget: Notify admins about new redemption
    if (cliente_nombre && producto_nombre) {
        notifyAdminsNuevoCanje(cliente_nombre, producto_nombre, puntos_producto || 0);
    }

    // Fire and forget: Crear ticket en Notion Tickets Manny
    try {
        await supabase.functions.invoke('create-reward-ticket', {
            body: { tipo: 'canje', id: data.canjeId }
        });
    } catch (e) { logger.warn('Error creating reward ticket', { error: e.message, canjeId: data.canjeId }); }

    return {
        nuevoSaldo: data.nuevoSaldo,
        canje: { id: data.canjeId },
        mensaje: "¡Canje exitoso!"
    };
};
