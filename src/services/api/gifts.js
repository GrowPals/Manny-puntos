import { supabase } from '@/lib/customSupabaseClient';

// ==================== PÚBLICO ====================

/**
 * Obtiene info de un link de regalo por código (público)
 * Soporta links individuales y campañas masivas
 */
export const getGiftByCode = async (codigo) => {
  // Primero incrementar vistas
  await supabase
    .from('links_regalo')
    .update({
      veces_visto: supabase.sql`veces_visto + 1`,
      ultima_vista: new Date().toISOString()
    })
    .eq('codigo', codigo.toUpperCase());

  const { data, error } = await supabase
    .from('links_regalo')
    .select(`
      id,
      codigo,
      tipo,
      nombre_beneficio,
      descripcion_beneficio,
      puntos_regalo,
      mensaje_personalizado,
      imagen_url,
      imagen_banner,
      color_tema,
      estado,
      fecha_expiracion,
      destinatario_telefono,
      es_campana,
      nombre_campana,
      max_canjes,
      canjes_realizados,
      terminos_condiciones,
      instrucciones_uso,
      vigencia_beneficio
    `)
    .eq('codigo', codigo.toUpperCase())
    .maybeSingle();

  if (error) {
    console.error('Error obteniendo regalo:', error);
    return null;
  }

  if (!data) return null;

  // Verificar expiración del link
  if (data.fecha_expiracion && new Date(data.fecha_expiracion) < new Date()) {
    data.estado = 'expirado';
  }

  // Para campañas, verificar si alcanzó el límite
  if (data.es_campana && data.max_canjes && data.canjes_realizados >= data.max_canjes) {
    data.estado = 'agotado';
  }

  return data;
};

/**
 * Canjea un link de regalo (usa la nueva función v2 para campañas)
 */
export const claimGift = async (codigo, telefono) => {
  const { data, error } = await supabase.rpc('canjear_link_regalo_v2', {
    p_codigo: codigo.toUpperCase(),
    p_telefono: telefono
  });

  if (error) {
    console.error('Error canjeando regalo:', error);
    throw new Error('Error al canjear el regalo');
  }

  if (!data.success) {
    throw new Error(data.error || 'No se pudo canjear el regalo');
  }

  return data;
};

/**
 * Obtiene beneficios activos de un cliente
 */
export const getMisBeneficios = async (clienteId) => {
  const { data, error } = await supabase.rpc('get_beneficios_cliente', {
    p_cliente_id: clienteId
  });

  if (error) {
    console.error('Error obteniendo beneficios:', error);
    throw new Error('Error al cargar tus beneficios');
  }

  return data || [];
};

// ==================== ADMIN ====================

/**
 * Crea un nuevo link de regalo o campaña
 */
