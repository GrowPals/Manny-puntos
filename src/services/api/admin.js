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
        .select('*')
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
        .select('*')
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
export const getDashboardStats = async () => {
    // Obtener todos los datos necesarios en paralelo
    const [
        { data: clientes },
        { data: canjes },
        { data: historialServicios },
        { data: productos }
    ] = await Promise.all([
        supabase.from('clientes').select('id, puntos_actuales, nivel, es_admin, created_at'),
        supabase.from('canjes').select('id, created_at, puntos_usados, estado, producto_id, productos(tipo)'),
        supabase.from('historial_servicios').select('id, fecha_servicio, monto, puntos_generados, tipo_trabajo'),
        supabase.from('productos').select('id, tipo, activo')
    ]);

    const clientesActivos = clientes?.filter(c => !c.es_admin) || [];
    const totalPuntos = clientesActivos.reduce((sum, c) => sum + (Number(c.puntos_actuales) || 0), 0);

    // Estadísticas de niveles de cliente
    const niveles = {
        normal: clientesActivos.filter(c => c.nivel === 'normal' || !c.nivel).length,
        partner: clientesActivos.filter(c => c.nivel === 'partner').length,
        vip: clientesActivos.filter(c => c.nivel === 'vip').length
    };

    // Estadísticas de canjes por estado
    const canjesStats = {
        total: canjes?.length || 0,
        pendientes: canjes?.filter(c => c.estado === 'pendiente_entrega' || c.estado === 'en_lista').length || 0,
        entregados: canjes?.filter(c => c.estado === 'entregado').length || 0,
        puntosCanjeados: canjes?.reduce((sum, c) => sum + (Number(c.puntos_usados) || 0), 0) || 0
    };

    // Canjes por tipo de producto
    const canjesPorTipo = {};
    canjes?.forEach(c => {
        const tipo = c.productos?.tipo || 'Otro';
        canjesPorTipo[tipo] = (canjesPorTipo[tipo] || 0) + 1;
    });

    // Ingresos y servicios por mes (últimos 6 meses)
    const hoy = new Date();
    const serviciosPorMes = [];
    for (let i = 5; i >= 0; i--) {
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
        const mesAnio = fecha.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });
        const inicioMes = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
        const finMes = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0, 23, 59, 59);

        const serviciosMes = historialServicios?.filter(s => {
            const fechaServicio = new Date(s.fecha_servicio);
            return fechaServicio >= inicioMes && fechaServicio <= finMes;
        }) || [];

        serviciosPorMes.push({
            mes: mesAnio,
            servicios: serviciosMes.length,
            ingresos: serviciosMes.reduce((sum, s) => sum + (Number(s.monto) || 0), 0),
            puntos: serviciosMes.reduce((sum, s) => sum + (Number(s.puntos_generados) || 0), 0)
        });
    }

    // Servicios por tipo de trabajo
    const serviciosPorTipo = {};
    historialServicios?.forEach(s => {
        const tipo = s.tipo_trabajo || 'Sin categoría';
        serviciosPorTipo[tipo] = (serviciosPorTipo[tipo] || 0) + 1;
    });

    // Total ingresos
    const totalIngresos = historialServicios?.reduce((sum, s) => sum + (Number(s.monto) || 0), 0) || 0;
    const totalServicios = historialServicios?.length || 0;

    // Nuevos clientes este mes
    const inicioMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const clientesNuevosMes = clientesActivos.filter(c =>
        new Date(c.created_at) >= inicioMesActual
    ).length;

    return {
        resumen: {
            totalClientes: clientesActivos.length,
            totalPuntos,
            clientesNuevosMes,
            totalIngresos,
            totalServicios
        },
        niveles,
        canjesStats,
        canjesPorTipo: Object.entries(canjesPorTipo).map(([tipo, cantidad]) => ({ tipo, cantidad })),
        serviciosPorMes,
        serviciosPorTipo: Object.entries(serviciosPorTipo).map(([tipo, cantidad]) => ({ tipo, cantidad })),
        productosActivos: productos?.filter(p => p.activo).length || 0
    };
};
