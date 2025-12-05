
import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { History, Loader2, ArrowLeft, PackageCheck, Hourglass, Wrench, Calendar, CheckCircle, Package, Coins } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useSupabaseAPI } from '@/context/SupabaseContext';
import { useToast } from '@/components/ui/use-toast';

const MisCanjes = () => {
    const { user } = useAuth();
    const api = useSupabaseAPI();
    const { toast } = useToast();
    const [historial, setHistorial] = useState({ canjes: [], historialPuntos: [] });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('canjes');

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
                description: "No pudimos cargar tu historial.",
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
            'pendiente_entrega': { text: 'Próximo servicio', icon: <Hourglass className="w-4 h-4" />, bg: 'bg-yellow-500/10', text_color: 'text-yellow-600' },
            'entregado': { text: 'Entregado', icon: <PackageCheck className="w-4 h-4" />, bg: 'bg-green-500/10', text_color: 'text-green-600' },
            'en_lista': { text: 'Te contactaremos', icon: <Hourglass className="w-4 h-4" />, bg: 'bg-blue-500/10', text_color: 'text-blue-600' },
            'agendado': { text: 'Agendado', icon: <Calendar className="w-4 h-4" />, bg: 'bg-purple-500/10', text_color: 'text-purple-600' },
            'completado': { text: 'Completado', icon: <CheckCircle className="w-4 h-4" />, bg: 'bg-green-500/10', text_color: 'text-green-600' },
        };
        return statuses[estado] || { text: 'Pendiente', icon: <Hourglass className="w-4 h-4" />, bg: 'bg-muted', text_color: 'text-muted-foreground' };
    };

    const CanjeCard = React.memo(({ canje, index }) => {
        const estadoInfo = getEstadoInfo(canje.estado);
        const IconoTipo = canje.tipo === 'servicio' ? Wrench : Package;
        const isService = canje.tipo === 'servicio';

        return (
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05, type: 'spring', stiffness: 100 }}
                className="bg-card rounded-2xl shadow-sm border border-border/50 p-4"
            >
                <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`p-2.5 rounded-lg flex-shrink-0 ${isService ? 'bg-emerald-500/10' : 'bg-sky-500/10'}`}>
                        <IconoTipo className={`w-5 h-5 ${isService ? 'text-emerald-600' : 'text-sky-600'}`}/>
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-foreground truncate">{canje.producto_nombre}</h3>
                        <p className="text-sm text-muted-foreground">
                            {new Date(canje.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                    </div>
                    {/* Puntos */}
                    <span className="font-mono font-bold text-red-500 flex-shrink-0">-{canje.puntos_usados}</span>
                </div>
                {/* Status */}
                <div className="mt-3 pt-3 border-t border-border/50">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${estadoInfo.bg} ${estadoInfo.text_color}`}>
                        {estadoInfo.icon}
                        <span>{estadoInfo.text}</span>
                    </div>
                </div>
            </motion.div>
        );
    });

    const PuntosCard = React.memo(({ item, index }) => {
        const isPositive = item.puntos >= 0;

        return (
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05, type: 'spring', stiffness: 100 }}
                className="bg-card rounded-2xl shadow-sm border border-border/50 p-4"
            >
                <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`p-2.5 rounded-lg flex-shrink-0 ${isPositive ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                        <Coins className={`w-5 h-5 ${isPositive ? 'text-green-600' : 'text-red-500'}`}/>
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{item.concepto}</h3>
                        <p className="text-sm text-muted-foreground">
                            {new Date(item.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                    </div>
                    {/* Puntos */}
                    <span className={`font-mono font-bold flex-shrink-0 ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                        {isPositive ? '+' : ''}{item.puntos}
                    </span>
                </div>
            </motion.div>
        );
    });

    const canjesOrdenados = [...(historial?.canjes || [])].sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
    const puntosOrdenados = [...(historial?.historialPuntos || [])].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

    const hasCanjes = canjesOrdenados.length > 0;
    const hasPuntos = puntosOrdenados.length > 0;

    return (
        <>
            <Helmet><title>Mi Historial - Manny</title></Helmet>

            <Link to="/dashboard" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6">
                <ArrowLeft size={16} />Volver al Dashboard
            </Link>

            <motion.h1
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-3xl md:text-4xl font-bold text-foreground mb-6 flex items-center gap-3"
            >
                <History className="w-8 h-8 text-primary" />
                Mi Historial
            </motion.h1>

            {/* Tabs */}
            <div className="flex border-b border-border mb-6">
                <button
                    onClick={() => setActiveTab('canjes')}
                    className={`px-4 py-3 text-sm md:text-base font-semibold transition-colors ${activeTab === 'canjes' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    <Package className="w-4 h-4 inline mr-2" />
                    Mis Canjes ({canjesOrdenados.length})
                </button>
                <button
                    onClick={() => setActiveTab('puntos')}
                    className={`px-4 py-3 text-sm md:text-base font-semibold transition-colors ${activeTab === 'puntos' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    <Coins className="w-4 h-4 inline mr-2" />
                    Movimientos ({puntosOrdenados.length})
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12">
                    <Loader2 className="animate-spin h-8 w-8 mx-auto text-primary" />
                </div>
            ) : (
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    {activeTab === 'canjes' && (
                        hasCanjes ? (
                            <div className="space-y-3">
                                {canjesOrdenados.map((c, i) => <CanjeCard key={c.id} canje={c} index={i} />)}
                            </div>
                        ) : (
                            <EmptyState
                                icon={<Package className="w-12 h-12" />}
                                title="Sin canjes"
                                description="Aún no has canjeado ninguna recompensa."
                            />
                        )
                    )}

                    {activeTab === 'puntos' && (
                        hasPuntos ? (
                            <div className="space-y-3">
                                {puntosOrdenados.map((p, i) => <PuntosCard key={p.id} item={p} index={i} />)}
                            </div>
                        ) : (
                            <EmptyState
                                icon={<Coins className="w-12 h-12" />}
                                title="Sin movimientos"
                                description="Aún no tienes movimientos de puntos registrados."
                            />
                        )
                    )}
                </motion.div>
            )}
        </>
    );
};

const EmptyState = ({ icon, title, description }) => (
    <motion.div
        initial={{opacity: 0, scale: 0.95}}
        animate={{opacity: 1, scale: 1}}
        className="text-center py-16 bg-card rounded-2xl shadow-sm border border-border/50"
    >
        <div className="mx-auto text-muted-foreground/50 mb-4">{icon}</div>
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
        <p className="text-muted-foreground text-lg mt-2">{description}</p>
        <Link to="/dashboard">
           <Button className="mt-4">Ver Catálogo</Button>
        </Link>
    </motion.div>
);

export default MisCanjes;
