import { supabase } from '@/lib/customSupabaseClient';

export const getTodosLosClientes = async () => {
  const { data, error } = await supabase.from('clientes').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error("Error en getTodosLosClientes:", error);
    throw new Error('No se pudieron cargar los clientes.');
  }
  return data || [];
};

export const crearOActualizarCliente = async (clienteData) => {
  if (!clienteData.nombre || clienteData.nombre.trim().length < 3) throw new Error("El nombre es requerido y debe tener al menos 3 caracteres.");
  if (!clienteData.telefono || !/^[0-9]{10}$/.test(String(clienteData.telefono).replace(/\D/g, ''))) throw new Error("El teléfono es requerido y debe tener 10 dígitos.");

  const upsertPayload = {
    ...clienteData,
    puntos_actuales: Number(clienteData.puntos_actuales) || 0,
  };

  const { data, error } = await supabase.from('clientes').upsert(upsertPayload).select().single();

  if (error) {
    console.error("Error en crearOActualizarCliente:", error);
    if (error.code === '23505') {
        throw new Error('El número de teléfono ya está registrado.');
    }
    if (error.message.includes('violates row-level security policy')) {
            throw new Error('No tienes permiso para crear o actualizar clientes.');
    }
    throw new Error('Error al guardar el cliente.');
  }
  return data;
};

export const asignarPuntosManualmente = async (clienteTelefono, puntos, concepto) => {
  if (!puntos || isNaN(Number(puntos))) throw new Error("La cantidad de puntos debe ser un número.");
  if (!concepto || concepto.trim() === '') throw new Error("El concepto es requerido.");

  const { data, error } = await supabase.rpc('asignar_puntos_atomico', {
    p_cliente_telefono: clienteTelefono,
    p_puntos_a_sumar: Number(puntos),
    p_concepto: concepto
  });

  if (error) {
    console.error('Error en RPC asignar_puntos_atomico:', error);
    throw new Error(error.message || 'Error al asignar puntos.');
  }
  return data;
};

export const getClienteHistorial = async (telefono) => {
    const { data, error } = await supabase
        .from('clientes')
        .select(`id, historial_puntos(*), canjes(*, productos(id, nombre, tipo))`)
        .eq('telefono', telefono)
        .maybeSingle();

    if (error) throw new Error("Ocurrió un error al buscar tu historial.");

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

    if (clienteError) throw new Error('Cliente no encontrado.');

    const { data: canjes, error: canjesError } = await supabase
        .from('canjes')
        .select('*, productos(nombre, tipo)')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });

    if (canjesError) throw new Error('Error al cargar canjes del cliente.');

    const { data: historialPuntos, error: historialError } = await supabase
        .from('historial_puntos')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });

    if (historialError) throw new Error('Error al cargar historial de puntos.');

    const { data: serviciosAsignados, error: serviciosError } = await supabase
        .from('servicios_asignados')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });

    if (serviciosError) throw new Error('Error al cargar servicios asignados.');

    // Historial de servicios (trabajos realizados por Manny)
    const { data: historialServicios, error: histServError } = await supabase
        .from('historial_servicios')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('fecha_servicio', { ascending: false });

    if (histServError) throw new Error('Error al cargar historial de servicios.');

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
        throw new Error('El nivel debe ser partner o vip.');
    }

    const { data, error } = await supabase.functions.invoke('update-cliente-nivel', {
        body: { cliente_id: clienteId, nuevo_nivel: nuevoNivel }
    });

    if (error) {
        console.error('Error en cambiarNivelCliente:', error);
        throw new Error('Error al cambiar el nivel del cliente.');
    }

    return data;
};

export const cambiarRolAdmin = async (clienteId, esAdmin) => {
    const { data, error } = await supabase
        .from('clientes')
        .update({ es_admin: esAdmin })
        .eq('id', clienteId)
        .select()
        .single();

    if (error) throw new Error('Error al cambiar el rol del usuario.');
    return data;
};
