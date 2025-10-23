
import React, { createContext, useContext, useMemo } from 'react';
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
    
    const api = useMemo(() => ({
        // CLIENT
        getClienteByTelefono: async (telefono) => {
            try {
                if (!telefono || typeof telefono !== 'string' || telefono.trim() === '') {
                    throw new Error('El teléfono es requerido.');
                }
                
                const telefonoLimpio = telefono.replace(/\D/g, '');
                
                if (telefonoLimpio.length !== 10) {
                    throw new Error('El teléfono debe tener 10 dígitos.');
                }
                
                const { data, error } = await supabase
                    .from('clientes')
                    .select('*')
                    .eq('telefono', telefonoLimpio)
                    .single();
                
                if (error) {
                    if (error.code === 'PGRST116') {
                        throw new Error('Este número de teléfono no está registrado.');
                    }
                    console.error('Supabase DB Error in getClienteByTelefono:', error);
                    throw new Error('Error de conexión con la base de datos. Inténtalo de nuevo más tarde.');
                }
                
                if (!data) {
                    throw new Error('Este número de teléfono no está registrado.');
                }
                
                if (!data.id || !data.nombre) {
                     throw new Error('Los datos del usuario están incompletos o corruptos.');
                }
                
                return data;
                
            } catch (error) {
                console.error('Error in getClienteByTelefono:', error.message);
                throw error;
            }
        },

        getTodosLosClientes: async () => {
            const { data, error } = await supabase.from('clientes').select('*').order('created_at', { ascending: false });
            if (error) {
                console.error("Error en getTodosLosClientes:", error);
                throw new Error(error.message);
            }
            return data || [];
        },

        crearOActualizarCliente: async (clienteData) => {
             const { id, ...updateData } = clienteData;
            const { data, error } = await supabase.from('clientes').upsert(updateData, { onConflict: 'telefono' }).select().single();
            if (error) {
                console.error("Error en crearOActualizarCliente:", error);
                throw new Error(error.message);
            }
            return data;
        },
        
        asignarPuntosManualmente: async (clienteTelefono, puntos, concepto) => {
             try {
                const puntosNum = Number(puntos);
                if (isNaN(puntosNum)) throw new Error('La cantidad de puntos debe ser un número válido.');
                if (!concepto || concepto.trim() === '') throw new Error('El concepto es requerido para asignar puntos.');
                if (!clienteTelefono) throw new Error('El teléfono del cliente es requerido.');
                
                const { data: cliente, error: clienteError } = await supabase.from('clientes').select('id, puntos_actuales').eq('telefono', clienteTelefono).single();
                if (clienteError || !cliente) throw new Error('Cliente no encontrado.');

                const nuevosPuntos = cliente.puntos_actuales + puntosNum;

                const { error: updateError } = await supabase.from('clientes').update({ puntos_actuales: nuevosPuntos }).eq('id', cliente.id);
                if (updateError) throw updateError;
                
                const { error: historyError } = await supabase.from('historial_puntos').insert({
                    cliente_id: cliente.id,
                    puntos: puntosNum,
                    concepto: concepto,
                });

                if (historyError) {
                    // Rollback point update if history fails
                    await supabase.from('clientes').update({ puntos_actuales: cliente.puntos_actuales }).eq('id', cliente.id);
                    throw historyError;
                }
                
                return nuevosPuntos;

            } catch (error) {
                console.error('Error en asignarPuntosManualmente:', error);
                throw new Error(error.message || "Error al asignar puntos.");
            }
        },

        cambiarRolAdmin: async (clienteId, esAdmin) => {
            if (typeof esAdmin !== 'boolean') throw new Error('El rol debe ser un valor booleano.');
            const { data, error } = await supabase.from('clientes').update({ es_admin: esAdmin }).eq('id', clienteId).select().single();
            if (error) throw new Error(error.message);
            return data;
        },

        // PRODUCT
        getProductosCanje: async () => {
            const { data, error } = await supabase.from('productos').select('*').eq('activo', true).order('puntos_requeridos', { ascending: true });
            if (error) throw new Error(error.message);
            return data || [];
        },
        
        getAllProductosAdmin: async () => {
            const { data, error } = await supabase.from('productos').select('*').order('created_at', { ascending: false });
            if (error) throw new Error(error.message);
            return data || [];
        },

        getProductoById: async (id) => {
            if (!id) throw new Error("Se requiere un ID de producto.");
            const { data, error } = await supabase.from('productos').select('*').eq('id', id).single();
            if (error) throw new Error(error.message);
            return data;
        },

        crearOActualizarProducto: async (productoData) => {
             const { data, error } = await supabase.from('productos').upsert(productoData, { onConflict: 'id' }).select().single();
             if (error) throw new Error(error.message);
             return data;
        },

        eliminarProducto: async (productoId) => {
            if (!productoId) throw new Error("Se requiere un ID de producto para eliminar.");
            const { error } = await supabase.from('productos').delete().eq('id', productoId);
            if (error) throw new Error(error.message);
            return true;
        },

        // REDEMPTION
        getTodosLosCanjes: async () => {
             const { data, error } = await supabase
                .from('canjes')
                .select(`*, clientes(nombre, telefono), productos(nombre, tipo)`)
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Error fetching all canjes:", error);
                throw new Error(error.message);
            }
            
            return data?.map(c => ({
                ...c,
                fecha: c.created_at,
                cliente_nombre: c.clientes?.nombre || 'N/A',
                cliente_telefono: c.clientes?.telefono || 'N/A',
                producto_nombre: c.productos?.nombre || 'Producto Eliminado',
            })) || [];
        },

        getCanjesPendientes: async () => {
            const { data, error } = await supabase
                .from('canjes')
                .select(`*, clientes(nombre, telefono), productos(nombre, tipo)`)
                .in('estado', ['pendiente_entrega', 'en_lista'])
                .order('created_at', { ascending: true });

            if (error) {
                console.error("Error fetching pending canjes:", error);
                throw new Error(error.message);
            }
            
            return data?.map(c => ({
                ...c,
                fecha: c.created_at,
                cliente_nombre: c.clientes?.nombre || 'N/A',
                cliente_telefono: c.clientes?.telefono || 'N/A',
                producto_nombre: c.productos?.nombre || 'Producto Eliminado',
            })) || [];
        },
        
        getClienteHistorial: async (telefono) => {
            if (!telefono) throw new Error("Se requiere un teléfono de cliente.");

            const { data, error } = await supabase
                .from('clientes')
                .select(`*, historial_puntos(*), canjes(*, productos(nombre))`)
                .eq('telefono', telefono)
                .single();

            if (error || !data) throw new Error("Cliente no encontrado para el historial.");

            return { canjes: data.canjes || [], servicios: data.historial_puntos || [] };
        },
        
        registrarCanje: async ({ cliente_id, producto_id }) => {
            if (!cliente_id || !producto_id) throw new Error('ID de cliente y producto son requeridos.');
            
            const { data: cliente, error: clienteError } = await supabase.from('clientes').select('puntos_actuales').eq('id', cliente_id).single();
            if (clienteError || !cliente) throw new Error('Cliente no encontrado.');

            const { data: producto, error: productoError } = await supabase.from('productos').select('puntos_requeridos, stock, tipo').eq('id', producto_id).single();
            if (productoError || !producto) throw new Error('Producto no encontrado.');

            if (cliente.puntos_actuales < producto.puntos_requeridos) throw new Error('Puntos insuficientes.');
            if (producto.tipo === 'producto' && producto.stock <= 0) throw new Error('Producto agotado.');

            const nuevoSaldo = cliente.puntos_actuales - producto.puntos_requeridos;
            const nuevoStock = producto.tipo === 'producto' ? producto.stock - 1 : producto.stock;
            
            const { data: canje, error: canjeError } = await supabase.from('canjes').insert({
                cliente_id,
                producto_id,
                puntos_usados: producto.puntos_requeridos,
                estado: 'pendiente_entrega',
                tipo_producto_original: producto.tipo
            }).select().single();

            if (canjeError) throw canjeError;
            
            const { error: clienteUpdateError } = await supabase.from('clientes').update({ puntos_actuales: nuevoSaldo }).eq('id', cliente_id);
            if (clienteUpdateError) throw clienteUpdateError;

            if (producto.tipo === 'producto') {
                const { error: stockUpdateError } = await supabase.from('productos').update({ stock: nuevoStock }).eq('id', producto_id);
                if (stockUpdateError) throw stockUpdateError;
            }

            return {
                nuevoSaldo,
                canje,
                mensaje: "¡Canje realizado con éxito!"
            };
        },


        actualizarEstadoCanje: async (canjeId, nuevoEstado) => {
            if (!canjeId || !nuevoEstado) throw new Error("ID de canje y nuevo estado son requeridos.");
            
            const updatePayload = { estado: nuevoEstado };
            if (['entregado', 'completado'].includes(nuevoEstado)) {
                updatePayload.fecha_entrega = new Date().toISOString();
            }
            const { data, error } = await supabase.from('canjes').update(updatePayload).eq('id', canjeId).select().single();
            if (error) throw new Error(error.message);
            return data;
        },
        
        exportMannyData: async () => {
            const { data: clientes, error: e1 } = await supabase.from('clientes').select('*');
            if (e1) throw new Error(e1.message);
            const { data: productos, error: e2 } = await supabase.from('productos').select('*');
            if (e2) throw new Error(e2.message);
            const { data: canjes, error: e3 } = await supabase.from('canjes').select('*');
            if (e3) throw new Error(e3.message);
            const { data: historial, error: e4 } = await supabase.from('historial_puntos').select('*');
            if(e4) throw new Error(e4.message);

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
        },
        
         importMannyData: async (data) => {
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
        }

    }), []);

    return (
        <SupabaseContext.Provider value={api}>
            {children}
        </SupabaseContext.Provider>
    );
};
