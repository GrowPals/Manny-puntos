import { supabase } from '@/lib/customSupabaseClient';
import { ERROR_MESSAGES } from '@/constants/errors';

export const getProductosCanje = async () => {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('activo', true)
    .order('puntos_requeridos', { ascending: true });
    
  if (error) throw new Error(ERROR_MESSAGES.PRODUCTS.LOAD_REDEMPTION_ERROR);
  return data || [];
};

export const getAllProductosAdmin = async () => {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) throw new Error(ERROR_MESSAGES.PRODUCTS.LOAD_ERROR);
  return data || [];
};

export const getProductoById = async (id) => {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('id', id)
    .maybeSingle();
    
  if (error) throw new Error(ERROR_MESSAGES.PRODUCTS.NOT_FOUND);
  return data;
};

export const crearOActualizarProducto = async (productoData) => {
  if (!productoData.nombre || productoData.nombre.trim() === '') throw new Error(ERROR_MESSAGES.PRODUCTS.NAME_REQUIRED);
  if (productoData.puntos_requeridos == null || isNaN(productoData.puntos_requeridos) || productoData.puntos_requeridos <= 0) throw new Error(ERROR_MESSAGES.PRODUCTS.POINTS_INVALID);

  const { data, error } = await supabase.from('productos').upsert(productoData).select().single();
  if (error) {
    console.error("Error en crearOActualizarProducto:", error);
    if (error.message.includes('violates row-level security policy')) {
        throw new Error(ERROR_MESSAGES.PRODUCTS.CREATE_PERMISSION_DENIED);
    }
    throw new Error(ERROR_MESSAGES.PRODUCTS.SAVE_ERROR);
  }
  return data;
};

export const eliminarProducto = async (productoId) => {
  const { error } = await supabase.from('productos').delete().eq('id', productoId);
  if (error) throw new Error(ERROR_MESSAGES.PRODUCTS.DELETE_ERROR);
  return true;
};

export const subirImagenProducto = async (file) => {
  if (!file) throw new Error('No se seleccionó ningún archivo');

  // Validar tipo de archivo
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!validTypes.includes(file.type)) {
    throw new Error('Tipo de archivo no válido. Usa JPG, PNG, WebP o GIF.');
  }

  // Validar tamaño (max 5MB)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error('El archivo es muy grande. Máximo 5MB.');
  }

  // Generar nombre único
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
  const filePath = `productos/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('recompensas')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (uploadError) {
    console.error('Error subiendo imagen:', uploadError);
    throw new Error('Error al subir la imagen. Inténtalo de nuevo.');
  }

  // Obtener URL pública
  const { data: { publicUrl } } = supabase.storage
    .from('recompensas')
    .getPublicUrl(filePath);

  return publicUrl;
};
