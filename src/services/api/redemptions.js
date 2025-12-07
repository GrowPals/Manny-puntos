import { supabase } from '@/lib/customSupabaseClient';
import { ERROR_MESSAGES } from '@/constants/errors';

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
    return true;
};

export const registrarCanje = async ({ cliente_id, producto_id }) => {
    const { data, error } = await supabase.rpc('registrar_canje_atomico', {
        p_cliente_id: cliente_id,
        p_producto_id: producto_id
    });

    if (error) {
        console.error('Error en RPC registrar_canje_atomico:', error);
        if (error.message.includes('Puntos insuficientes')) {
            throw new Error(ERROR_MESSAGES.REDEMPTIONS.INSUFFICIENT_POINTS);
        }
        if (error.message.includes('Producto agotado')) {
            throw new Error(ERROR_MESSAGES.REDEMPTIONS.OUT_OF_STOCK);
        }
        throw new Error(ERROR_MESSAGES.REDEMPTIONS.PROCESS_ERROR);
    }

    // Fire and forget notifications
    try {
        await supabase.functions.invoke('sync-canje-to-notion', {
            body: { canje_id: data.canjeId }
        });
    } catch (e) { console.warn(e); }

    return {
        nuevoSaldo: data.nuevoSaldo,
        canje: { id: data.canjeId },
        mensaje: "¡Canje exitoso!"
    };
};
