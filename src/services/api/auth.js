import { supabase } from '@/lib/customSupabaseClient';

export const getClienteByTelefono = async (telefono) => {
  const telefonoLimpio = String(telefono).replace(/\D/g, '');
  if (!/^[0-9]{10}$/.test(telefonoLimpio)) {
    throw new Error('Formato de teléfono inválido. Debe contener 10 dígitos.');
  }
  
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('telefono', telefonoLimpio)
    .maybeSingle();

  if (error) {
    console.error('Supabase DB Error in getClienteByTelefono:', error);
    throw new Error('Error de conexión al buscar cliente. Inténtalo de nuevo.');
  }
  return data;
};

export const verifyPin = async (telefono, pin) => {
    const cliente = await getClienteByTelefono(telefono);
    if (!cliente) return null;
    
    // In a real app, this should be hashed. For now, we compare plain text as per plan.
    if (cliente.pin === pin) {
        return cliente;
    }
    return null;
};

export const login = async (telefono, pin) => {
    const cliente = await verifyPin(telefono, pin);
    if (!cliente) {
        throw new Error('Credenciales incorrectas.');
    }
    return cliente;
};
