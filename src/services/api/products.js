import { supabase } from '@/lib/customSupabaseClient';

export const getProductosCanje = async () => {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('activo', true)
    .order('puntos_requeridos', { ascending: true });
    
  if (error) throw new Error('No se pudieron cargar los productos para canje.');
  return data || [];
};

export const getAllProductosAdmin = async () => {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) throw new Error('No se pudieron cargar los productos.');
  return data || [];
};

export const getProductoById = async (id) => {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('id', id)
    .maybeSingle();
    
  if (error) throw new Error('Error al buscar el producto.');
  return data;
};

export const crearOActualizarProducto = async (productoData) => {
  if (!productoData.nombre || productoData.nombre.trim() === '') throw new Error("El nombre del producto es requerido.");
  if (productoData.puntos_requeridos == null || isNaN(productoData.puntos_requeridos) || productoData.puntos_requeridos <= 0) throw new Error("Los puntos deben ser un número mayor a cero.");

  const { data, error } = await supabase.from('productos').upsert(productoData).select().single();
  if (error) {
    console.error("Error en crearOActualizarProducto:", error);
    if (error.message.includes('violates row-level security policy')) {
        throw new Error('No tienes permiso para crear o actualizar productos.');
    }
    throw new Error('Error al guardar el producto.');
  }
  return data;
};

export const eliminarProducto = async (productoId) => {
  const { error } = await supabase.from('productos').delete().eq('id', productoId);
  if (error) throw new Error('Error al eliminar el producto.');
  return true;
};
