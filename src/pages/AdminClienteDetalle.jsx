
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ArrowLeft, User, Phone, Coins, Crown, Calendar, Gift, History,
    PlusCircle, Trash2, Loader2, Package, Wrench, CheckCircle,
    Hourglass, PackageCheck, DollarSign, TrendingUp, Clock, KeyRound,
    Sparkles, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/services/api';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate } from '@/lib/utils';

const AdminClienteDetalle = () => {
    const { clienteId } = useParams();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [activeTab, setActiveTab] = useState('historial');
    const [showPointsModal, setShowPointsModal] = useState(false);
    const [showServiceModal, setShowServiceModal] = useState(false);
    const [showLevelModal, setShowLevelModal] = useState(false);
    const [showResetPinModal, setShowResetPinModal] = useState(false);
    const [deleteService, setDeleteService] = useState(null);
    const [markingBeneficioId, setMarkingBeneficioId] = useState(null);

    const { data, isLoading: loading, error } = useQuery({
        queryKey: ['admin-cliente-detalle', clienteId],
        queryFn: () => api.clients.getClienteDetalleAdmin(clienteId),
    });

    const { cliente, canjes, historialPuntos, serviciosAsignados, historialServicios, stats } = data || {};

    // Obtener beneficios de regalos/campañas
    const { data: beneficiosRegalo = [], isLoading: loadingBeneficios } = useQuery({
        queryKey: ['cliente-beneficios-regalo', clienteId],
        queryFn: () => api.gifts.getClienteBeneficios(clienteId),
        enabled: !!clienteId,
    });

    // Mutation para marcar beneficio como usado
    const marcarUsadoMutation = useMutation({
        mutationFn: ({ beneficioId, adminId }) => api.gifts.marcarBeneficioUsado(beneficioId, adminId),
        onSuccess: () => {
            toast({ title: 'Beneficio marcado como usado' });
            setMarkingBeneficioId(null);
            queryClient.invalidateQueries(['cliente-beneficios-regalo', clienteId]);
        },
        onError: (error) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
            setMarkingBeneficioId(null);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: api.services.eliminarServicioAsignado,
        onSuccess: () => {
            toast({ title: 'Beneficio eliminado' });
            setDeleteService(null);
            queryClient.invalidateQueries(['admin-cliente-detalle', clienteId]);
        },
        onError: (error) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    });

    const handleDeleteService = () => {
        if (!deleteService) return;
        deleteMutation.mutate(deleteService.id);
    };

    if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }

    const getEstadoInfo = (estado) => {
        const statuses = {
            'pendiente_entrega': { text: 'Pendiente', icon: <Hourglass className="w-3 h-3" />, color: 'bg-yellow-500/10 text-yellow-600' },
            'entregado': { text: 'Entregado', icon: <PackageCheck className="w-3 h-3" />, color: 'bg-green-500/10 text-green-600' },
            'en_lista': { text: 'En Lista', icon: <Hourglass className="w-3 h-3" />, color: 'bg-blue-500/10 text-blue-600' },
            'agendado': { text: 'Agendado', icon: <Calendar className="w-3 h-3" />, color: 'bg-purple-500/10 text-purple-600' },
            'completado': { text: 'Completado', icon: <CheckCircle className="w-3 h-3" />, color: 'bg-green-500/10 text-green-600' },
        };
        return statuses[estado] || { text: estado, icon: <Hourglass className="w-3 h-3" />, color: 'bg-muted text-muted-foreground' };
    };

    const getTimeAgo = (dateString) => {
        if (!dateString) return null;
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Hoy';
        if (diffDays === 1) return 'Ayer';
        if (diffDays < 30) return `Hace ${diffDays} días`;
        if (diffDays < 60) return 'Hace 1 mes';
        if (diffDays < 365) return `Hace ${Math.floor(diffDays / 30)} meses`;
        return `Hace ${Math.floor(diffDays / 365)} año(s)`;
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
            </div>
        );
    }

    if (!cliente) {
        return (
            <div className="py-8 text-center">
                <p className="text-muted-foreground">Cliente no encontrado.</p>
                <Link to="/admin/clientes">
                    <Button variant="outline" className="mt-4">Volver a Clientes</Button>
                </Link>
            </div>
        );
    }

    return (
        <>
            <Helmet>
                <title>{cliente.nombre} - Admin Manny</title>
            </Helmet>

            <div className="space-y-6">
                {/* Header */}
                <Link to="/admin/clientes" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6">
                    <ArrowLeft size={16} />
                    Volver a Clientes
                </Link>

                {/* Cliente Info Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card rounded-2xl shadow-xl p-6 mb-6 border border-border"
                >
                    <div className="flex flex-col lg:flex-row justify-between gap-6">
                        <div className="flex items-start gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 flex-wrap">
                                    <h1 className="text-2xl md:text-3xl font-bold text-foreground">{cliente.nombre}</h1>
                                    <Badge className={cliente.nivel === 'vip' ? 'bg-amber-500' : 'bg-blue-500'}>
                                        {cliente.nivel === 'vip' ? <><Crown className="w-3 h-3 mr-1" />VIP</> : 'Partner'}
                                    </Badge>
                                    {cliente.es_admin && <Badge variant="outline">Admin</Badge>}
                                </div>
                                <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                                    <Phone className="w-4 h-4" />
                                    <span>{cliente.telefono}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-muted-foreground text-sm">
                                    <Calendar className="w-4 h-4" />
                                    <span>Cliente desde {formatDate(cliente.created_at)}</span>
                                </div>
                                {stats?.ultimo_servicio && (
                                    <div className="flex items-center gap-2 mt-1 text-muted-foreground text-sm">
                                        <Clock className="w-4 h-4" />
                                        <span>Último servicio: {getTimeAgo(stats.ultimo_servicio)}</span>
                                    </div>
                                )}
                            </div>
                            <div className="bg-primary/10 p-4 rounded-xl flex-shrink-0 lg:hidden">
                                <User className="w-10 h-10 text-primary" />
                            </div>
                        </div>

                        <div className="flex flex-col items-start lg:items-end gap-4">
                            <div className="bg-primary/10 rounded-xl px-6 py-4 text-center">
                                <div className="flex items-center gap-2 text-primary mb-1">
                                    <Coins className="w-5 h-5" />
                                    <span className="text-sm font-medium">Puntos Actuales</span>
                                </div>
                                <p className="text-4xl font-black text-primary">{cliente.puntos_actuales?.toLocaleString('es-MX') || 0}</p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Button size="sm" variant="outline" onClick={() => setShowPointsModal(true)}>
                                    <PlusCircle className="w-4 h-4 mr-1" />
                                    Puntos
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setShowServiceModal(true)}>
                                    <Gift className="w-4 h-4 mr-1" />
                                    Beneficio
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setShowLevelModal(true)}>
                                    <Crown className="w-4 h-4 mr-1" />
                                    Nivel
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setShowResetPinModal(true)}>
                                    <KeyRound className="w-4 h-4 mr-1" />
                                    PIN
                                </Button>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Stats Cards */}
                {stats && (stats.total_servicios > 0 || stats.total_canjes > 0) && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6"
                    >
                        <div className="bg-card rounded-xl p-4 border border-border">
                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                <Wrench className="w-4 h-4" />
                                <span className="text-xs font-medium">Servicios</span>
                            </div>
                            <p className="text-2xl font-bold text-foreground">{stats.total_servicios}</p>
                        </div>
                        <div className="bg-card rounded-xl p-4 border border-border">
                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                <DollarSign className="w-4 h-4" />
                                <span className="text-xs font-medium">Invertido</span>
                            </div>
                            <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.total_invertido)}</p>
                        </div>
                        <div className="bg-card rounded-xl p-4 border border-border">
                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                <TrendingUp className="w-4 h-4" />
                                <span className="text-xs font-medium">Pts Generados</span>
                            </div>
                            <p className="text-2xl font-bold text-green-600">+{stats.total_puntos_generados?.toLocaleString('es-MX')}</p>
                        </div>
                        <div className="bg-card rounded-xl p-4 border border-border">
                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                <Package className="w-4 h-4" />
                                <span className="text-xs font-medium">Canjes</span>
                            </div>
                            <p className="text-2xl font-bold text-foreground">{stats.total_canjes}</p>
                        </div>
                    </motion.div>
                )}

                {/* Tabs */}
                <div className="flex border-b border-border mb-6 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('historial')}
                        className={`flex-none px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${activeTab === 'historial' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}
                    >
                        <Wrench className="w-4 h-4 inline mr-1 sm:mr-2" />
                        Historial ({historialServicios.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('canjes')}
                        className={`flex-none px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${activeTab === 'canjes' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}
                    >
                        <Package className="w-4 h-4 inline mr-1 sm:mr-2" />
                        Canjes ({canjes.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('puntos')}
                        className={`flex-none px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${activeTab === 'puntos' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}
                    >
                        <Coins className="w-4 h-4 inline mr-1 sm:mr-2" />
                        Puntos ({historialPuntos.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('servicios')}
                        className={`flex-none px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${activeTab === 'servicios' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}
                    >
                        <Gift className="w-4 h-4 inline mr-1 sm:mr-2" />
                        Beneficios ({serviciosAsignados.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('regalos')}
                        className={`flex-none px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${activeTab === 'regalos' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}
                    >
                        <Sparkles className="w-4 h-4 inline mr-1 sm:mr-2" />
                        Regalos ({beneficiosRegalo.length})
                    </button>
                </div>

                {/* Tab Content */}
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    {/* Historial de Servicios Tab */}
                    {activeTab === 'historial' && (
                        <div className="space-y-3">
                            {historialServicios.length > 0 ? historialServicios.map((servicio) => {
                                const hasMonto = servicio.monto && Number(servicio.monto) > 0;
                                const hasPuntos = servicio.puntos_generados && servicio.puntos_generados > 0;
                                return (
                                    <div key={servicio.id} className="bg-card rounded-xl p-4 border border-border">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2.5 rounded-lg flex-shrink-0 bg-primary/10">
                                                <Wrench className="w-5 h-5 text-primary" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                {servicio.tipo_trabajo && (
                                                    <span className="inline-block px-2 py-0.5 bg-muted text-muted-foreground text-[10px] font-medium rounded-md mb-1 uppercase tracking-wide">
                                                        {servicio.tipo_trabajo}
                                                    </span>
                                                )}
                                                <p className="font-semibold text-foreground">
                                                    {servicio.titulo || `Ticket ${servicio.ticket_number}`}
                                                </p>
                                                {servicio.descripcion && (
                                                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                                        {servicio.descripcion}
                                                    </p>
                                                )}
                                                <p className="text-xs text-muted-foreground mt-2">
                                                    {formatDate(servicio.fecha_servicio)}
                                                </p>
                                            </div>
                                            {hasMonto && (
                                                <div className="text-right flex-shrink-0">
                                                    <p className="font-bold text-foreground">{formatCurrency(servicio.monto)}</p>
                                                    {hasPuntos && (
                                                        <p className="text-xs text-green-600 font-medium">+{servicio.puntos_generados} pts</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            }) : (
                                <div className="text-center py-12 bg-card rounded-xl border border-border">
                                    <Wrench className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                                    <p className="text-muted-foreground">No hay servicios registrados para este cliente.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Canjes Tab */}
                    {activeTab === 'canjes' && (
                        <div className="space-y-3">
                            {canjes.length > 0 ? canjes.map((canje) => {
                                const estadoInfo = getEstadoInfo(canje.estado);
                                const isService = canje.tipo === 'servicio';
                                return (
                                    <div key={canje.id} className="bg-card rounded-xl p-4 border border-border">
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2.5 rounded-lg flex-shrink-0 ${isService ? 'bg-emerald-500/10' : 'bg-sky-500/10'}`}>
                                                {isService ? <Wrench className="w-5 h-5 text-emerald-600" /> : <Package className="w-5 h-5 text-sky-600" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-foreground truncate">{canje.producto_nombre}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatDate(canje.created_at)}
                                                </p>
                                            </div>
                                            <span className="font-mono font-bold text-red-500 flex-shrink-0">-{canje.puntos_usados}</span>
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-border/50">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${estadoInfo.color}`}>
                                                {estadoInfo.icon}
                                                {estadoInfo.text}
                                            </span>
                                        </div>
                                    </div>
                                );
                            }) : (
                                <div className="text-center py-12 bg-card rounded-xl border border-border">
                                    <Package className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                                    <p className="text-muted-foreground">Este cliente no ha realizado canjes.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Historial Puntos Tab */}
                    {activeTab === 'puntos' && (
                        <div className="space-y-3">
                            {historialPuntos.length > 0 ? historialPuntos.map((item) => {
                                const isPositive = item.puntos >= 0;
                                return (
                                    <div key={item.id} className="bg-card rounded-xl p-4 border border-border">
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2.5 rounded-lg flex-shrink-0 ${isPositive ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                                                <Coins className={`w-5 h-5 ${isPositive ? 'text-green-600' : 'text-red-500'}`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-foreground truncate">{item.concepto}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatDate(item.created_at)}
                                                </p>
                                            </div>
                                            <span className={`font-mono font-bold flex-shrink-0 ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                                                {isPositive ? '+' : ''}{item.puntos}
                                            </span>
                                        </div>
                                    </div>
                                );
                            }) : (
                                <div className="text-center py-12 bg-card rounded-xl border border-border">
                                    <History className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                                    <p className="text-muted-foreground">No hay movimientos de puntos registrados.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Servicios Asignados Tab */}
                    {activeTab === 'servicios' && (
                        <div className="space-y-3">
                            {serviciosAsignados.length > 0 ? serviciosAsignados.map((servicio) => {
                                const isAvailable = servicio.estado === 'disponible';
                                return (
                                    <div key={servicio.id} className="bg-card rounded-xl p-4 border border-border">
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2.5 rounded-lg flex-shrink-0 ${isAvailable ? 'bg-primary/10' : 'bg-muted'}`}>
                                                <Gift className={`w-5 h-5 ${isAvailable ? 'text-primary' : 'text-muted-foreground'}`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-foreground truncate">{servicio.nombre}</p>
                                                {servicio.descripcion && <p className="text-sm text-muted-foreground truncate">{servicio.descripcion}</p>}
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {formatDate(servicio.created_at)}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${isAvailable ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                                                    {isAvailable ? 'Activo' : 'Usado'}
                                                </span>
                                                {isAvailable && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteService(servicio)}>
                                                        <Trash2 className="w-4 h-4 text-destructive" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            }) : (
                                <div className="text-center py-12 bg-card rounded-xl border border-border">
                                    <Gift className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                                    <p className="text-muted-foreground">No hay beneficios asignados.</p>
                                    <Button variant="outline" className="mt-4" onClick={() => setShowServiceModal(true)}>
                                        <PlusCircle className="w-4 h-4 mr-2" />
                                        Asignar Beneficio
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Regalos/Campañas Tab */}
                    {activeTab === 'regalos' && (
                        <div className="space-y-3">
                            {loadingBeneficios ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                </div>
                            ) : beneficiosRegalo.length > 0 ? beneficiosRegalo.map((beneficio) => {
                                const isActive = beneficio.estado === 'activo';
                                const isUsed = beneficio.estado === 'usado';
                                const isExpired = beneficio.estado === 'expirado';
                                const isMarking = markingBeneficioId === beneficio.id;

                                // Calcular días restantes
                                const daysRemaining = beneficio.fecha_expiracion
                                    ? Math.ceil((new Date(beneficio.fecha_expiracion) - new Date()) / (1000 * 60 * 60 * 24))
                                    : null;
                                const isExpiringSoon = daysRemaining !== null && daysRemaining <= 30 && daysRemaining > 0;

                                return (
                                    <div key={beneficio.id} className="bg-card rounded-xl p-4 border border-border">
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2.5 rounded-lg flex-shrink-0 ${
                                                isActive ? 'bg-purple-500/10' : isUsed ? 'bg-blue-500/10' : 'bg-muted'
                                            }`}>
                                                <Sparkles className={`w-5 h-5 ${
                                                    isActive ? 'text-purple-500' : isUsed ? 'text-blue-500' : 'text-muted-foreground'
                                                }`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="font-semibold text-foreground">{beneficio.nombre_beneficio}</p>
                                                    {beneficio.link?.nombre_campana && (
                                                        <span className="px-2 py-0.5 text-[10px] font-medium bg-purple-500/10 text-purple-500 rounded-full">
                                                            {beneficio.link.nombre_campana}
                                                        </span>
                                                    )}
                                                </div>
                                                {beneficio.descripcion && (
                                                    <p className="text-sm text-muted-foreground mt-1">{beneficio.descripcion}</p>
                                                )}
                                                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                                                    <span>Canjeado: {formatDate(beneficio.fecha_canje)}</span>
                                                    {beneficio.fecha_expiracion && (
                                                        <span className={isExpiringSoon ? 'text-orange-500 flex items-center gap-1' : ''}>
                                                            {isExpiringSoon && <AlertTriangle className="w-3 h-3" />}
                                                            Expira: {formatDate(beneficio.fecha_expiracion)}
                                                            {isExpiringSoon && ` (${daysRemaining}d)`}
                                                        </span>
                                                    )}
                                                    {isUsed && beneficio.fecha_uso && (
                                                        <span className="text-blue-500">Usado: {formatDate(beneficio.fecha_uso)}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                    isActive ? 'bg-green-500/10 text-green-600' :
                                                    isUsed ? 'bg-blue-500/10 text-blue-600' :
                                                    'bg-red-500/10 text-red-500'
                                                }`}>
                                                    {isActive ? 'Activo' : isUsed ? 'Usado' : 'Expirado'}
                                                </span>
                                                {isActive && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        disabled={isMarking || marcarUsadoMutation.isPending}
                                                        onClick={() => {
                                                            setMarkingBeneficioId(beneficio.id);
                                                            marcarUsadoMutation.mutate({
                                                                beneficioId: beneficio.id,
                                                                adminId: cliente.id // Use client ID for now
                                                            });
                                                        }}
                                                    >
                                                        {isMarking ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <>
                                                                <CheckCircle className="w-4 h-4 mr-1" />
                                                                Marcar usado
                                                            </>
                                                        )}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            }) : (
                                <div className="text-center py-12 bg-card rounded-xl border border-border">
                                    <Sparkles className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                                    <p className="text-muted-foreground">Este cliente no ha canjeado regalos de campañas.</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Los regalos aparecen aquí cuando el cliente canjea un link de regalo.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </motion.div>
            </div>

            {/* Modal: Asignar Puntos */}
            <AssignPointsModal
                open={showPointsModal}
                onClose={() => setShowPointsModal(false)}
                cliente={cliente}
            />

            {/* Modal: Asignar Servicio */}
            <AssignServiceModal
                open={showServiceModal}
                onClose={() => setShowServiceModal(false)}
                cliente={cliente}
            />

            {/* Modal: Cambiar Nivel */}
            <ChangeLevelModal
                open={showLevelModal}
                onClose={() => setShowLevelModal(false)}
                cliente={cliente}
            />

            {/* Modal: Resetear PIN */}
            <ResetPinModal
                open={showResetPinModal}
                onClose={() => setShowResetPinModal(false)}
                cliente={cliente}
            />

            {/* Modal: Confirmar Eliminar Servicio */}
            <Dialog open={!!deleteService} onOpenChange={() => setDeleteService(null)}>
                <DialogContent className="bg-card border-border">
                    <DialogHeader>
                        <DialogTitle>Eliminar Beneficio</DialogTitle>
                        <DialogDescription>
                            ¿Eliminar "{deleteService?.nombre}" de {cliente.nombre}?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Cancelar</Button>
                        </DialogClose>
                        <Button variant="destructive" onClick={handleDeleteService}>Eliminar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

// Sub-components for modals
const AssignPointsModal = ({ open, onClose, cliente, onSuccess }) => {
    const [points, setPoints] = useState('');
    const [concept, setConcept] = useState('');
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: ({ telefono, puntos, concepto }) => api.clients.asignarPuntosManualmente(telefono, puntos, concepto),
        onSuccess: (data, variables) => {
            toast({ title: `${variables.puntos} puntos asignados a ${cliente.nombre}` });
            setPoints('');
            setConcept('');
            onClose();
            // Invalidate the query to refresh data
            queryClient.invalidateQueries(['admin-cliente-detalle', cliente.id]);
        },
        onError: (error) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!points || !concept.trim()) {
            toast({ title: 'Completa todos los campos', variant: 'destructive' });
            return;
        }
        mutation.mutate({ telefono: cliente.telefono, puntos: parseInt(points), concepto: concept });
    };

    const isSubmitting = mutation.isPending;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="bg-card border-border">
                <DialogHeader>
                    <DialogTitle>Asignar Puntos a {cliente?.nombre}</DialogTitle>
                    <DialogDescription>Usa números negativos para restar puntos.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Puntos</Label>
                        <Input type="number" placeholder="Ej: 50 o -20" value={points} onChange={(e) => setPoints(e.target.value)} className="h-12" />
                    </div>
                    <div className="space-y-2">
                        <Label>Concepto</Label>
                        <Input placeholder="Ej: Bono por referido" value={concept} onChange={(e) => setConcept(e.target.value)} className="h-12" />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Asignar
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

const AssignServiceModal = ({ open, onClose, cliente, onSuccess }) => {
    const [name, setName] = useState('');
    const [desc, setDesc] = useState('');
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: api.services.crearServicioAsignado,
        onSuccess: () => {
            toast({ title: `Beneficio asignado a ${cliente.nombre}` });
            setName('');
            setDesc('');
            onClose();
            queryClient.invalidateQueries(['admin-cliente-detalle', cliente.id]);
        },
        onError: (error) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) {
            toast({ title: 'El nombre es requerido', variant: 'destructive' });
            return;
        }
        mutation.mutate({ cliente_id: cliente.id, nombre: name, descripcion: desc });
    };

    const isSubmitting = mutation.isPending;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="bg-card border-border">
                <DialogHeader>
                    <DialogTitle>Asignar Beneficio a {cliente?.nombre}</DialogTitle>
                    <DialogDescription>Crea un beneficio exclusivo que el cliente podrá usar.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Nombre del Beneficio</Label>
                        <Input placeholder="Ej: Lavado Premium Gratis" value={name} onChange={(e) => setName(e.target.value)} className="h-12" />
                    </div>
                    <div className="space-y-2">
                        <Label>Descripción (opcional)</Label>
                        <Input placeholder="Ej: Incluye encerado" value={desc} onChange={(e) => setDesc(e.target.value)} className="h-12" />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Asignar
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

const ResetPinModal = ({ open, onClose, cliente }) => {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: () => api.auth.resetClientPin(cliente.id),
        onSuccess: () => {
            toast({
                title: 'PIN reseteado',
                description: `${cliente.nombre} deberá crear un nuevo PIN en su próximo inicio de sesión.`
            });
            onClose();
            queryClient.invalidateQueries(['admin-cliente-detalle', cliente.id]);
        },
        onError: (error) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    });

    const handleReset = () => {
        mutation.mutate();
    };

    const isSubmitting = mutation.isPending;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="bg-card border-border">
                <DialogHeader>
                    <DialogTitle>Resetear PIN de {cliente?.nombre}</DialogTitle>
                    <DialogDescription>
                        Esto eliminará el PIN actual del cliente. La próxima vez que inicie sesión, deberá crear uno nuevo.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-sm text-amber-600">
                        <p className="font-medium mb-1">¿Por qué resetear el PIN?</p>
                        <p className="text-amber-600/80">Solo usa esta opción si el cliente olvidó su PIN y te contactó para recuperar el acceso.</p>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancelar</Button>
                    </DialogClose>
                    <Button variant="destructive" onClick={handleReset} disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Resetear PIN
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const ChangeLevelModal = ({ open, onClose, cliente, onSuccess }) => {
    const [level, setLevel] = useState(cliente?.nivel || 'partner');
    const { toast } = useToast();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (cliente) setLevel(cliente.nivel || 'partner');
    }, [cliente]);

    const mutation = useMutation({
        mutationFn: ({ clienteId, nuevoNivel }) => api.clients.cambiarNivelCliente(clienteId, nuevoNivel),
        onSuccess: (data, variables) => {
            toast({ title: `${cliente.nombre} ahora es ${variables.nuevoNivel === 'vip' ? 'VIP' : 'Partner'}` });
            onClose();
            queryClient.invalidateQueries(['admin-cliente-detalle', cliente.id]);
        },
        onError: (error) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (level === cliente?.nivel) {
            onClose();
            return;
        }
        mutation.mutate({ clienteId: cliente.id, nuevoNivel: level });
    };

    const isSubmitting = mutation.isPending;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="bg-card border-border">
                <DialogHeader>
                    <DialogTitle>Cambiar Nivel de {cliente?.nombre}</DialogTitle>
                    <DialogDescription>Selecciona el nuevo nivel para este cliente.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Nivel Actual</Label>
                        <Badge className={cliente?.nivel === 'vip' ? 'bg-amber-500' : 'bg-blue-500'}>
                            {cliente?.nivel === 'vip' ? 'VIP' : 'Partner'}
                        </Badge>
                    </div>
                    <div className="space-y-2">
                        <Label>Nuevo Nivel</Label>
                        <Select value={level} onValueChange={setLevel}>
                            <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="partner">Partner</SelectItem>
                                <SelectItem value="vip">VIP</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
                        <Button type="submit" disabled={isSubmitting || level === cliente?.nivel}>
                            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Confirmar
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default AdminClienteDetalle;
