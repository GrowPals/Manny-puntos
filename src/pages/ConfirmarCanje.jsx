
import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle, Loader2, AlertTriangle, Hammer, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';

const ConfirmarCanje = () => {
    const { productoId } = useParams();
    const navigate = useNavigate();
    const { user, updateUser } = useAuth();
    const { toast } = useToast();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [canjeExitoso, setCanjeExitoso] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [validationError, setValidationError] = useState(null);
    
    const { data: producto, isLoading: loading, error: queryError } = useQuery({
        queryKey: ['producto', productoId],
        queryFn: () => api.products.getProductoById(productoId),
        enabled: !!productoId,
    });

    useEffect(() => {
        if (producto && user) {
            if (user.puntos_actuales < producto.puntos_requeridos) {
                setValidationError('No tienes puntos Manny suficientes para esta recompensa.');
            } else if (!producto.activo || (producto.tipo === 'producto' && producto.stock <= 0)) {
                setValidationError('Esta recompensa no está disponible actualmente.');
            } else {
                setValidationError(null);
            }
        }
    }, [producto, user]);

    const error = queryError ? queryError.message : validationError;

    const handleConfirmarCanje = useCallback(async () => {
        if (!producto || error || !user?.id) return;
        
        setIsSubmitting(true);
        try {
            const { nuevoSaldo, mensaje } = await api.redemptions.registrarCanje({
                cliente_id: user.id,
                producto_id: producto.id,
                cliente_nombre: user.nombre,
                producto_nombre: producto.nombre,
                puntos_producto: producto.puntos_requeridos
            });
            updateUser({ puntos_actuales: nuevoSaldo });
            setSuccessMessage(mensaje);
            setCanjeExitoso(true);
            toast({
                title: "¡Canje exitoso!",
                description: mensaje,
            });
        } catch (err) {
            toast({
                title: "Error al canjear",
                description: err.message,
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    }, [producto, error, user, updateUser, toast]);

    if (loading) {
        return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
    }

    if (canjeExitoso) {
        return (
             <div className="flex-1 flex items-center justify-center">
             <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-card rounded-3xl shadow-xl p-6 sm:p-8 md:p-12 text-center max-w-md w-full">
                 <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
                 <h1 className="text-2xl sm:text-3xl mb-4">¡Canje Registrado!</h1>
                 <p className="text-muted-foreground mb-8 text-base sm:text-lg">{successMessage}</p>
                 <div className="flex flex-col sm:flex-row gap-4 justify-center">
                     <Link to="/dashboard" className="w-full">
                         <Button variant="outline" className="w-full h-12 text-base">Volver al Catálogo</Button>
                     </Link>
                     <Link to="/mis-canjes" className="w-full">
                         <Button variant="investment" className="w-full h-12 text-base">Ver Mis Canjes</Button>
                     </Link>
                 </div>
             </motion.div>
             </div>
        )
    }

    return (
        <>
            <Helmet>
                <title>Confirmar Canje - Manny</title>
            </Helmet>
            <div className="w-full max-w-2xl mx-auto">
                 <Link to="/dashboard" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6">
                    <ArrowLeft size={16} />
                    Volver al catálogo
                </Link>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-3xl shadow-xl p-6 sm:p-8 md:p-12">
                    {producto ? (
                        <>
                            <div className="flex flex-col sm:flex-row items-center text-center sm:text-left gap-6 mb-8">
                                <div className="w-24 h-24 sm:w-32 sm:h-32 bg-muted rounded-2xl flex items-center justify-center flex-shrink-0">
                                     {producto.imagen_url ?
                                        <img src={producto.imagen_url} alt={producto.nombre} className="w-full h-full object-cover rounded-2xl" loading="lazy" decoding="async" /> :
                                        (producto.tipo === 'servicio' ? <Wrench className="w-12 h-12 sm:w-16 sm:h-16 text-primary" /> : <Hammer className="w-12 h-12 sm:w-16 sm:h-16 text-primary" />)
                                     }
                                </div>
                                <div>
                                    <h1 className="text-2xl sm:text-3xl">{producto.nombre}</h1>
                                    <p className="text-muted-foreground mt-2 text-sm sm:text-base">{producto.descripcion}</p>
                                </div>
                            </div>
                            
                            <div className="space-y-4 text-center bg-muted/50 p-6 rounded-2xl">
                               <div className="text-base sm:text-lg">
                                    <span className="text-muted-foreground">Vas a canjear:</span>
                                    <p className="font-bold text-2xl sm:text-3xl text-primary">{producto.puntos_requeridos} puntos</p>
                               </div>
                               <div className="text-base sm:text-lg">
                                    <span className="text-muted-foreground">Tu saldo restante será:</span>
                                    <p className="font-bold text-2xl sm:text-3xl text-green-500">{user.puntos_actuales - producto.puntos_requeridos} puntos</p>
                               </div>
                            </div>
                        </>
                    ) : (
                        !error && <p className="text-center text-muted-foreground">Cargando recompensa...</p>
                    )}

                    {error && (
                        <div className="flex items-center gap-4 bg-destructive/10 text-destructive-foreground p-4 rounded-xl mt-8">
                            <AlertTriangle />
                            <p className="font-medium">{error}</p>
                        </div>
                    )}
                    
                    <div className="mt-8 text-center">
                        <Button
                            size="lg"
                            className="w-full sm:w-auto h-14 text-lg"
                            variant="investment"
                            onClick={handleConfirmarCanje}
                            disabled={isSubmitting || !!error || !producto}
                        >
                            {isSubmitting ? <Loader2 className="animate-spin" /> : 'Confirmar Canje'}
                        </Button>
                    </div>
                </motion.div>
            </div>
        </>
    );
};

export default ConfirmarCanje;
