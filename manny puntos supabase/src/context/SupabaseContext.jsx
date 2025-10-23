import React, { createContext, useContext, useMemo, useCallback, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

const SupabaseContext = createContext(null);

export const useSupabaseAPI = () => {
    const context = useContext(SupabaseContext);
    if (!context) {
        throw new Error('useSupabaseAPI must be used within a SupabaseProvider');
    }
    return context;
};

export const SupabaseProvider = ({ children }) => {
    const [loading, setLoading] = useState({});

    const withLoading = useCallback(async (key, asyncFunc) => {
        setLoading(prev => ({ ...prev, [key]: true }));
        try {
            return await asyncFunc();
        } finally {
            setLoading(prev => ({ ...prev, [key]: false }));
        }
    }, []);

    const getClienteByTelefono = useCallback(async (telefono) => {
        return withLoading('getClienteByTelefono', async () => {
            if (!telefono || typeof telefono !== 'string' || telefono.trim() === '') {
                throw new Error('El teléfono es requerido.');
            }
            const telefonoLimpio = telefono.replace(/\D/g, '');
            if (telefonoLimpio.length !== 10) {
                throw new Error('El teléfono debe tener 10 dígitos.');
            }
            const { data, error } = await supabase.from('clientes').select('*').eq('telefono', telefonoLimpio).single();
            if (error) {
                if (error.code === 'PGRST116') throw new Error('Este número de teléfono no está registrado.');
                console.error('Supabase DB Error in getClienteByTelefono:', error);
                throw new Error('Error de conexión con la base de datos.');
            }
            if (!data) throw new Error('Este número de teléfono no está registrado.');
            if (!data.id || !data.nombre) throw new Error('Los datos del usuario están incompletos.');
            return data;
        });
    }, [withLoading]);

    const getTodosLosClientes = useCallback(async () => {
        return withLoading('getTodosLosClientes', async () => {
            const { data, error } = await supabase.from('clientes').select('*').order('created_at', { ascending: false });
            if (error) throw new Error(error.message);
            return data || [];
        });
    }, [withLoading]);

    const crearOActualizarCliente = useCallback(async (clienteData) => {
        return withLoading('crearOActualizarCliente', async () => {
            const { id, ...updateData } = clienteData;
            const { data, error } = await supabase.from('clientes').upsert(updateData, { onConflict: 'telefono' }).select().single();
            if (error) throw new Error(error.message);
            return data;
        });
    }, [withLoading]);

    const asignarPuntosManualmente = useCallback(async (clienteTelefono, puntos, concepto) => {
        return withLoading('asignarPuntosManualmente', async () => {
            const puntosNum = Number(puntos);
            if (isNaN(puntosNum)) throw new Error('La cantidad de puntos debe ser un número válido.');
            if (!concepto || concepto.trim() === '') throw new Error('El concepto es requerido.');
            if (!clienteTelefono) throw new Error('El teléfono del cliente es requerido.');
            
            const { data: cliente, error: clienteError } = await supabase.from('clientes').select('id, puntos_actuales').eq('telefono', clienteTelefono).single();
            if (clienteError || !cliente) throw new Error('Cliente no encontrado.');

            const nuevosPuntos = cliente.puntos_actuales + puntosNum;
            const { error: updateError } = await supabase.from('clientes').update({ puntos_actuales: nuevosPuntos }).eq('id', cliente.id);
            if (updateError) throw updateError;
            
            const { error: historyError } = await supabase.from('historial_puntos').insert({ cliente_id: cliente.id, puntos: puntosNum, concepto: concepto });
            if (historyError) {
                await supabase.from('clientes').update({ puntos_actuales: cliente.puntos_actuales }).eq('id', cliente.id);
                throw historyError;
            }
            return nuevosPuntos;
        });
    }, [withLoading]);

    const cambiarRolAdmin = useCallback(async (clienteId, esAdmin) => {
        return withLoading('cambiarRolAdmin', async () => {
            if (typeof esAdmin !== 'boolean') throw new Error('El rol debe ser un valor booleano.');
            const { data, error } = await supabase.from('clientes').update({ es_admin: esAdmin }).eq('id', clienteId).select().single();
            if (error) throw new Error(error.message);
            return data;
        });
    }, [withLoading]);

    const getProductosCanje = useCallback(async () => {
        return withLoading('getProductosCanje', async () => {
            const { data, error } = await supabase.from('productos').select('*').eq('activo', true).order('puntos_requeridos', { ascending: true });
            if (error) throw new Error(error.message);
            return data || [];
        });
    }, [withLoading]);

    const getAllProductosAdmin = useCallback(async () => {
        return withLoading('getAllProductosAdmin', async () => {
            const { data, error } = await supabase.from('productos').select('*').order('created_at', { ascending: false });
            if (error) throw new Error(error.message);
            return data || [];
        });
    }, [withLoading]);

    const getProductoById = useCallback(async (id) => {
        return withLoading('getProductoById', async () => {
            if (!id) throw new Error("Se requiere un ID de producto.");
            const { data, error } = await supabase.from('productos').select('*').eq('id', id).single();
            if (error) throw new Error(error.message);
            return data;
        });
    }, [withLoading]);

    const crearOActualizarProducto = useCallback(async (productoData) => {
        return withLoading('crearOActualizarProducto', async () => {
            const { data, error } = await supabase.from('productos').upsert(productoData, { onConflict: 'id' }).select().single();
            if (error) throw new Error(error.message);
            return data;
        });
    }, [withLoading]);

    const eliminarProducto = useCallback(async (productoId) => {
        return withLoading('eliminarProducto', async () => {
            if (!productoId) throw new Error("Se requiere un ID de producto para eliminar.");
            const { error } = await supabase.from('productos').delete().eq('id', productoId);
            if (error) throw new Error(error.message);
            return true;
        });
    }, [withLoading]);

    const subirImagenProducto = useCallback(async (file) => {
        return withLoading('subirImagenProducto', async () => {
            if (!file) throw new Error("No se ha seleccionado ningún archivo.");
            const fileName = `${Date.now()}_${file.name}`;
            const { data, error } = await supabase.storage.from('recompensas').upload(fileName, file);
            if (error) throw new Error(`Error al subir la imagen: ${error.message}`);
            const { data: { publicUrl } } = supabase.storage.from('recompensas').getPublicUrl(data.path);
            return publicUrl;
        });
    }, [withLoading]);

    const getTodosLosCanjes = useCallback(async () => {
        return withLoading('getTodosLosCanjes', async () => {
            const { data, error } = await supabase.from('canjes').select(`*, clientes(nombre, telefono), productos(nombre, tipo)`).order('created_at', { ascending: false });
            if (error) throw new Error(error.message);
            return data?.map(c => ({ ...c, fecha: c.created_at, cliente_nombre: c.clientes?.nombre || 'N/A', cliente_telefono: c.clientes?.telefono || 'N/A', producto_nombre: c.productos?.nombre || 'Eliminado', tipo: c.productos?.tipo || 'producto' })) || [];
        });
    }, [withLoading]);

    const getCanjesPendientes = useCallback(async () => {
        return withLoading('getCanjesPendientes', async () => {
            const { data, error } = await supabase.from('canjes').select(`*, clientes(nombre, telefono), productos(nombre, tipo)`).in('estado', ['pendiente_entrega', 'en_lista', 'agendado']).order('created_at', { ascending: false });
            if (error) throw new Error(error.message);
            return data?.map(c => ({ ...c, fecha: c.created_at, cliente_nombre: c.clientes?.nombre || 'N/A', cliente_telefono: c.clientes?.telefono || 'N/A', producto_nombre: c.productos?.nombre || 'Eliminado', tipo: c.productos?.tipo || 'producto' })) || [];
        });
    }, [withLoading]);

    const getClienteHistorial = useCallback(async (telefono) => {
        return withLoading('getClienteHistorial', async () => {
            if (!telefono) throw new Error("Se requiere un teléfono de cliente.");
            const { data, error } = await supabase.from('clientes').select(`id`).eq('telefono', telefono).single();
            if (error || !data) throw new Error("Cliente no encontrado.");
            
            const [canjesRes, historialRes] = await Promise.all([
                supabase.from('canjes').select(`*, productos(nombre, tipo)`).eq('cliente_id', data.id).order('created_at', { ascending: false }),
                supabase.from('historial_puntos').select('*').eq('cliente_id', data.id).order('created_at', { ascending: false })
            ]);

            if (canjesRes.error) throw canjesRes.error;
            if (historialRes.error) throw historialRes.error;

            return { 
                canjes: canjesRes.data?.map(c => ({...c, fecha: c.created_at, producto_nombre: c.productos?.nombre || 'Eliminado', tipo: c.productos?.tipo || 'producto'})) || [], 
                servicios: historialRes.data || [] 
            };
        });
    }, [withLoading]);

    const registrarCanje = useCallback(async ({ cliente_id, producto_id }) => {
        return withLoading('registrarCanje', async () => {
            if (!cliente_id || !producto_id) throw new Error('ID de cliente y producto son requeridos.');
            
            const { data: cliente, error: clienteError } = await supabase.from('clientes').select('puntos_actuales').eq('id', cliente_id).single();
            if (clienteError || !cliente) throw new Error('Cliente no encontrado.');

            const { data: producto, error: productoError } = await supabase.from('productos').select('puntos_requeridos, stock, tipo').eq('id', producto_id).single();
            if (productoError || !producto) throw new Error('Producto no encontrado.');

            if (cliente.puntos_actuales < producto.puntos_requeridos) throw new Error('Puntos insuficientes.');
            if (producto.tipo === 'producto' && producto.stock <= 0) throw new Error('Producto agotado.');

            const nuevoSaldo = cliente.puntos_actuales - producto.puntos_requeridos;
            const nuevoStock = producto.tipo === 'producto' ? producto.stock - 1 : producto.stock;
            
            const { data: canje, error: canjeError } = await supabase.from('canjes').insert({ cliente_id, producto_id, puntos_usados: producto.puntos_requeridos, estado: producto.tipo === 'servicio' ? 'en_lista' : 'pendiente_entrega', tipo_producto_original: producto.tipo }).select().single();
            if (canjeError) throw canjeError;
            
            const { error: clienteUpdateError } = await supabase.from('clientes').update({ puntos_actuales: nuevoSaldo }).eq('id', cliente_id);
            if (clienteUpdateError) throw clienteUpdateError;

            if (producto.tipo === 'producto') {
                const { error: stockUpdateError } = await supabase.from('productos').update({ stock: nuevoStock }).eq('id', producto_id);
                if (stockUpdateError) throw stockUpdateError;
            }

            return { nuevoSaldo, canje, mensaje: "¡Canje realizado con éxito!" };
        });
    }, [withLoading]);

    const actualizarEstadoCanje = useCallback(async (canjeId, nuevoEstado) => {
        return withLoading('actualizarEstadoCanje', async () => {
            if (!canjeId || !nuevoEstado) throw new Error("ID de canje y nuevo estado son requeridos.");
            const updatePayload = { estado: nuevoEstado };
            if (['entregado', 'completado'].includes(nuevoEstado)) {
                updatePayload.fecha_entrega = new Date().toISOString();
            }
            const { data, error } = await supabase.from('canjes').update(updatePayload).eq('id', canjeId).select().single();
            if (error) throw new Error(error.message);
            return data;
        });
    }, [withLoading]);

    const exportMannyData = useCallback(async () => {
        return withLoading('exportMannyData', async () => {
            const [clientes, productos, canjes, historial] = await Promise.all([
                supabase.from('clientes').select('*'),
                supabase.from('productos').select('*'),
                supabase.from('canjes').select('*'),
                supabase.from('historial_puntos').select('*')
            ]);
            if (clientes.error) throw new Error(clientes.error.message);
            if (productos.error) throw new Error(productos.error.message);
            if (canjes.error) throw new Error(canjes.error.message);
            if (historial.error) throw new Error(historial.error.message);

            const fullData = { clientes: clientes.data, productos: productos.data, canjes: canjes.data, historial_puntos: historial.data, version: 'supabase-1.0' };
            const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `manny-supabase-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }, [withLoading]);

    const importMannyData = useCallback(async (file) => {
        return withLoading('importMannyData', async () => {
            const fileContent = await file.text();
            const data = JSON.parse(fileContent);
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
                 if (error) console.error(`Error importando canjes (puede ser ignorado si son duplicados): ${error.message}`);
            }
            if (data.historial_puntos) {
                 const { error } = await supabase.from('historial_puntos').upsert(data.historial_puntos, { onConflict: 'id' });
                 if (error) console.error(`Error importando historial (puede ser ignorado si son duplicados): ${error.message}`);
            }
            return "Datos importados correctamente. La página se recargará.";
        });
    }, [withLoading]);

    const api = useMemo(() => ({
        loading,
        getClienteByTelefono,
        getTodosLosClientes,
        crearOActualizarCliente,
        asignarPuntosManualmente,
        cambiarRolAdmin,
        getProductosCanje,
        getAllProductosAdmin,
        getProductoById,
        crearOActualizarProducto,
        eliminarProducto,
        subirImagenProducto,
        getTodosLosCanjes,
        getCanjesPendientes,
        getClienteHistorial,
        registrarCanje,
        actualizarEstadoCanje,
        exportMannyData,
        importMannyData,
    }), [
        loading, getClienteByTelefono, getTodosLosClientes, crearOActualizarCliente, asignarPuntosManualmente, cambiarRolAdmin,
        getProductosCanje, getAllProductosAdmin, getProductoById, crearOActualizarProducto, eliminarProducto, subirImagenProducto,
        getTodosLosCanjes, getCanjesPendientes, getClienteHistorial, registrarCanje, actualizarEstadoCanje,
        exportMannyData, importMannyData
    ]);

    return (
        <SupabaseContext.Provider value={api}>
            {children}
        </SupabaseContext.Provider>
    );
};