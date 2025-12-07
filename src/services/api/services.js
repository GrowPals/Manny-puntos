import { supabase } from '@/lib/customSupabaseClient';
import { ERROR_MESSAGES } from '@/constants/errors';

// SERVICIOS ASIGNADOS (Para Partners/VIP)
export const getServiciosCliente = async (clienteId) => {
    const { data, error } = await supabase
        .from('servicios_asignados')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });

    if (error) throw new Error(ERROR_MESSAGES.SERVICES.LOAD_ERROR);
    return data || [];
};

export const canjearServicioAsignado = async (servicioId) => {
    const { data, error } = await supabase
        .from('servicios_asignados')
        .update({
            estado: 'canjeado',
            fecha_canje: new Date().toISOString()
        })
        .eq('id', servicioId)
        .select()
        .single();

    if (error) throw new Error(ERROR_MESSAGES.SERVICES.REDEEM_ERROR);
    return data;
};

export const crearServicioAsignado = async (servicioData) => {
    if (!servicioData.cliente_id) throw new Error('El cliente es requerido.');
    if (!servicioData.nombre || servicioData.nombre.trim() === '') throw new Error('El nombre del servicio es requerido.');

    const { data, error } = await supabase
        .from('servicios_asignados')
        .insert({
            cliente_id: servicioData.cliente_id,
            nombre: servicioData.nombre,
            descripcion: servicioData.descripcion || null,
            estado: 'disponible'
        })
        .select()
        .single();

    if (error) throw new Error(ERROR_MESSAGES.SERVICES.CREATE_ERROR);
    return data;
};

export const eliminarServicioAsignado = async (servicioId) => {
    const { error } = await supabase
        .from('servicios_asignados')
        .delete()
        .eq('id', servicioId);

    if (error) throw new Error(ERROR_MESSAGES.SERVICES.DELETE_ERROR);
    return true;
};

// HISTORIAL DE SERVICIOS
export const getHistorialServicios = async (clienteId) => {
    const { data, error } = await supabase
        .from('historial_servicios')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('fecha_servicio', { ascending: false });

    if (error) throw new Error(ERROR_MESSAGES.SERVICES.HISTORY_ERROR);
    return data || [];
};

export const getHistorialServiciosStats = async (clienteId) => {
    const { data, error } = await supabase.rpc('get_historial_stats', {
        p_cliente_id: clienteId
    });

    if (error) {
        console.error('Error en get_historial_stats:', error);
        // Fallback: calcular manualmente si la función no existe
        const { data: servicios } = await supabase
            .from('historial_servicios')
            .select('monto, puntos_generados')
            .eq('cliente_id', clienteId);

        if (!servicios) return { total_servicios: 0, total_invertido: 0, total_puntos: 0 };

        return {
            total_servicios: servicios.length,
            total_invertido: servicios.reduce((sum, s) => sum + (s.monto && s.monto > 0 ? Number(s.monto) : 0), 0),
            total_puntos: servicios.reduce((sum, s) => sum + (s.puntos_generados && s.puntos_generados > 0 ? s.puntos_generados : 0), 0)
        };
    }

    return data?.[0] || { total_servicios: 0, total_invertido: 0, total_puntos: 0 };
};