export const createGiftLink = async ({
  tipo,
  creado_por = null,
  nombre_beneficio = null,
  descripcion_beneficio = null,
  puntos_regalo = null,
  mensaje_personalizado = null,
  destinatario_telefono = null,
  dias_expiracion = 30,
  // Nuevos campos para campañas
  es_campana = false,
  nombre_campana = null,
  max_canjes = null,
  terminos_condiciones = null,
  instrucciones_uso = null,
  vigencia_beneficio = 365,
  imagen_banner = null,
  color_tema = '#E91E63'
}) => {
  // Generar código único
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let codigo = '';
  for (let i = 0; i < (es_campana ? 8 : 6); i++) {
    codigo += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const fechaExpiracion = new Date();
  fechaExpiracion.setDate(fechaExpiracion.getDate() + dias_expiracion);

  const { data, error } = await supabase
    .from('links_regalo')
    .insert({
      codigo,
      tipo,
      creado_por,
      nombre_beneficio,
      descripcion_beneficio,
      puntos_regalo,
      mensaje_personalizado,
      destinatario_telefono,
      fecha_expiracion: fechaExpiracion.toISOString(),
      es_campana,
      nombre_campana,
      max_canjes: es_campana ? max_canjes : 1,
      terminos_condiciones,
      instrucciones_uso,
      vigencia_beneficio,
      imagen_banner,
      color_tema,
      estado: 'pendiente',
      canjes_realizados: 0
    })
    .select()
    .single();

  if (error) {
    console.error('Error creando link:', error);
    throw new Error('Error al crear el link de regalo');
  }

  return {
    success: true,
    codigo: data.codigo,
    id: data.id,
    url: `${window.location.origin}/g/${data.codigo}`
  };
};

/**
 * Obtiene todos los links de regalo (admin)
 */
export const getAllGiftLinks = async () => {
  const { data, error } = await supabase
    .from('links_regalo')
    .select(`
      *,
      creador:creado_por (id, nombre),
      canjeador:canjeado_por (id, nombre, telefono)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error obteniendo links:', error);
    throw new Error('Error al cargar links de regalo');
  }

  return data || [];
};

/**
 * Obtiene estadísticas de links de regalo incluyendo campañas
 */
export const getGiftStats = async () => {
  const { data: links, error: e1 } = await supabase
    .from('links_regalo')
    .select('estado, tipo, puntos_regalo, veces_visto, es_campana, canjes_realizados');

  const { data: beneficios, error: e2 } = await supabase
    .from('beneficios_cliente')
    .select('estado, puntos_otorgados');

  if (e1) {
    console.error('Error obteniendo stats:', e1);
    throw new Error('Error al cargar estadísticas');
  }

  const stats = {
    total: links?.length || 0,
    pendientes: links?.filter(l => l.estado === 'pendiente').length || 0,
    canjeados: links?.filter(l => l.estado === 'canjeado').length || 0,
    expirados: links?.filter(l => l.estado === 'expirado').length || 0,
    campanas: links?.filter(l => l.es_campana).length || 0,
    total_vistas: links?.reduce((sum, l) => sum + (l.veces_visto || 0), 0) || 0,
    total_canjes: links?.reduce((sum, l) => sum + (l.canjes_realizados || 0), 0) || 0,
    por_tipo: {
      servicio: links?.filter(l => l.tipo === 'servicio').length || 0,
      puntos: links?.filter(l => l.tipo === 'puntos').length || 0,
    },
    // Beneficios otorgados
    beneficios_activos: beneficios?.filter(b => b.estado === 'activo').length || 0,
    beneficios_usados: beneficios?.filter(b => b.estado === 'usado').length || 0,
    puntos_regalados: beneficios?.reduce((sum, b) => sum + (b.puntos_otorgados || 0), 0) || 0
  };

  return stats;
};

/**
 * Obtiene beneficios canjeados de un link específico
 */
export const getLinkBeneficiarios = async (linkId) => {
  const { data, error } = await supabase
    .from('beneficios_cliente')
    .select(`
      *,
      cliente:cliente_id (id, nombre, telefono)
    `)
    .eq('link_regalo_id', linkId)
    .order('fecha_canje', { ascending: false });

  if (error) {
    console.error('Error obteniendo beneficiarios:', error);
    throw new Error('Error al cargar beneficiarios');
  }

  return data || [];
};

/**
 * Obtiene beneficios de un cliente específico (admin)
 */
export const getClienteBeneficios = async (clienteId) => {
  const { data, error } = await supabase
    .from('beneficios_cliente')
    .select(`
      *,
      link:link_regalo_id (codigo, nombre_campana, imagen_banner)
    `)
    .eq('cliente_id', clienteId)
    .order('fecha_canje', { ascending: false });

  if (error) {
    console.error('Error obteniendo beneficios del cliente:', error);
    throw new Error('Error al cargar beneficios');
  }

  return data || [];
};

/**
 * Marca un beneficio como usado
 */
export const marcarBeneficioUsado = async (beneficioId, adminId, notas = null) => {
  const { data, error } = await supabase.rpc('marcar_beneficio_usado', {
    p_beneficio_id: beneficioId,
    p_admin_id: adminId,
    p_notas: notas
  });

  if (error) {
    console.error('Error marcando beneficio:', error);
    throw new Error('Error al marcar beneficio como usado');
  }

  if (!data.success) {
    throw new Error(data.error || 'No se pudo marcar el beneficio');
  }

  return data;
};

/**
 * Cancela/expira un link de regalo
 */
export const expireGiftLink = async (linkId) => {
  const { data, error } = await supabase
    .from('links_regalo')
    .update({ estado: 'expirado' })
    .eq('id', linkId)
    .eq('estado', 'pendiente')
    .select()
    .single();

  if (error) {
    console.error('Error expirando link:', error);
    throw new Error('Error al expirar el link');
  }

  return data;
};

/**
 * Elimina un link de regalo (solo si no tiene canjes)
 */
export const deleteGiftLink = async (linkId) => {
  // Primero verificar que no tenga beneficios asociados
  const { data: beneficios } = await supabase
    .from('beneficios_cliente')
    .select('id')
    .eq('link_regalo_id', linkId)
    .limit(1);

  if (beneficios && beneficios.length > 0) {
    throw new Error('No se puede eliminar un link que ya tiene beneficiarios');
  }

  const { error } = await supabase
    .from('links_regalo')
    .delete()
    .eq('id', linkId);

  if (error) {
    console.error('Error eliminando link:', error);
    throw new Error('Error al eliminar el link');
  }

  return true;
};

/**
 * Actualiza un link de regalo
 */
export const updateGiftLink = async (linkId, updates) => {
  const allowedFields = [
    'nombre_beneficio',
    'descripcion_beneficio',
    'puntos_regalo',
    'mensaje_personalizado',
    'imagen_url',
    'imagen_banner',
    'color_tema',
    'destinatario_telefono',
    'fecha_expiracion',
    'terminos_condiciones',
    'instrucciones_uso',
    'vigencia_beneficio',
    'max_canjes',
    'nombre_campana'
  ];

  const filteredUpdates = {};
  for (const key of allowedFields) {
    if (updates[key] !== undefined) {
      filteredUpdates[key] = updates[key];
    }
  }

  const { data, error } = await supabase
    .from('links_regalo')
    .update(filteredUpdates)
    .eq('id', linkId)
    .select()
    .single();

  if (error) {
    console.error('Error actualizando link:', error);
    throw new Error('Error al actualizar el link');
  }

  return data;
};
