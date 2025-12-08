import { supabase } from '@/lib/customSupabaseClient';
import { ERROR_MESSAGES } from '@/constants/errors';
import { logger } from '@/lib/logger';
import { uploadImage } from '@/lib/storage';

export const getProductosCanje = async () => {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('activo', true)
    .order('puntos_requeridos', { ascending: true });
    
  if (error) throw new Error(ERROR_MESSAGES.PRODUCTS.LOAD_REDEMPTION_ERROR);
  return data || [];
};

export const getAllProductosAdmin = async ({ limit = 100, offset = 0 } = {}) => {
  const { data, error, count } = await supabase
    .from('productos')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(ERROR_MESSAGES.PRODUCTS.LOAD_ERROR);
  return { data: data || [], count: count || 0, hasMore: (offset + limit) < (count || 0) };
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
    logger.error('Error creando/actualizando producto', { error: error.message, nombre: productoData.nombre });
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
  return uploadImage(file, 'productos', { context: 'imagen de producto' });
};
