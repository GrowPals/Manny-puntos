
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Truck, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useNotionAPI } from '@/context/NotionAPIContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const AdminEntregas = () => {
    const { toast } = useToast();
    const { getCanjesPendientes, marcarCanjeComoEntregado } = useNotionAPI();
    const [entregas, setEntregas] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadEntregas = async () => {
        setLoading(true);
        try {
            const data = await getCanjesPendientes();
            setEntregas(data);
        } catch (error) {
            toast({ title: 'Error al cargar entregas', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadEntregas();
    }, []);

    const handleMarcarEntregado = async (canjeId) => {
        try {
            await marcarCanjeComoEntregado(canjeId);
            toast({ title: '¡Entrega registrada!' });
            loadEntregas();
        } catch (error) {
            toast({ title: 'Error al registrar entrega', variant: 'destructive' });
        }
    };

    return (
        <>
            <Helmet>
                <title>Entregas Pendientes - Admin Manny</title>
            </Helmet>
            <div className="min-h-screen flex flex-col">
                <Header />
                <main className="flex-1 container mx-auto px-4 py-8">
                    <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-8 flex items-center gap-3">
                        <Truck className="w-8 h-8 text-orange-500" />
                        Entregas Pendientes
                    </h1>
                    
                    {loading ? (
                        <div className="text-center py-12"><Loader2 className="animate-spin h-8 w-8 mx-auto text-orange-500" /></div>
                    ) : entregas.length > 0 ? (
                        <div className="space-y-4">
                            {entregas.map((entrega) => (
                                <motion.div key={entrega.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-white rounded-2xl shadow-lg p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-800">{entrega.producto_nombre}</h3>
                                        <p className="text-sm text-gray-500 mt-1">
                                            Cliente: <span className="font-medium">{entrega.cliente_nombre}</span> ({entrega.cliente_telefono})
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            Solicitado el {new Date(entrega.fecha).toLocaleString('es-MX')}
                                        </p>
                                    </div>
                                    <Button onClick={() => handleMarcarEntregado(entrega.id)} className="bg-green-600 hover:bg-green-700 rounded-xl">
                                        <Check className="w-4 h-4 mr-2" />
                                        Marcar como Entregado
                                    </Button>
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-16 bg-white rounded-2xl shadow-lg">
                            <h2 className="text-2xl font-bold text-gray-800">¡Todo en orden!</h2>
                            <p className="text-gray-500 mt-2">No hay entregas pendientes por el momento.</p>
                        </div>
                    )}
                </main>
                <Footer />
            </div>
        </>
    );
};

export default AdminEntregas;
