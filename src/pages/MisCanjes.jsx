
import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { History, Loader2, PackageCheck, Hourglass, Wrench, Calendar, CheckCircle, Package, Coins } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { logger } from '@/lib/logger';

const MisCanjes = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState('canjes');

    const { data: historial = { canjes: [], historialPuntos: [] }, isLoading: loading, error } = useQuery({
        queryKey: ['historial', user?.telefono],
        queryFn: () => api.clients.getClienteHistorial(user.telefono),
        enabled: !!user?.telefono,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    useEffect(() => {
        if (error) {
            logger.error('Error al cargar el historial', { error: error.message });
            toast({
                title: "Error de Historial",
                description: "No pudimos cargar tu historial.",
                variant: "destructive"
            });
        }
    }, [error, toast]);

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
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="bg-card rounded-xl shadow-sm border border-border p-4"
            >
                <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`p-2 rounded-lg flex-shrink-0 ${isService ? 'bg-primary/10' : 'bg-primary/10'}`}>
                        <IconoTipo className="w-4 h-4 text-primary" />
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground text-sm truncate">{canje.producto_nombre}</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            {new Date(canje.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                    </div>
                    {/* Puntos */}
                    <span className="font-mono font-bold text-sm text-red-500 flex-shrink-0">-{canje.puntos_usados}</span>
                </div>
                {/* Status */}
                <div className="mt-3 pt-3 border-t border-border">
                    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium ${estadoInfo.bg} ${estadoInfo.text_color}`}>
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
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="bg-card rounded-xl shadow-sm border border-border p-4"
            >
                <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`p-2 rounded-lg flex-shrink-0 ${isPositive ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                        <Coins className={`w-4 h-4 ${isPositive ? 'text-green-600' : 'text-red-500'}`}/>
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground text-sm truncate">{item.concepto}</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            {new Date(item.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                    </div>
                    {/* Puntos */}
                    <span className={`font-mono font-bold text-sm flex-shrink-0 ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
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

            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6"
            >
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
                    <History className="w-6 h-6 text-primary" />
                    Mi Historial
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Tus canjes y movimientos de puntos
                </p>
            </motion.div>

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
        initial={{opacity: 0, scale: 0.98}}
        animate={{opacity: 1, scale: 1}}
        className="text-center py-12 bg-card rounded-xl shadow-sm border border-border"
    >
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground/50">
            {icon}
        </div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-muted-foreground text-sm mt-1 max-w-xs mx-auto">{description}</p>
        <Link to="/dashboard">
           <Button className="mt-5" size="sm">Ver Catálogo</Button>
        </Link>
    </motion.div>
);

export default MisCanjes;
