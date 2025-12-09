import { supabase } from '@/lib/customSupabaseClient';
import { ERROR_MESSAGES } from '@/constants/errors';
import { logger } from '@/lib/logger';

export const exportMannyData = async () => {
    const { data: clientes, error: e1 } = await supabase.from('clientes').select('*');
    if (e1) throw new Error(`${ERROR_MESSAGES.ADMIN.EXPORT_CLIENTS_ERROR}: ${e1.message}`);
    const { data: productos, error: e2 } = await supabase.from('productos').select('*');
    if (e2) throw new Error(`${ERROR_MESSAGES.ADMIN.EXPORT_PRODUCTS_ERROR}: ${e2.message}`);
    const { data: canjes, error: e3 } = await supabase.from('canjes').select('*');
    if (e3) throw new Error(`${ERROR_MESSAGES.ADMIN.EXPORT_REDEMPTIONS_ERROR}: ${e3.message}`);
    const { data: historial, error: e4 } = await supabase.from('historial_puntos').select('*');
    if(e4) throw new Error(`${ERROR_MESSAGES.ADMIN.EXPORT_HISTORY_ERROR}: ${e4.message}`);

    const fullData = { clientes, productos, canjes, historial_puntos: historial, version: 'supabase-1.0' };
    
    const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `manny-supabase-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const importMannyData = async (data) => {
    if (!data.clientes || !data.productos) throw new Error(ERROR_MESSAGES.ADMIN.IMPORT_FORMAT_ERROR);

    if (data.clientes) {
        const { error } = await supabase.from('clientes').upsert(data.clientes, { onConflict: 'telefono' });
        if (error) throw new Error(`${ERROR_MESSAGES.ADMIN.IMPORT_CLIENTS_ERROR}: ${error.message}`);
    }
    if (data.productos) {
        const { error } = await supabase.from('productos').upsert(data.productos, { onConflict: 'id' });
        if (error) throw new Error(`${ERROR_MESSAGES.ADMIN.IMPORT_PRODUCTS_ERROR}: ${error.message}`);
    }
    if (data.canjes) {
            const { error } = await supabase.from('canjes').upsert(data.canjes, { onConflict: 'id' });
            if (error) throw new Error(`${ERROR_MESSAGES.ADMIN.IMPORT_REDEMPTIONS_ERROR || 'Error importando canjes'}: ${error.message}`);
    }
    if (data.historial_puntos) {
            const { error } = await supabase.from('historial_puntos').upsert(data.historial_puntos, { onConflict: 'id' });
            if (error) throw new Error(`${ERROR_MESSAGES.ADMIN.IMPORT_HISTORY_ERROR || 'Error importando historial'}: ${error.message}`);
    }
    return true;
};

// RECORDATORIOS
export const getConfigRecordatorios = async () => {
    const { data, error } = await supabase
        .from('config_recordatorios')
        .select('id, activo, max_notificaciones_mes, titulo_default, mensaje_default, hora_envio, created_at, updated_at')
        .limit(1)
        .maybeSingle();

    if (error) {
        throw new Error(ERROR_MESSAGES.ADMIN.REMINDERS_LOAD_ERROR);
    }

    return data || {
        activo: true,
        max_notificaciones_mes: 1,
        titulo_default: '¿Tiempo de dar mantenimiento?',
        mensaje_default: 'Han pasado {dias} días desde tu último servicio de {tipo}. El mantenimiento regular ayuda a prolongar la vida útil de tus equipos.',
        hora_envio: 10
    };
};

export const actualizarConfigRecordatorios = async (config) => {
    const { data: existing } = await supabase
        .from('config_recordatorios')
        .select('id')
        .limit(1)
        .maybeSingle();

    const updateData = { updated_at: new Date().toISOString() };
    if (config.activo !== undefined) updateData.activo = config.activo;
    if (config.max_notificaciones_mes !== undefined) updateData.max_notificaciones_mes = config.max_notificaciones_mes;
    if (config.titulo_default !== undefined) updateData.titulo_default = config.titulo_default;
    if (config.mensaje_default !== undefined) updateData.mensaje_default = config.mensaje_default;
    if (config.hora_envio !== undefined) updateData.hora_envio = config.hora_envio;

    if (existing) {
        const { data, error } = await supabase
            .from('config_recordatorios')
            .update(updateData)
            .eq('id', existing.id)
            .select()
            .single();

        if (error) throw new Error(ERROR_MESSAGES.ADMIN.REMINDERS_UPDATE_ERROR);
        return data;
    } else {
        const insertData = {
            activo: config.activo ?? false,
            max_notificaciones_mes: config.max_notificaciones_mes ?? 1,
            titulo_default: config.titulo_default ?? '¿Tiempo de dar mantenimiento?',
            mensaje_default: config.mensaje_default ?? 'Hola {nombre}, han pasado {dias} días desde tu último {servicio}. ¿Te agendamos?',
            hora_envio: config.hora_envio ?? 10
        };

        const { data, error } = await supabase
            .from('config_recordatorios')
            .insert(insertData)
            .select()
            .single();

        if (error) throw new Error(ERROR_MESSAGES.ADMIN.REMINDERS_CREATE_ERROR);
        return data;
    }
};

export const getTiposServicioRecurrente = async () => {
    const { data, error } = await supabase
        .from('tipos_servicio_recurrente')
        .select('id, tipo_trabajo, dias_recordatorio, activo, created_at')
        .order('tipo_trabajo', { ascending: true });

    if (error) throw new Error(ERROR_MESSAGES.ADMIN.SERVICE_TYPES_LOAD_ERROR);
    return data || [];
};

export const actualizarTipoServicioRecurrente = async (id, updates) => {
    const { data, error } = await supabase
        .from('tipos_servicio_recurrente')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw new Error(ERROR_MESSAGES.ADMIN.SERVICE_TYPES_UPDATE_ERROR);
    return data;
};

export const agregarTipoServicioRecurrente = async (tipoTrabajo, diasRecordatorio = 180) => {
    const { data, error } = await supabase
        .from('tipos_servicio_recurrente')
        .insert({
            tipo_trabajo: tipoTrabajo,
            dias_recordatorio: diasRecordatorio,
            activo: true
        })
        .select()
        .single();

    if (error) {
        if (error.code === '23505') {
            throw new Error(ERROR_MESSAGES.ADMIN.SERVICE_TYPES_DUPLICATE);
        }
        throw new Error(ERROR_MESSAGES.ADMIN.SERVICE_TYPES_ADD_ERROR);
    }
    return data;
};

export const eliminarTipoServicioRecurrente = async (id) => {
    const { error } = await supabase
        .from('tipos_servicio_recurrente')
        .delete()
        .eq('id', id);

    if (error) throw new Error(ERROR_MESSAGES.ADMIN.SERVICE_TYPES_DELETE_ERROR);
    return true;
};

export const getTiposTrabajoDisponibles = async () => {
    const { data, error } = await supabase
        .from('historial_servicios')
        .select('tipo_trabajo')
        .not('tipo_trabajo', 'is', null)
        .order('tipo_trabajo');

    if (error) {
        logger.error('Error obteniendo tipos de trabajo', { error: error.message });
        throw new Error(ERROR_MESSAGES.ADMIN.SERVICE_TYPES_LOAD_ERROR || 'Error al cargar tipos de trabajo');
    }

    const unicos = [...new Set(data.map(d => d.tipo_trabajo).filter(Boolean))];
    return unicos.sort();
};

// ESTADÍSTICAS DEL DASHBOARD
// Usa RPC para calcular estadísticas en el servidor, no en el browser
export const getDashboardStats = async () => {
    const { data, error } = await supabase.rpc('get_dashboard_stats');

    if (error) {
        logger.error('Error obteniendo estadísticas del dashboard', { error: error.message });
        throw new Error(ERROR_MESSAGES.ADMIN.STATS_ERROR || 'Error al cargar estadísticas');
    }

    return data;
};
