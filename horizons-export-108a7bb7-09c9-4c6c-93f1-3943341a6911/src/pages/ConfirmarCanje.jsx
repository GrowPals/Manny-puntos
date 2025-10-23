
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle, Loader2, AlertTriangle, Hammer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useNotionAPI } from '@/context/NotionAPIContext';
import { useToast } from '@/components/ui/use-toast';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const ConfirmarCanje = () => {
    const { productoId } = useParams();
    const navigate = useNavigate();
    const { user, updateUser } = useAuth();
    const { getProductoById, registrarCanje } = useNotionAPI();
    const { toast } = useToast();

    const [producto, setProducto] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [canjeExitoso, setCanjeExitoso] = useState(false);
    const [error, setError] = useState(null);
    
    useEffect(() => {
        const fetchProduct = async () => {
            try {
                const prod = await getProductoById(productoId);
                setProducto(prod);
                if (user.puntos_actuales < prod.puntos_requeridos) {
                    setError('No tienes puntos Manny suficientes para este producto.');
                }
                 if (!prod.activo || prod.stock <= 0) {
                    setError('Este producto no está disponible actualmente.');
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchProduct();
    }, [productoId, getProductoById, user.puntos_actuales]);

    const handleConfirmarCanje = async () => {
        if (!producto || error) return;
        
        setIsSubmitting(true);
        try {
            const { nuevoSaldo } = await registrarCanje({ cliente_telefono: user.telefono, producto_id: producto.id });
            updateUser({ puntos_actuales: nuevoSaldo });
            setCanjeExitoso(true);
            toast({
                title: "¡Canje exitoso!",
                description: "Lo prepararemos para tu próxima visita de servicio.",
            });
        } catch (err) {
            toast({
                title: "Error al canjear",
                description: err.message,
                variant: "destructive"
            });
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-manny-orange" /></div>;
    }

    if (canjeExitoso) {
        return (
             <>
                <Header />
                <main className="flex-1 container mx-auto px-4 py-8 flex items-center justify-center">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl shadow-xl p-8 md:p-12 text-center max-w-lg">
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
                    <h1 className="text-3xl font-bold text-gray-800 mb-4">¡Canje Registrado!</h1>
                    <p className="text-gray-600 mb-6">Tu recompensa <span className="font-bold">{producto.nombre}</span> ha sido registrada. La entregaremos durante tu próximo servicio.</p>
                    <div className="flex gap-4 justify-center">
                        <Link to="/dashboard">
                            <Button variant="outline" className="rounded-xl">Volver al Catálogo</Button>
                        </Link>
                        <Link to="/mis-canjes">
                            <Button className="rounded-xl bg-gradient-to-r from-manny-orange to-manny-pink">Ver Mis Canjes</Button>
                        </Link>
                    </div>
                </motion.div>
                </main>
                <Footer />
            </>
        )
    }

    return (
        <>
            <Helmet>
                <title>Confirmar Canje - Manny</title>
            </Helmet>
            <Header />
            <main className="flex-1 container mx-auto px-4 py-8">
                 <Link to="/dashboard" className="inline-flex items-center gap-2 text-gray-600 hover:text-manny-orange transition-colors mb-6">
                    <ArrowLeft size={16} />
                    Volver al catálogo
                </Link>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl shadow-xl p-8 md:p-12 max-w-2xl mx-auto">
                    {producto && (
                        <>
                            <div className="flex flex-col sm:flex-row items-center gap-8 mb-8">
                                <div className="w-32 h-32 bg-gradient-to-br from-orange-100 to-pink-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                                    <Hammer className="w-16 h-16 text-manny-orange" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold text-gray-800">{producto.nombre}</h1>
                                    <p className="text-gray-600 mt-2">{producto.descripcion}</p>
                                </div>
                            </div>
                            
                            <div className="space-y-4 text-center bg-gray-50 p-6 rounded-2xl">
                               <div className="text-lg">
                                    <span className="text-gray-500">Vas a canjear:</span>
                                    <span className="font-bold text-2xl text-manny-orange ml-2">{producto.puntos_requeridos} puntos Manny</span>
                               </div>
                               <div className="text-lg">
                                    <span className="text-gray-500">Tu saldo restante será:</span>
                                    <span className="font-bold text-2xl text-green-600 ml-2">{user.puntos_actuales - producto.puntos_requeridos} puntos Manny</span>
                               </div>
                            </div>
                        </>
                    )}

                    {error && (
                        <div className="flex items-center gap-4 bg-red-50 text-red-700 p-4 rounded-xl mt-8">
                            <AlertTriangle />
                            <p className="font-medium">{error}</p>
                        </div>
                    )}
                    
                    <div className="mt-8 text-center">
                        <Button
                            size="lg"
                            className="w-full sm:w-auto rounded-xl h-14 text-lg bg-gradient-to-r from-manny-orange to-manny-pink hover:from-manny-orange/90 hover:to-manny-pink/90"
                            onClick={handleConfirmarCanje}
                            disabled={isSubmitting || !!error || !producto}
                        >
                            {isSubmitting ? <Loader2 className="animate-spin" /> : 'Confirmar Canje'}
                        </Button>
                    </div>
                </motion.div>
            </main>
            <Footer />
        </>
    );
};

export default ConfirmarCanje;
