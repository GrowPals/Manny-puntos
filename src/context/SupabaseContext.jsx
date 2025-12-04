
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
        },

        getTodosLosClientes: async () => {
            const { data, error } = await supabase.from('clientes').select('*').order('created_at', { ascending: false });
            if (error) {
                console.error("Error en getTodosLosClientes:", error);
                throw new Error('No se pudieron cargar los clientes.');
            }
            return data || [];
        },

        crearOActualizarCliente: async (clienteData) => {
            // Pre-query validation
            if (!clienteData.nombre || clienteData.nombre.trim().length < 3) throw new Error("El nombre es requerido y debe tener al menos 3 caracteres.");
            if (!clienteData.telefono || !/^[0-9]{10}$/.test(String(clienteData.telefono).replace(/\D/g, ''))) throw new Error("El teléfono es requerido y debe tener 10 dígitos.");

            const upsertPayload = {
              ...clienteData,
              puntos_actuales: Number(clienteData.puntos_actuales) || 0,
            };

            const { data, error } = await supabase.from('clientes').upsert(upsertPayload).select().single();

            if (error) {
                console.error("Error en crearOActualizarCliente:", error);
                if (error.code === '23505') { // Unique constraint violation on 'telefono'
                    throw new Error('El número de teléfono ya está registrado.');
                }
                if (error.message.includes('violates row-level security policy')) {
                     throw new Error('No tienes permiso para crear o actualizar clientes.');
                }
                throw new Error('Error al guardar el cliente.');
            }
            return data;
        },
        
        asignarPuntosManualmente: async (clienteTelefono, puntos, concepto) => {
             // Pre-query validation
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
        },

        cambiarRolAdmin: async (clienteId, esAdmin) => {
            const { data, error } = await supabase.from('clientes').update({ es_admin: esAdmin }).eq('id', clienteId).select().single();
            if (error) throw new Error('Error al cambiar el rol del usuario.');
            return data;
        },

        cambiarNivelCliente: async (clienteId, nuevoNivel) => {
            if (nuevoNivel !== 'partner' && nuevoNivel !== 'vip') {
                throw new Error('El nivel debe ser partner o vip.');
            }

            // Llamar a la Edge Function que actualiza Supabase y crea registro en Notion
            const { data, error } = await supabase.functions.invoke('update-cliente-nivel', {
                body: { cliente_id: clienteId, nuevo_nivel: nuevoNivel }
            });

            if (error) {
                console.error('Error en cambiarNivelCliente:', error);
                throw new Error('Error al cambiar el nivel del cliente.');
            }

            return data;
        },

        // PRODUCT
        getProductosCanje: async () => {
            const { data, error } = await supabase.from('productos').select('*').eq('activo', true).order('puntos_requeridos', { ascending: true });
            if (error) throw new Error('No se pudieron cargar los productos para canje.');
            return data || [];
        },
        
        getAllProductosAdmin: async () => {
            const { data, error } = await supabase.from('productos').select('*').order('created_at', { ascending: false });
            if (error) throw new Error('No se pudieron cargar los productos.');
            return data || [];
        },

        getProductoById: async (id) => {
            const { data, error } = await supabase.from('productos').select('*').eq('id', id).maybeSingle();
            if (error) throw new Error('Error al buscar el producto.');
            return data;
        },

        crearOActualizarProducto: async (productoData) => {
             // Pre-query validation
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
        },

        eliminarProducto: async (productoId) => {
            const { error } = await supabase.from('productos').delete().eq('id', productoId);
            if (error) throw new Error('Error al eliminar el producto.');
            return true;
        },

        // REDEMPTION
        getTodosLosCanjes: async () => {
             const { data, error } = await supabase
                .from('canjes')
                .select(`*, clientes(nombre, telefono), productos(nombre, tipo)`)
                .order('created_at', { ascending: false });

            if (error) throw new Error('No se pudieron cargar los canjes.');
            
            return data?.map(c => ({
                ...c,
                fecha: c.created_at,
                cliente_nombre: c.clientes?.nombre || 'N/A',
                cliente_telefono: c.clientes?.telefono || 'N/A',
                producto_nombre: c.productos?.nombre || 'Producto Eliminado',
                tipo: c.productos?.tipo || c.tipo_producto_original,
            })) || [];
        },

        getCanjesPendientes: async () => {
            const { data, error } = await supabase
                .from('canjes')
                .select(`*, clientes(nombre, telefono), productos(nombre, tipo)`)
                .in('estado', ['pendiente_entrega', 'en_lista'])
                .order('created_at', { ascending: true });

            if (error) throw new Error('No se pudieron cargar los canjes pendientes.');
            
            return data?.map(c => ({
                ...c,
                fecha: c.created_at,
                cliente_nombre: c.clientes?.nombre || 'N/A',
                cliente_telefono: c.clientes?.telefono || 'N/A',
                producto_nombre: c.productos?.nombre || 'Producto Eliminado',
                tipo: c.productos?.tipo || c.tipo_producto_original,
            })) || [];
        },
        
        getClienteHistorial: async (telefono) => {
            const { data, error } = await supabase
                .from('clientes')
                .select(`id, historial_puntos(*), canjes(*, productos(id, nombre, tipo))`)
                .eq('telefono', telefono)
                .maybeSingle();

            if (error) throw new Error("Ocurrió un error al buscar tu historial.");

            if (!data) return { canjes: [], servicios: [] };
            
            const canjesMapeados = data.canjes?.map(c => ({
                id: c.id,
                fecha: c.created_at,
                puntos_usados: c.puntos_usados,
                estado: c.estado,
                producto_nombre: c.productos?.nombre || 'Producto Eliminado',
                tipo: c.productos?.tipo || c.tipo_producto_original,
            })) || [];

            return { canjes: canjesMapeados, servicios: data.historial_puntos || [] };
        },
        
        registrarCanje: async ({ cliente_id, producto_id }) => {
            const { data, error } = await supabase.rpc('registrar_canje_atomico', {
                p_cliente_id: cliente_id,
                p_producto_id: producto_id
            });

            if (error) {
                console.error('Error en RPC registrar_canje_atomico:', error);
                if (error.message.includes('Puntos insuficientes')) {
                    throw new Error('No tienes suficientes puntos para este canje.');
                }
                if (error.message.includes('Producto agotado')) {
                    throw new Error('Lo sentimos, este producto está agotado.');
                }
                throw new Error('No se pudo procesar el canje en este momento.');
            }

            // Sincronizar canje a Notion (fire and forget)
            try {
                await supabase.functions.invoke('sync-canje-to-notion', {
                    body: { canje_id: data.canjeId }
                });
            } catch (syncError) {
                console.warn('No se pudo sincronizar canje a Notion:', syncError);
            }

            // Obtener datos del producto y cliente para notificación
            const { data: producto } = await supabase.from('productos').select('nombre, tipo').eq('id', producto_id).single();
            const { data: cliente } = await supabase.from('clientes').select('nombre').eq('id', cliente_id).single();

            // Notificar a admins del nuevo canje (fire and forget)
            try {
                await supabase.functions.invoke('send-push-notification', {
                    body: {
                        tipo: 'nuevo_canje',
                        to_admins: true,
                        data: {
                            producto: producto?.nombre || 'Producto',
                            cliente: cliente?.nombre || 'Cliente',
                            puntos: data.puntosUsados || 0
                        },
                        url: '/admin/entregas'
                    }
                });
            } catch (notifError) {
                console.warn('No se pudo notificar a admins:', notifError);
            }
            const mensajeExito = producto?.tipo === 'servicio'
                ? "¡Servicio canjeado con éxito! Ya puedes disfrutarlo."
                : "¡Producto canjeado! Te avisaremos cuando esté listo para entrega.";

            return {
                nuevoSaldo: data.nuevoSaldo,
                canje: { id: data.canjeId },
                mensaje: mensajeExito
            };
        },

        actualizarEstadoCanje: async (canjeId, nuevoEstado) => {
            const updatePayload = { estado: nuevoEstado };
            const fechaEntrega = ['entregado', 'completado'].includes(nuevoEstado)
                ? new Date().toISOString()
                : null;

            if (fechaEntrega) {
                updatePayload.fecha_entrega = fechaEntrega;
            }

            const { data, error } = await supabase
                .from('canjes')
                .update(updatePayload)
                .eq('id', canjeId)
                .select('*, clientes(id, nombre), productos(nombre)')
                .single();
            if (error) throw new Error('Error al actualizar el estado del canje.');

            // Sincronizar estado a Notion (fire and forget)
            try {
                await supabase.functions.invoke('update-canje-status-notion', {
                    body: { canje_id: canjeId, nuevo_estado: nuevoEstado, fecha_entrega: fechaEntrega }
                });
            } catch (syncError) {
                console.warn('No se pudo sincronizar estado a Notion:', syncError);
            }

            // Notificar al cliente cuando su canje está listo o entregado
            if (['pendiente_entrega', 'en_lista'].includes(nuevoEstado)) {
                // El producto está listo para recoger
                try {
                    await supabase.functions.invoke('send-push-notification', {
                        body: {
                            tipo: 'canje_listo',
                            cliente_id: data.clientes?.id,
                            data: {
                                producto: data.productos?.nombre || 'tu recompensa'
                            },
                            url: '/mis-canjes'
                        }
                    });
                } catch (notifError) {
                    console.warn('No se pudo notificar al cliente:', notifError);
                }
            } else if (['entregado', 'completado'].includes(nuevoEstado)) {
                // Confirmación de entrega
                try {
                    await supabase.functions.invoke('send-push-notification', {
                        body: {
                            tipo: 'canje_completado',
                            cliente_id: data.clientes?.id,
                            url: '/dashboard'
                        }
                    });
                } catch (notifError) {
                    console.warn('No se pudo notificar al cliente:', notifError);
                }
            }

            return data;
        },
        
        exportMannyData: async () => {
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
