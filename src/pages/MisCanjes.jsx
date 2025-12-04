
import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { History, Loader2, ArrowLeft, PackageCheck, Hourglass, Wrench, Calendar, CheckCircle, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useSupabaseAPI } from '@/context/SupabaseContext';
import { useToast } from '@/components/ui/use-toast';

const MisCanjes = () => {
    const { user } = useAuth();
    const api = useSupabaseAPI();
    const { toast } = useToast();
    const [historial, setHistorial] = useState({ canjes: [], servicios: [] });
    const [loading, setLoading] = useState(true);

    const fetchHistorial = useCallback(async () => {
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
            toast({
                title: "Error de Historial",
                description: "No pudimos cargar tu historial de canjes.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    }, [user?.telefono, api, toast]);

    useEffect(() => {
        fetchHistorial();
    }, [fetchHistorial]);

    const getEstadoInfo = (estado) => {
        const statuses = {
            'pendiente_entrega': { text: 'Se entrega en próximo servicio', icon: <Hourglass className="w-5 h-5 text-yellow-500" />, bg: 'bg-yellow-500/10 dark:bg-yellow-500/20', text_color: 'text-yellow-700 dark:text-yellow-300' },
            'entregado': { text: 'Entregado', icon: <PackageCheck className="w-5 h-5 text-green-500" />, bg: 'bg-green-500/10 dark:bg-green-500/20', text_color: 'text-green-700 dark:text-green-300' },
            'en_lista': { text: 'Te contactaremos para coordinar', icon: <Hourglass className="w-5 h-5 text-blue-500" />, bg: 'bg-blue-500/10 dark:bg-blue-500/20', text_color: 'text-blue-700 dark:text-blue-300' },
            'agendado': { text: 'Agendado', icon: <Calendar className="w-5 h-5 text-purple-500" />, bg: 'bg-purple-500/10 dark:bg-purple-500/20', text_color: 'text-purple-700 dark:text-purple-300' },
            'completado': { text: 'Completado', icon: <CheckCircle className="w-5 h-5 text-green-500" />, bg: 'bg-green-500/10 dark:bg-green-500/20', text_color: 'text-green-700 dark:text-green-300' },
        };
        return statuses[estado] || { text: 'Estado desconocido', icon: <Hourglass className="w-5 h-5" />, bg: 'bg-gray-500/10', text_color: 'text-gray-500' };
    };

    const CanjeCard = React.memo(({ canje, index }) => {
        const estadoInfo = getEstadoInfo(canje.estado);
        const IconoTipo = canje.tipo === 'servicio' ? Wrench : Package;
        
        return (
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05, type: 'spring', stiffness: 100 }}
                className="bg-card rounded-2xl shadow-sm border border-border/50 p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
            >
                <div className="flex items-center gap-4 flex-1">
                    <div className="bg-muted p-3 rounded-lg flex-shrink-0">
                        <IconoTipo className="w-6 h-6 text-primary"/>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-foreground">{canje.producto_nombre}</h3>
                        <p className="text-sm text-muted-foreground mt-1">Canjeado el {new Date(canje.fecha).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 self-stretch sm:self-center w-full sm:w-auto">
                     <span className="font-mono font-bold text-lg text-primary text-left sm:text-right flex-shrink-0">{canje.puntos_usados} pts</span>
                     <div className={`flex items-center justify-center sm:justify-start gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${estadoInfo.bg} ${estadoInfo.text_color}`}>
                         {estadoInfo.icon}
                         <span className="truncate">{estadoInfo.text}</span>
                    </div>
                </div>
            </motion.div>
        );
    });
    
    const canjesOrdenados = [...(historial?.canjes || [])].sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

    return (
        <>
            <Helmet><title>Mis Canjes - Manny</title></Helmet>
            
                 <Link to="/dashboard" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6"><ArrowLeft size={16} />Volver al Dashboard</Link>
                <motion.h1 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-3xl md:text-4xl font-bold text-foreground mb-8 flex items-center gap-3"><History className="w-8 h-8 text-primary" />Mi Historial</motion.h1>

                {loading ? <div className="text-center py-12"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary" /></div>
                : canjesOrdenados.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {canjesOrdenados.map((c, i) => <CanjeCard key={c.id} canje={c} index={i} />)}
                    </div>
                ) : (
                     <motion.div initial={{opacity: 0, scale: 0.95}} animate={{opacity: 1, scale: 1}} className="text-center py-16 bg-card rounded-2xl shadow-sm border border-border/50">
                        <History className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                        <h2 className="text-xl font-bold text-foreground">Sin movimientos</h2>
                        <p className="text-muted-foreground text-lg mt-2">Aún no has realizado ningún canje.</p>
                        <Link to="/dashboard">
                           <button className="mt-6 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
                             Ver Catálogo
                           </button>
                        </Link>
                     </motion.div>
                )}
        </>
    );
};

export default MisCanjes;
