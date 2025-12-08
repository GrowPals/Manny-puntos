import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import {
    Users,
    Loader2,
    Settings,
    Save,
    CheckCircle2,
    Clock,
    TrendingUp,
    Gift,
    Target,
    ChevronDown,
    ChevronUp,
    RefreshCw,
    Coins,
    UserPlus
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import { formatDate } from '@/lib/utils';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/EmptyState';
import StateBadge from '@/components/common/StateBadge';

const AdminReferidos = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [showConfigDialog, setShowConfigDialog] = useState(false);
    const [expandedReferidor, setExpandedReferidor] = useState(null);

    // Stats del programa
    const { data: stats = {}, isLoading: loadingStats } = useQuery({
        queryKey: ['admin-referidos-stats'],
        queryFn: api.referrals.getAdminReferralStats,
    });

    // Lista de referidos
    const { data: referidos = [], isLoading: loadingReferidos, refetch: refetchReferidos } = useQuery({
        queryKey: ['admin-referidos-list'],
        queryFn: api.referrals.getAllReferidos,
    });

    // Configuración del programa
    const { data: config = {}, isLoading: loadingConfig } = useQuery({
        queryKey: ['admin-referidos-config'],
        queryFn: api.referrals.getAdminReferralConfig,
    });

    const loading = loadingStats || loadingReferidos || loadingConfig;

    // Local editable state - synced from server config
    const [localConfig, setLocalConfig] = useState(null);

    // Sync local state when server config loads
    useEffect(() => {
        if (config && JSON.stringify(config) !== JSON.stringify(localConfig)) {
            setLocalConfig(config);
        }
    }, [config]); // eslint-disable-line react-hooks/exhaustive-deps

    // Mutation para actualizar config
    const configMutation = useMutation({
        mutationFn: api.referrals.updateReferralConfig,
        onSuccess: (data) => {
            queryClient.setQueryData(['admin-referidos-config'], data);
            toast({ title: "Guardado", description: "Configuración actualizada correctamente." });
            setShowConfigDialog(false);
        },
        onError: (error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    const handleSaveConfig = () => {
        if (!localConfig?.id) {
            toast({ title: "Error", description: "Configuración no cargada aún", variant: "destructive" });
            return;
        }
        configMutation.mutate(localConfig);
    };

    const handleToggleActive = (checked) => {
        // Use config from server if localConfig doesn't have id yet
        const baseConfig = localConfig?.id ? localConfig : config;
        if (!baseConfig?.id) {
            toast({ title: "Error", description: "Configuración no cargada aún", variant: "destructive" });
            return;
        }
        const newConfig = { ...baseConfig, activo: checked };
        setLocalConfig(newConfig);
        configMutation.mutate(newConfig);
    };

    // Agrupar referidos por referidor
    const referidosPorReferidor = referidos.reduce((acc, ref) => {
        const referidorId = ref.referidor_id;
        if (!acc[referidorId]) {
            acc[referidorId] = {
                referidor: ref.referidor,
                referidos: []
            };
        }
        acc[referidorId].referidos.push(ref);
        return acc;
    }, {});

    if (loading && !localConfig) {
        return <LoadingSpinner size="md" />;
    }

    return (
        <>
            <Helmet>
                <title>Referidos - Admin Manny</title>
            </Helmet>

            {/* Dialog de configuración */}
            <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
                <DialogContent className="bg-card border-border text-foreground max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-xl flex items-center gap-2">
                            <Settings className="w-5 h-5 text-primary" />
                            Configuración del Programa
                        </DialogTitle>
                        <DialogDescription>
                            Ajusta los valores de puntos y límites del programa de referidos.
                        </DialogDescription>
                    </DialogHeader>

                    {localConfig && (
                        <div className="space-y-6 py-4">
                            {/* Puntos */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                                    Puntos por Referido
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">
                                            Referidor recibe
                                        </label>
                                        <div className="relative">
                                            <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <Input
                                                type="number"
                                                value={localConfig.puntos_referidor || 0}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value) || 0;
                                                    setLocalConfig({
                                                        ...localConfig,
                                                        puntos_referidor: Math.max(0, val)
                                                    });
                                                }}
                                                className="pl-10"
                                                min={0}
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Puntos al quien invita
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">
                                            Referido recibe
                                        </label>
                                        <div className="relative">
                                            <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <Input
                                                type="number"
                                                value={localConfig.puntos_referido || 0}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value) || 0;
                                                    setLocalConfig({
                                                        ...localConfig,
                                                        puntos_referido: Math.max(0, val)
                                                    });
                                                }}
                                                className="pl-10"
                                                min={0}
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Puntos al invitado
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Límites */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                                    Límites
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">
                                            Límite mensual
                                        </label>
                                        <div className="relative">
                                            <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <Input
                                                type="number"
                                                value={localConfig.limite_mensual || 0}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value) || 0;
                                                    setLocalConfig({
                                                        ...localConfig,
                                                        limite_mensual: Math.max(0, val)
                                                    });
                                                }}
                                                className="pl-10"
                                                min={0}
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            0 = sin límite
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">
                                            Límite total
                                        </label>
                                        <div className="relative">
                                            <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <Input
                                                type="number"
                                                value={localConfig.limite_total || 0}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value) || 0;
                                                    setLocalConfig({
                                                        ...localConfig,
                                                        limite_total: Math.max(0, val)
                                                    });
                                                }}
                                                className="pl-10"
                                                min={0}
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            0 = sin límite
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Días de expiración */}
                            <div>
                                <label className="text-sm font-medium mb-2 block">
                                    Días para activar referido
                                </label>
                                <div className="relative">
                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        type="number"
                                        value={localConfig.dias_expiracion || 30}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value) || 30;
                                            setLocalConfig({
                                                ...localConfig,
                                                dias_expiracion: Math.min(365, Math.max(1, val))
                                            });
                                        }}
                                        className="pl-10"
                                        min={1}
                                        max={365}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Tiempo que tiene el referido para contratar su primer servicio
                                </p>
                            </div>

                            {/* Mensajes */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                                    Mensajes
                                </h3>
                                <div>
                                    <label className="text-sm font-medium mb-2 block">
                                        Mensaje para compartir (WhatsApp)
                                    </label>
                                    <textarea
                                        value={localConfig.mensaje_compartir || ''}
                                        onChange={(e) => setLocalConfig({
                                            ...localConfig,
                                            mensaje_compartir: e.target.value
                                        })}
                                        className="w-full h-20 p-3 rounded-xl bg-background border border-border text-foreground resize-none text-sm"
                                        placeholder="Usa {link} para el link de referido"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Variables: {'{link}'}, {'{puntos}'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2">
                        <DialogClose asChild>
                            <Button variant="outline">Cancelar</Button>
                        </DialogClose>
                        <Button
                            onClick={handleSaveConfig}
                            disabled={configMutation.isPending}
                        >
                            {configMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            <Save className="w-4 h-4 mr-2" />
                            Guardar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6"
            >
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                            <Users className="w-7 h-7 text-primary" />
                            Programa de Referidos
                        </h1>
                        <p className="text-muted-foreground mt-1 text-sm">
                            Gestiona invitaciones y recompensas
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refetchReferidos()}
                        >
                            <RefreshCw className="w-4 h-4 mr-1" />
                            Actualizar
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => setShowConfigDialog(true)}
                        >
                            <Settings className="w-4 h-4 mr-1" />
                            Configurar
                        </Button>
                    </div>
                </div>
            </motion.div>

            {/* Control ON/OFF */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl p-5 mb-6 border shadow-sm transition-all duration-300 ${
                    localConfig?.activo
                        ? 'bg-gradient-to-r from-green-500/10 via-emerald-500/5 to-transparent border-green-500/30'
                        : 'bg-card border-border'
                }`}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`relative p-3 rounded-xl transition-all duration-300 ${
                            localConfig?.activo
                                ? 'bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/25'
                                : 'bg-muted'
                        }`}>
                            <Gift className={`w-6 h-6 transition-colors ${localConfig?.activo ? 'text-white' : 'text-muted-foreground'}`} />
                            {localConfig?.activo && (
                                <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                            )}
                        </div>
                        <div>
                            <h2 className="font-bold text-lg">
                                {localConfig?.activo ? 'Programa Activo' : 'Programa Inactivo'}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {localConfig?.activo
                                    ? `${localConfig.puntos_referidor} pts para referidor • ${localConfig.puntos_referido} pts para referido`
                                    : 'Activa para que los clientes puedan invitar amigos'}
                            </p>
                        </div>
                    </div>
                    <Switch
                        checked={localConfig?.activo || false}
                        onCheckedChange={handleToggleActive}
                        disabled={configMutation.isPending}
                        className="scale-125"
                    />
                </div>
            </motion.div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-card rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-3">
                        <div className="text-primary">
                            <UserPlus className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{stats.total_referidos || 0}</p>
                            <p className="text-xs text-muted-foreground">Total referidos</p>
                        </div>
                    </div>
                </div>

                <div className="bg-card rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-3">
                        <div className="text-primary">
                            <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{stats.activos || 0}</p>
                            <p className="text-xs text-muted-foreground">Activos</p>
                        </div>
                    </div>
                </div>

                <div className="bg-card rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-3">
                        <div className="text-primary">
                            <Clock className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{stats.pendientes || 0}</p>
                            <p className="text-xs text-muted-foreground">Pendientes</p>
                        </div>
                    </div>
                </div>

                <div className="bg-card rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-3">
                        <div className="text-primary">
                            <Coins className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{stats.puntos_otorgados?.toLocaleString() || 0}</p>
                            <p className="text-xs text-muted-foreground">Puntos otorgados</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Referidores */}
            {stats.top_referidores?.length > 0 && (
                <div className="bg-card rounded-2xl p-5 mb-6 border border-border shadow-sm">
                    <h2 className="font-bold text-lg flex items-center gap-2 mb-4">
                        <TrendingUp className="w-5 h-5 text-primary" />
                        Top Referidores
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {stats.top_referidores.slice(0, 3).map((top, i) => (
                            <div
                                key={top.cliente_id}
                                className={`flex items-center gap-3 p-3 rounded-xl border ${
                                    i === 0 ? 'bg-yellow-500/5 border-yellow-500/20' :
                                    i === 1 ? 'bg-slate-400/5 border-slate-400/20' :
                                    'bg-orange-500/5 border-orange-500/20'
                                }`}
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                    i === 0 ? 'bg-yellow-500 text-yellow-950' :
                                    i === 1 ? 'bg-slate-400 text-slate-950' :
                                    'bg-orange-500 text-orange-950'
                                }`}>
                                    {i + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{top.nombre || 'Cliente'}</p>
                                    <p className="text-xs text-muted-foreground">{top.total} referidos</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-primary">{top.puntos_ganados?.toLocaleString()}</p>
                                    <p className="text-xs text-muted-foreground">pts</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Lista de referidos agrupados */}
            <div className="bg-card rounded-2xl shadow-sm border border-border p-5">
                <h2 className="font-bold text-lg flex items-center gap-2 mb-4">
                    <Users className="w-5 h-5 text-primary" />
                    Todos los Referidos ({referidos.length})
                </h2>

                {Object.keys(referidosPorReferidor).length > 0 ? (
                    <div className="space-y-3">
                        {Object.entries(referidosPorReferidor).map(([referidorId, { referidor, referidos: refs }]) => (
                            <div key={referidorId} className="border border-border rounded-xl overflow-hidden">
                                {/* Header del referidor */}
                                <button
                                    onClick={() => setExpandedReferidor(
                                        expandedReferidor === referidorId ? null : referidorId
                                    )}
                                    className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                            <Users className="w-5 h-5 text-primary" />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-medium">{referidor?.nombre || 'Cliente'}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {refs.length} referido{refs.length !== 1 ? 's' : ''} •
                                                {refs.filter(r => r.estado === 'activo').length} activo{refs.filter(r => r.estado === 'activo').length !== 1 ? 's' : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-medium text-primary">
                                            +{refs.reduce((sum, r) => sum + (r.puntos_referidor || 0), 0)} pts
                                        </span>
                                        {expandedReferidor === referidorId ? (
                                            <ChevronUp className="w-5 h-5 text-muted-foreground" />
                                        ) : (
                                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                        )}
                                    </div>
                                </button>

                                {/* Lista de referidos de este referidor */}
                                {expandedReferidor === referidorId && (
                                    <div className="border-t border-border bg-muted/20">
                                        {refs.map((ref) => (
                                            <div
                                                key={ref.id}
                                                className="px-4 py-3 flex items-center justify-between border-b border-border/50 last:border-b-0"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center border border-border">
                                                        <UserPlus className="w-4 h-4 text-muted-foreground" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-sm">
                                                            {ref.referido?.nombre || 'Nuevo cliente'}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {ref.referido?.telefono} • {formatDate(ref.created_at)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {ref.estado === 'activo' && (
                                                        <span className="text-xs text-green-500">
                                                            +{ref.puntos_referidor} / +{ref.puntos_referido} pts
                                                        </span>
                                                    )}
                                                    <StateBadge estado={ref.estado} type="referral" size="sm" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <EmptyState
                        icon={Users}
                        title="Sin referidos aún"
                        description="Los referidos aparecerán aquí cuando los clientes inviten a sus amigos."
                        animate={false}
                    />
                )}
            </div>

            {/* Info footer */}
            <div className="mt-6 p-4 bg-muted/30 rounded-xl border border-border/50">
                <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">¿Cómo funciona?</strong><br />
                    Cuando un cliente comparte su link y su amigo se registra, queda como referido pendiente.
                    Cuando el referido contrata su primer servicio, ambos reciben sus puntos automáticamente.
                </p>
            </div>
        </>
    );
};

export default AdminReferidos;
