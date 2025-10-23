
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { History, Loader2, ArrowLeft, PackageCheck, Hourglass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useNotionAPI } from '@/context/NotionAPIContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const MisCanjes = () => {
    const { user } = useAuth();
    const { getClienteHistorial } = useNotionAPI();
    const [historial, setHistorial] = useState({ canjes: [], servicios: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistorial = async () => {
            if (user?.telefono) {
                try {
                    const data = await getClienteHistorial(user.telefono);
                    setHistorial(data);
                } catch (error) {
                    console.error("Error al cargar el historial:", error);
                } finally {
                    setLoading(false);
                }
            }
        };
        fetchHistorial();
    }, [user, getClienteHistorial]);

    const getEstadoInfo = (estado) => {
        if (estado === 'entregado') {
            return {
                text: 'Entregado',
                icon: <PackageCheck className="w-5 h-5 text-green-600" />,
                bg: 'bg-green-100',
            };
        }
        return {
            text: 'Pendiente para tu próxima visita',
            icon: <Hourglass className="w-5 h-5 text-yellow-600" />,
            bg: 'bg-yellow-100',
        };
    };

    return (
        <>
            <Helmet>
                <title>Mis Canjes - Manny</title>
            </Helmet>
            <div className="min-h-screen flex flex-col">
                <Header />
                <main className="flex-1 container mx-auto px-4 py-8">
                     <Link to="/dashboard" className="inline-flex items-center gap-2 text-gray-600 hover:text-manny-orange transition-colors mb-6">
                        <ArrowLeft size={16} />
                        Volver al Dashboard
                    </Link>
                    <motion.h1
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-3xl md:text-4xl font-bold text-gray-800 mb-8 flex items-center gap-3">
                        <History className="w-8 h-8 text-manny-orange" />
                        Mi Historial de Canjes
                    </motion.h1>

                    {loading ? (
                        <div className="text-center py-12"><Loader2 className="animate-spin h-8 w-8 mx-auto text-manny-orange" /></div>
                    ) : (
                        historial.canjes.length > 0 ? (
                        <div className="space-y-4">
                            {historial.canjes.sort((a,b) => new Date(b.fecha) - new Date(a.fecha)).map((canje, index) => {
                                const estadoInfo = getEstadoInfo(canje.estado);
                                return (
                                <motion.div
                                    key={canje.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="bg-white rounded-2xl shadow-lg p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                                >
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-800">{canje.producto_nombre}</h3>
                                        <p className="text-sm text-gray-500 mt-1">Canjeado el {new Date(canje.fecha).toLocaleDateString('es-MX')}</p>
                                    </div>
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                                         <span className="font-bold text-lg text-manny-orange">{canje.puntos_usados} pts Manny</span>
                                         <div className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-semibold ${estadoInfo.bg}`}>
                                             {estadoInfo.icon}
                                             <span>{estadoInfo.text}</span>
                                        </div>
                                    </div>
                                </motion.div>
                                );
                            })}
                        </div>
                        ) : (
                             <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
                                <p className="text-gray-500 text-lg">Aún no has canjeado ninguna recompensa.</p>
                             </div>
                        )
                    )}
                </main>
                <Footer />
            </div>
        </>
    );
};

export default MisCanjes;
