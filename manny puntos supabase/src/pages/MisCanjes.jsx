import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { History, Loader2, ArrowLeft, PackageCheck, Hourglass, Wrench, Calendar, CheckCircle, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useSupabaseAPI } from '@/context/SupabaseContext';

const MisCanjes = () => {
    const { user } = useAuth();
    const api = useSupabaseAPI();
    const [historial, setHistorial] = useState({ canjes: [], servicios: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistorial = async () => {
            if (!user?.telefono || !api) {
                setLoading(false);
                return;
            }
            setLoading(true);

            try {
                const data = await api.getClienteHistorial(user.telefono);
                setHistorial(data);
            } catch (error) {
                console.error("Error al cargar el historial:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchHistorial();
    }, [user?.telefono, api]);

    const getEstadoInfo = (estado, tipo) => {
        const statuses = {
            'pendiente_entrega': { text: 'Se entrega en próximo servicio', icon: <Hourglass className="w-5 h-5 text-yellow-500" />, bg: 'bg-yellow-500/10 dark:bg-yellow-500/20', text_color: 'text-yellow-700 dark:text-yellow-300' },
            'entregado': { text: 'Entregado', icon: <PackageCheck className="w-5 h-5 text-green-500" />, bg: 'bg-green-500/10 dark:bg-green-500/20', text_color: 'text-green-700 dark:text-green-300' },
            'en_lista': { text: 'Te contactaremos para coordinar', icon: <Hourglass className="w-5 h-5 text-yellow-500" />, bg: 'bg-yellow-500/10 dark:bg-yellow-500/20', text_color: 'text-yellow-700 dark:text-yellow-300' },
            'agendado': { text: 'Agendado', icon: <Calendar className="w-5 h-5 text-blue-500" />, bg: 'bg-blue-500/10 dark:bg-blue-500/20', text_color: 'text-blue-700 dark:text-blue-300' },
            'completado': { text: 'Completado', icon: <CheckCircle className="w-5 h-5 text-green-500" />, bg: 'bg-green-500/10 dark:bg-green-500/20', text_color: 'text-green-700 dark:text-green-300' },
        };
        return statuses[estado] || { text: 'Estado desconocido', icon: <Hourglass className="w-5 h-5" />, bg: 'bg-gray-500/10', text_color: 'text-gray-500' };
    };

    const CanjeCard = ({ canje, index }) => {
        const estadoInfo = getEstadoInfo(canje.estado, canje.tipo);
        return (
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-card rounded-2xl shadow-lg p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
            >
                <div className="flex items-center gap-4 flex-1">
                    <div className="bg-muted p-3 rounded-lg">
                        {canje.tipo === 'servicio' ? <Wrench className="w-6 h-6 text-primary"/> : <Package className="w-6 h-6 text-primary"/>}
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-foreground">{canje.producto_nombre}</h3>
                        <p className="text-sm text-muted-foreground mt-1">Canjeado el {new Date(canje.fecha).toLocaleDateString('es-MX')}</p>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 self-start sm:self-center">
                     <span className="font-bold text-lg text-primary text-right">{canje.puntos_usados} pts</span>
                     <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${estadoInfo.bg} ${estadoInfo.text_color}`}>
                         {estadoInfo.icon}
                         <span>{estadoInfo.text}</span>
                    </div>
                </div>
            </motion.div>
        );
    }
    
    const canjesOrdenados = historial.canjes.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
    const productosCanjeados = canjesOrdenados.filter(c => c.tipo === 'producto');
    const serviciosCanjeados = canjesOrdenados.filter(c => c.tipo === 'servicio');


    return (
        <>
            <Helmet><title>Mis Canjes - Manny</title></Helmet>
            <main className="flex-1 container mx-auto px-4 py-8">
                 <Link to="/dashboard" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6"><ArrowLeft size={16} />Volver al Dashboard</Link>
                <motion.h1 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-3xl md:text-4xl font-bold text-foreground mb-8 flex items-center gap-3"><History className="w-8 h-8 text-primary" />Mi Historial</motion.h1>

                {loading ? <div className="text-center py-12"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary" /></div>
                : canjesOrdenados.length > 0 ? (
                    <div className="space-y-12">
                        {productosCanjeados.length > 0 && (
                            <section>
                                <h2 className="text-2xl font-bold flex items-center gap-3 mb-4"><Package className="text-blue-500" />Mis Productos Canjeados</h2>
                                <div className="space-y-4">{productosCanjeados.map((c, i) => <CanjeCard key={c.id} canje={c} index={i} />)}</div>
                            </section>
                        )}
                        {serviciosCanjeados.length > 0 && (
                             <section>
                                <h2 className="text-2xl font-bold flex items-center gap-3 mb-4"><Wrench className="text-green-500" />Mis Servicios Canjeados</h2>
                                <div className="space-y-4">{serviciosCanjeados.map((c, i) => <CanjeCard key={c.id} canje={c} index={i} />)}</div>
                            </section>
                        )}
                    </div>
                ) : (
                     <div className="text-center py-16 bg-card rounded-2xl shadow-lg">
                        <p className="text-muted-foreground text-lg">Aún no has realizado ningún canje.</p>
                     </div>
                )}
            </main>
        </>
    );
};

export default MisCanjes;