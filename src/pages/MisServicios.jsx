import React, { useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import {
    Wrench,
    Loader2,
    Calendar,
    Coins
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import { logger } from '@/lib/logger';

const MisServicios = () => {
    const { user } = useAuth();
    const { toast } = useToast();

    const { data: servicios = [], isLoading: loadingServicios, error: errorServicios } = useQuery({
        queryKey: ['servicios', user?.id],
        queryFn: () => api.services.getHistorialServicios(user.id),
        enabled: !!user?.id,
        staleTime: 1000 * 60 * 5,
    });

    const { data: stats, isLoading: loadingStats } = useQuery({
        queryKey: ['servicios-stats', user?.id],
        queryFn: () => api.services.getHistorialServiciosStats(user.id),
        enabled: !!user?.id,
        staleTime: 1000 * 60 * 10,
    });

    const loading = loadingServicios || loadingStats;

    useEffect(() => {
        if (errorServicios) {
            logger.error('Error al cargar historial de servicios', { error: errorServicios.message });
            toast({
                title: "Error",
                description: "No pudimos cargar tu historial de servicios.",
                variant: "destructive"
            });
        }
    }, [errorServicios, toast]);

    // Ordenar servicios por fecha (más reciente primero)
    const serviciosOrdenados = useMemo(() => {
        return [...servicios].sort((a, b) => new Date(b.fecha_servicio) - new Date(a.fecha_servicio));
    }, [servicios]);

    // Componente para las estadísticas
    const StatsHeader = () => {
        if (!stats) return null;

        const hasPuntos = stats.total_puntos > 0;
        const hasServicios = stats.total_servicios > 0;

        // Si no hay ninguna estadística con valor, no mostrar nada
        if (!hasPuntos && !hasServicios) return null;

        return (
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-2 gap-3 mb-6"
            >
                {hasServicios && (
                    <div className="bg-card rounded-xl p-3 border border-border shadow-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
                            <Wrench className="w-3.5 h-3.5" />
                            <span className="text-xs font-medium uppercase tracking-wide">Servicios</span>
                        </div>
                        <p className="text-xl font-bold text-foreground">{stats.total_servicios}</p>
                    </div>
                )}
                {hasPuntos && (
                    <div className="bg-card rounded-xl p-3 border border-border shadow-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
                            <Coins className="w-3.5 h-3.5" />
                            <span className="text-xs font-medium uppercase tracking-wide">Puntos</span>
                        </div>
                        <p className="text-xl font-bold text-foreground">{stats.total_puntos.toLocaleString('es-MX')}</p>
                    </div>
                )}
            </motion.div>
        );
    };

    // Card de servicio individual
    const ServicioCard = React.memo(({ servicio, index }) => {
        const hasTipo = servicio.tipo_trabajo && servicio.tipo_trabajo.trim() !== '';
        const hasTitulo = servicio.titulo && servicio.titulo.trim() !== '';
        const hasDescripcion = servicio.descripcion && servicio.descripcion.trim() !== '';
        const hasMonto = servicio.monto > 0;
        const hasPuntos = servicio.puntos_generados > 0;

        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="bg-card rounded-xl shadow-sm border border-border p-4"
            >
                <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="p-2 rounded-lg flex-shrink-0 bg-primary/10">
                        <Wrench className="w-4 h-4 text-primary" />
                    </div>

                    {/* Info principal */}
                    <div className="flex-1 min-w-0">
                        {/* Tipo de trabajo como badge si existe */}
                        {hasTipo && (
                            <span className="inline-block px-2 py-0.5 bg-muted text-muted-foreground text-xs font-medium rounded-md mb-1 uppercase tracking-wide">
                                {servicio.tipo_trabajo}
                            </span>
                        )}

                        {/* Título o número de ticket */}
                        <h3 className="font-semibold text-foreground text-sm">
                            {hasTitulo ? servicio.titulo : `Ticket ${servicio.ticket_number}`}
                        </h3>

                        {/* Descripción si existe */}
                        {hasDescripcion && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {servicio.descripcion}
                            </p>
                        )}

                        {/* Fecha */}
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            <span>{formatDate(servicio.fecha_servicio)}</span>
                        </div>
                    </div>

                    {/* Monto y puntos (solo si hay monto) */}
                    {hasMonto && (
                        <div className="text-right flex-shrink-0">
                            <p className="font-bold text-sm text-foreground">{formatCurrency(servicio.monto)}</p>
                            {hasPuntos && (
                                <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-0.5">+{servicio.puntos_generados} pts</p>
                            )}
                        </div>
                    )}
                </div>
            </motion.div>
        );
    });

    // Estado vacío
    const EmptyState = () => (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-12 bg-card rounded-xl shadow-sm border border-border"
        >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                <Wrench className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Sin servicios registrados</h2>
            <p className="text-muted-foreground text-sm mt-1 max-w-xs mx-auto">
                Aquí aparecerá tu historial de servicios con Manny.
            </p>
            <Link to="/dashboard">
                <button className="mt-5 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 transition-opacity">
                    Volver al Dashboard
                </button>
            </Link>
        </motion.div>
    );

    return (
        <>
            <Helmet>
                <title>Mis Servicios - Manny</title>
            </Helmet>

            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6"
            >
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
                    <Wrench className="w-6 h-6 text-primary" />
                    Mis Servicios
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Historial de trabajos realizados
                </p>
            </motion.div>

            {loading ? (
                <div className="text-center py-12">
                    <Loader2 className="animate-spin h-8 w-8 mx-auto text-primary" />
                </div>
            ) : serviciosOrdenados.length > 0 ? (
                <>
                    <StatsHeader />
                    <div className="space-y-3">
                        {serviciosOrdenados.map((servicio, index) => (
                            <ServicioCard key={servicio.id} servicio={servicio} index={index} />
                        ))}
                    </div>
                </>
            ) : (
                <EmptyState />
            )}
        </>
    );
};

export default MisServicios;
