import { supabase } from '@/lib/customSupabaseClient';
import { ERROR_MESSAGES } from '@/constants/errors';
import { withRetry } from '@/lib/utils';

export const getTodosLosCanjes = async () => {
    const { data, error } = await supabase
    .from('canjes')
    .select(`*, clientes(nombre, telefono), productos(nombre, tipo)`)
    .order('created_at', { ascending: false });

    if (error) throw new Error(ERROR_MESSAGES.REDEMPTIONS.LOAD_ERROR);
    
    return data?.map(c => ({
        ...c,
        fecha: c.created_at,
        cliente_nombre: c.clientes?.nombre || 'N/A',
        cliente_telefono: c.clientes?.telefono || 'N/A',
        producto_nombre: c.productos?.nombre || 'Producto Eliminado',
        tipo: c.productos?.tipo || c.tipo_producto_original,
    })) || [];
};

export const getCanjesPendientes = async () => {
    const { data, error } = await supabase
        .from('canjes')
        .select(`*, clientes(nombre, telefono), productos(nombre, tipo)`)
        .in('estado', ['pendiente_entrega', 'en_lista'])
        .order('created_at', { ascending: true });

    if (error) throw new Error(ERROR_MESSAGES.REDEMPTIONS.LOAD_PENDING_ERROR);
    
    return data?.map(c => ({
        ...c,
        fecha: c.created_at,
        cliente_nombre: c.clientes?.nombre || 'N/A',
        cliente_telefono: c.clientes?.telefono || 'N/A',
        producto_nombre: c.productos?.nombre || 'Producto Eliminado',
        tipo: c.productos?.tipo || c.tipo_producto_original,
    })) || [];
};

export const actualizarEstadoCanje = async (canjeId, nuevoEstado) => {
    const { error } = await supabase
        .from('canjes')
        .update({ estado: nuevoEstado })
        .eq('id', canjeId);

    if (error) throw new Error(ERROR_MESSAGES.REDEMPTIONS.UPDATE_STATUS_ERROR);

    // Sync status change to Notion (fire and forget)
    try {
        await supabase.functions.invoke('update-canje-status-notion', {
            body: { canje_id: canjeId, nuevo_estado: nuevoEstado }
        });
    } catch (e) { console.warn('Error syncing canje status to Notion:', e); }

    return true;
};

export const registrarCanje = async ({ cliente_id, producto_id }) => {
    // Use retry logic for the critical redemption operation
    const data = await withRetry(
        async () => {
            const { data, error } = await supabase.rpc('registrar_canje_atomico', {
                p_cliente_id: cliente_id,
                p_producto_id: producto_id
            });

            if (error) {
                console.error('Error en RPC registrar_canje_atomico:', error);
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

    // Fire and forget: Crear ticket en Notion Tickets Manny
    try {
        await supabase.functions.invoke('create-reward-ticket', {
            body: { tipo: 'canje', id: data.canjeId }
        });
    } catch (e) { console.warn('Error creating reward ticket:', e); }

    return {
        nuevoSaldo: data.nuevoSaldo,
        canje: { id: data.canjeId },
        mensaje: "¡Canje exitoso!"
    };
};
