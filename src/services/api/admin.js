import { supabase } from '@/lib/customSupabaseClient';

export const exportMannyData = async () => {
    const { data: clientes, error: e1 } = await supabase.from('clientes').select('*');
    if (e1) throw new Error(`Error exportando clientes: ${e1.message}`);
    const { data: productos, error: e2 } = await supabase.from('productos').select('*');
    if (e2) throw new Error(`Error exportando productos: ${e2.message}`);
    const { data: canjes, error: e3 } = await supabase.from('canjes').select('*');
    if (e3) throw new Error(`Error exportando canjes: ${e3.message}`);
    const { data: historial, error: e4 } = await supabase.from('historial_puntos').select('*');
    if(e4) throw new Error(`Error exportando historial: ${e4.message}`);

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
    if (!data.clientes || !data.productos) throw new Error("El archivo no tiene el formato correcto.");

    if (data.clientes) {
        const { error } = await supabase.from('clientes').upsert(data.clientes, { onConflict: 'telefono' });
        if (error) throw new Error(`Error importando clientes: ${error.message}`);
    }
    if (data.productos) {
        const { error } = await supabase.from('productos').upsert(data.productos, { onConflict: 'id' });
        if (error) throw new Error(`Error importando productos: ${error.message}`);
    }
    if (data.canjes) {
            const { error } = await supabase.from('canjes').upsert(data.canjes, { onConflict: 'id' });
            if (error) console.error(`Error importando canjes: ${error.message}`);
    }
    if (data.historial_puntos) {
            const { error } = await supabase.from('historial_puntos').upsert(data.historial_puntos, { onConflict: 'id' });
            if (error) console.error(`Error importando historial: ${error.message}`);
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
        throw new Error('Error al cargar configuración de recordatorios.');
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

        if (error) throw new Error('Error al actualizar configuración.');
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

        if (error) throw new Error('Error al crear configuración.');
        return data;
    }
};

export const getTiposServicioRecurrente = async () => {
    const { data, error } = await supabase
        .from('tipos_servicio_recurrente')
        .select('*')
        .order('tipo_trabajo', { ascending: true });

    if (error) throw new Error('Error al cargar tipos de servicio recurrente.');
    return data || [];
};

export const actualizarTipoServicioRecurrente = async (id, updates) => {
    const { data, error } = await supabase
        .from('tipos_servicio_recurrente')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw new Error('Error al actualizar tipo de servicio.');
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
            throw new Error('Este tipo de servicio ya existe.');
        }
        throw new Error('Error al agregar tipo de servicio.');
    }
    return data;
};

export const eliminarTipoServicioRecurrente = async (id) => {
    const { error } = await supabase
        .from('tipos_servicio_recurrente')
        .delete()
        .eq('id', id);

    if (error) throw new Error('Error al eliminar tipo de servicio.');
    return true;
};

export const getTiposTrabajoDisponibles = async () => {
    const { data, error } = await supabase
        .from('historial_servicios')
        .select('tipo_trabajo')
        .not('tipo_trabajo', 'is', null)
        .order('tipo_trabajo');

    if (error) return [];

    const unicos = [...new Set(data.map(d => d.tipo_trabajo).filter(Boolean))];
    return unicos.sort();
};
