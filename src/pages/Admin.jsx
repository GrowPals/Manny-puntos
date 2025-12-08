import { useState, useRef, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
    Users, TrendingUp, Gift, Truck, Loader2, Download, Upload,
    DollarSign, Wrench, ShoppingBag, LayoutDashboard, Crown,
    AlertTriangle, CheckCircle2, Clock, ChevronRight, Coins,
    ArrowUpRight, ArrowDownRight, Calendar
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import {
    XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
    PieChart, Pie, Cell, Legend, AreaChart, Area, Line
} from 'recharts';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";

// ============================================================================
// DESIGN TOKENS
// ============================================================================

const CHART_COLORS = {
    primary: 'hsl(var(--primary))',
    indigo: '#6366f1',
    green: '#22c55e',
    amber: '#f59e0b',
    red: '#ef4444',
    purple: '#8b5cf6',
    cyan: '#06b6d4',
    pink: '#ec4899'
};

const NIVEL_CONFIG = {
    normal: { color: '#6b7280', gradient: 'from-gray-500 to-gray-600', label: 'Normal' },
    partner: { color: '#3b82f6', gradient: 'from-cyan-500 to-blue-600', label: 'Partner' },
    vip: { color: '#f59e0b', gradient: 'from-amber-500 to-orange-600', label: 'VIP' }
};

// ============================================================================
// STAT CARD - Consistent with AdminClientes
// ============================================================================

const StatCard = ({ icon: Icon, label, value, trend, color = "primary", subtitle, to }) => {
    const colorClasses = {
        primary: 'text-primary',
        purple: 'text-purple-500',
        green: 'text-green-500',
        amber: 'text-amber-500',
        red: 'text-red-500',
        blue: 'text-blue-500',
    };

    const content = (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-card rounded-xl p-4 border border-border hover:shadow-md hover:border-primary/30 transition-all duration-200 h-full ${to ? 'cursor-pointer' : ''}`}
        >
            <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-5 h-5 ${colorClasses[color] || colorClasses.primary}`} />
                <p className="text-sm font-medium text-muted-foreground">{label}</p>
            </div>
            <div className="flex items-end justify-between">
                <div>
                    <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 min-h-[1rem]">{subtitle || '\u00A0'}</p>
                </div>
                {trend !== undefined && (
                    <div className={`flex items-center gap-0.5 text-sm font-medium ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {trend >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        {Math.abs(trend)}%
                    </div>
                )}
            </div>
        </motion.div>
    );

    return to ? <Link to={to}>{content}</Link> : content;
};

// ============================================================================
// SECTION CARD - Container for sections
// ============================================================================

const SectionCard = ({ title, subtitle, icon: Icon, children, action, className = "" }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-card rounded-2xl border border-border overflow-hidden ${className}`}
    >
        {(title || action) && (
            <div className="flex items-center justify-between p-4 pb-0">
                <div className="flex items-center gap-2">
                    {Icon && <Icon className="w-5 h-5 text-primary" />}
                    <div>
                        <h3 className="font-semibold text-foreground">{title}</h3>
                        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
                    </div>
                </div>
                {action}
            </div>
        )}
        <div className="p-4">
            {children}
        </div>
    </motion.div>
);

// ============================================================================
// CHART TOOLTIP
// ============================================================================

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-xl">
            <p className="font-medium text-foreground mb-1">{label}</p>
            {payload.map((entry, index) => (
                <p key={index} className="text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-muted-foreground">{entry.name}:</span>
                    <span className="font-semibold text-foreground">
                        {entry.name === 'Ingresos' ? `$${entry.value.toLocaleString('es-MX')}` : entry.value.toLocaleString('es-MX')}
                    </span>
                </p>
            ))}
        </div>
    );
};

// ============================================================================
// TOP CLIENT ROW
// ============================================================================

const TopClientRow = ({ client, rank, maxPoints }) => {
    const percentage = maxPoints > 0 ? (client.puntos_actuales / maxPoints) * 100 : 0;
    const config = NIVEL_CONFIG[client.nivel] || NIVEL_CONFIG.normal;

    return (
        <Link
            to={`/admin/clientes/${client.id}`}
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group"
        >
            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${config.gradient} flex items-center justify-center text-white font-bold text-sm`}>
                {rank}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground truncate">{client.nombre}</p>
                    {client.nivel === 'vip' && <Crown className="w-3 h-3 text-amber-500" />}
                </div>
                <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[120px]">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full"
                        />
                    </div>
                    <span className="text-xs font-semibold text-primary tabular-nums">
                        {client.puntos_actuales.toLocaleString('es-MX')}
                    </span>
                </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
    );
};

// ============================================================================
// PENDING DELIVERY ROW
// ============================================================================

const PendingDeliveryRow = ({ entrega }) => {
    const isEnLista = entrega.estado === 'en_lista';

    return (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isEnLista ? 'bg-blue-500/10' : 'bg-orange-500/10'
            }`}>
                {isEnLista ? (
                    <CheckCircle2 className="w-5 h-5 text-blue-500" />
                ) : (
                    <Clock className="w-5 h-5 text-orange-500" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{entrega.producto_nombre}</p>
                <p className="text-xs text-muted-foreground truncate">{entrega.cliente_nombre}</p>
            </div>
            <div className="text-right flex-shrink-0">
                <Badge variant="outline" className={`text-[10px] ${
                    isEnLista ? 'border-blue-500/30 text-blue-600 bg-blue-500/10' : 'border-orange-500/30 text-orange-600 bg-orange-500/10'
                }`}>
                    {isEnLista ? 'En lista' : 'Pendiente'}
                </Badge>
                <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(entrega.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                </p>
            </div>
        </div>
    );
};

// ============================================================================
// QUICK STAT ROW
// ============================================================================

const QuickStatRow = ({ icon: Icon, label, value, color = "primary", to }) => {
    const colorClasses = {
        primary: 'text-primary',
        indigo: 'text-indigo-500',
        green: 'text-green-500',
        amber: 'text-amber-500',
    };

    const content = (
        <div className={`flex items-center justify-between py-2 ${to ? 'hover:opacity-70 cursor-pointer transition-opacity' : ''}`}>
            <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${colorClasses[color] || colorClasses.primary}`} />
                <span className="text-sm font-medium text-muted-foreground">{label}</span>
            </div>
            <span className="text-lg font-bold text-foreground tabular-nums">{value}</span>
        </div>
    );

    return to ? <Link to={to}>{content}</Link> : content;
};

// ============================================================================
// MAIN ADMIN COMPONENT
// ============================================================================

const Admin = () => {
    const { toast } = useToast();
    const fileInputRef = useRef(null);
    const [importData, setImportData] = useState(null);
    const [showImportConfirm, setShowImportConfirm] = useState(false);

    // Queries
    const { data: stats, isLoading: loadingStats } = useQuery({
        queryKey: ['admin-dashboard-stats'],
        queryFn: api.admin.getDashboardStats,
        staleTime: 30000,
    });

    const { data: clientes = [], isLoading: loadingClientes } = useQuery({
        queryKey: ['admin-clientes'],
        queryFn: api.clients.getTodosLosClientes,
    });

    const { data: canjesResponse, isLoading: loadingCanjes } = useQuery({
        queryKey: ['admin-canjes-pendientes'],
        queryFn: api.redemptions.getCanjesPendientes,
    });
    const canjesPendientes = canjesResponse?.data || [];

    const loading = loadingStats || loadingClientes || loadingCanjes;

    // Computed data
    const entregas = useMemo(() => canjesPendientes.slice(0, 5), [canjesPendientes]);

    const topClients = useMemo(() => {
        return [...clientes]
            .filter(c => !c.es_admin)
            .sort((a, b) => b.puntos_actuales - a.puntos_actuales)
            .slice(0, 5);
    }, [clientes]);

    const maxClientPoints = useMemo(() =>
        topClients.length > 0 ? topClients[0].puntos_actuales : 0
    , [topClients]);

    const nivelesData = useMemo(() => {
        if (!stats?.niveles) return [];
        return [
            { name: 'Normal', value: stats.niveles.normal, fill: NIVEL_CONFIG.normal.color },
            { name: 'Partner', value: stats.niveles.partner, fill: NIVEL_CONFIG.partner.color },
            { name: 'VIP', value: stats.niveles.vip, fill: NIVEL_CONFIG.vip.color },
        ].filter(n => n.value > 0);
    }, [stats?.niveles]);

    const canjesPorTipoData = useMemo(() => stats?.canjesPorTipo || [], [stats?.canjesPorTipo]);
    const serviciosPorMesData = useMemo(() => stats?.serviciosPorMes || [], [stats?.serviciosPorMes]);

    const pieColors = [CHART_COLORS.indigo, CHART_COLORS.green, CHART_COLORS.amber, CHART_COLORS.red, CHART_COLORS.purple, CHART_COLORS.cyan, CHART_COLORS.pink];

    // Handlers
    const handleExport = async () => {
        try {
            await api.admin.exportMannyData();
            toast({ title: "Exportando datos", description: "El archivo se descargará en breve." });
        } catch (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    const handleImportClick = () => fileInputRef.current?.click();

    const handleFileChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            const fileContent = await file.text();
            const data = JSON.parse(fileContent);
            setImportData(data);
            setShowImportConfirm(true);
        } catch (error) {
            toast({ title: "Error de lectura", description: error.message, variant: "destructive" });
        }
        event.target.value = '';
    };

    const handleImportConfirm = async () => {
        if (!importData) return;
        setShowImportConfirm(false);
        try {
            await api.admin.importMannyData(importData);
            toast({ title: "Importación exitosa", description: "Recargando página..." });
            setTimeout(() => window.location.reload(), 2000);
        } catch (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
        setImportData(null);
    };

    return (
        <>
            <Helmet>
                <title>Dashboard - Admin Manny</title>
                <meta name="description" content="Panel de administración del sistema de recompensas Manny" />
            </Helmet>

            {/* Import Dialog */}
            <Dialog open={showImportConfirm} onOpenChange={setShowImportConfirm}>
                <DialogContent className="bg-card border-border">
                    <DialogHeader>
                        <DialogTitle className="text-xl flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            Confirmar Importación
                        </DialogTitle>
                        <DialogDescription>
                            Esta acción importará datos desde el archivo JSON seleccionado.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <div className="p-4 bg-destructive/10 rounded-xl border border-destructive/20">
                            <p className="text-sm text-destructive font-medium">
                                Esto sobreescribirá todos los datos actuales. Esta acción no se puede deshacer.
                            </p>
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <DialogClose asChild>
                            <Button variant="outline">Cancelar</Button>
                        </DialogClose>
                        <Button variant="destructive" onClick={handleImportConfirm}>
                            Confirmar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="space-y-4">
                {/* Header */}
                <PageHeader
                    icon={LayoutDashboard}
                    title="Dashboard"
                    subtitle="Resumen general del sistema de recompensas"
                >
                    <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>
                            {new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                    </div>
                </PageHeader>

                {/* Main Stats - More compact */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 lg:gap-3">
                    <StatCard
                        icon={Users}
                        label="Clientes"
                        value={loading ? '-' : stats?.resumen?.totalClientes || 0}
                        subtitle={`+${stats?.resumen?.clientesNuevosMes || 0} este mes`}
                        to="/admin/clientes"
                    />
                    <StatCard
                        icon={Coins}
                        label="Puntos"
                        value={loading ? '-' : (stats?.resumen?.totalPuntos || 0).toLocaleString('es-MX')}
                        color="purple"
                        to="/admin/clientes"
                    />
                    <StatCard
                        icon={DollarSign}
                        label="Ingresos"
                        value={loading ? '-' : `$${((stats?.resumen?.totalIngresos || 0) / 1000).toFixed(0)}k`}
                        subtitle="Acumulado"
                        color="green"
                    />
                    <StatCard
                        icon={Wrench}
                        label="Servicios"
                        value={loading ? '-' : (stats?.resumen?.totalServicios || 0).toLocaleString('es-MX')}
                        color="amber"
                        to="/admin/clientes"
                    />
                    <StatCard
                        icon={Gift}
                        label="Productos"
                        value={loading ? '-' : stats?.productosActivos || 0}
                        subtitle="Activos"
                        to="/admin/productos"
                    />
                    <StatCard
                        icon={Truck}
                        label="Pendientes"
                        value={loading ? '-' : stats?.canjesStats?.pendientes || 0}
                        subtitle={`${stats?.canjesStats?.total || 0} total`}
                        color="red"
                        to="/admin/entregas"
                    />
                </div>

                {/* Main Content Grid - 12 column layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Left Column - Charts */}
                    <div className="lg:col-span-8 space-y-4">
                        {/* Main Chart */}
                        <SectionCard
                            title="Tendencia Mensual"
                            subtitle="Servicios e ingresos últimos 6 meses"
                            icon={TrendingUp}
                        >
                            <div className="h-56 lg:h-64">
                                {loading ? (
                                    <div className="h-full flex items-center justify-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                                    </div>
                                ) : serviciosPorMesData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={serviciosPorMesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={CHART_COLORS.green} stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor={CHART_COLORS.green} stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                                            <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                                            <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={35} />
                                            <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={45} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Area yAxisId="right" type="monotone" dataKey="ingresos" name="Ingresos" stroke={CHART_COLORS.green} fill="url(#colorIngresos)" />
                                            <Line yAxisId="left" type="monotone" dataKey="servicios" name="Servicios" stroke={CHART_COLORS.indigo} strokeWidth={2.5} dot={{ fill: CHART_COLORS.indigo, r: 4 }} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                                        <TrendingUp className="w-12 h-12 mb-2 opacity-30" />
                                        <p className="text-sm">Sin datos de tendencia</p>
                                    </div>
                                )}
                            </div>
                            {!loading && serviciosPorMesData.length > 0 && (
                                <div className="flex items-center justify-center gap-6 pt-3 border-t border-border mt-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS.indigo }} />
                                        <span className="text-xs text-muted-foreground">Servicios</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS.green }} />
                                        <span className="text-xs text-muted-foreground">Ingresos</span>
                                    </div>
                                </div>
                            )}
                        </SectionCard>

                        {/* Pie Charts Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Distribución de Niveles */}
                            <SectionCard title="Distribución de Clientes" icon={Users}>
                                <div className="h-44">
                                    {loading ? (
                                        <div className="h-full flex items-center justify-center">
                                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : nivelesData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={nivelesData}
                                                    cx="50%"
                                                    cy="45%"
                                                    innerRadius={30}
                                                    outerRadius={50}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {nivelesData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                                <Legend verticalAlign="bottom" height={24} formatter={(value) => <span className="text-foreground text-xs">{value}</span>} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                                            <Users className="w-10 h-10 mb-2 opacity-30" />
                                            <p className="text-sm">Sin datos</p>
                                        </div>
                                    )}
                                </div>
                            </SectionCard>

                            {/* Canjes por Tipo */}
                            <SectionCard title="Canjes por Categoría" icon={Gift}>
                                <div className="h-44">
                                    {loading ? (
                                        <div className="h-full flex items-center justify-center">
                                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : canjesPorTipoData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={canjesPorTipoData}
                                                    cx="50%"
                                                    cy="45%"
                                                    outerRadius={50}
                                                    dataKey="cantidad"
                                                    nameKey="tipo"
                                                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                                                    labelLine={false}
                                                >
                                                    {canjesPorTipoData.map((_, index) => (
                                                        <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                                <Legend verticalAlign="bottom" height={24} formatter={(value) => <span className="text-foreground text-xs">{value}</span>} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                                            <Gift className="w-10 h-10 mb-2 opacity-30" />
                                            <p className="text-sm">Sin canjes</p>
                                        </div>
                                    )}
                                </div>
                            </SectionCard>
                        </div>
                    </div>

                    {/* Right Column - Stats & Lists */}
                    <div className="lg:col-span-4 space-y-4">
                        {/* Canjes Summary */}
                        <SectionCard
                            title="Resumen de Canjes"
                            icon={ShoppingBag}
                        >
                            <div className="space-y-1">
                                <QuickStatRow icon={ShoppingBag} label="Total" value={stats?.canjesStats?.total || 0} color="indigo" to="/admin/entregas" />
                                <QuickStatRow icon={CheckCircle2} label="Entregados" value={stats?.canjesStats?.entregados || 0} color="green" to="/admin/entregas" />
                                <QuickStatRow icon={Clock} label="Pendientes" value={stats?.canjesStats?.pendientes || 0} color="amber" to="/admin/entregas" />
                                <Link to="/admin/entregas" className="flex items-center justify-between py-2 hover:opacity-70 transition-opacity">
                                    <div className="flex items-center gap-3">
                                        <TrendingUp className="w-5 h-5 text-primary" />
                                        <span className="text-sm font-medium text-muted-foreground">Puntos Canjeados</span>
                                    </div>
                                    <span className="text-lg font-bold text-primary tabular-nums">
                                        {(stats?.canjesStats?.puntosCanjeados || 0).toLocaleString('es-MX')}
                                    </span>
                                </Link>
                            </div>
                        </SectionCard>

                        {/* Top Clientes */}
                        <SectionCard
                            title="Top 5 Clientes"
                            subtitle="Por puntos acumulados"
                            icon={Crown}
                            action={
                                <Link to="/admin/clientes">
                                    <Button variant="ghost" size="sm" className="text-xs">
                                        Ver todos <ChevronRight className="w-3 h-3 ml-1" />
                                    </Button>
                                </Link>
                            }
                        >
                            {loading ? (
                                <div className="h-40 flex items-center justify-center">
                                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : topClients.length > 0 ? (
                                <div className="space-y-0.5">
                                    {topClients.map((client, index) => (
                                        <TopClientRow
                                            key={client.id}
                                            client={client}
                                            rank={index + 1}
                                            maxPoints={maxClientPoints}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="h-40 flex flex-col items-center justify-center text-muted-foreground">
                                    <Users className="w-10 h-10 mb-2 opacity-30" />
                                    <p className="text-sm">Sin clientes</p>
                                </div>
                            )}
                        </SectionCard>
                    </div>
                </div>

                {/* Bottom Row */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Canjes Pendientes */}
                    <SectionCard
                        title="Entregas Pendientes"
                        subtitle="Próximas recompensas a entregar"
                        icon={Truck}
                        className="lg:col-span-7"
                        action={
                            entregas.length > 0 && (
                                <Badge variant="secondary" className="font-semibold">
                                    {canjesPendientes.length} total
                                </Badge>
                            )
                        }
                    >
                        {loading ? (
                            <div className="h-32 flex items-center justify-center">
                                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : entregas.length > 0 ? (
                            <div className="space-y-2">
                                {entregas.map((entrega) => (
                                    <PendingDeliveryRow key={entrega.id} entrega={entrega} />
                                ))}
                            </div>
                        ) : (
                            <div className="py-6 text-center">
                                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mx-auto mb-2">
                                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                                </div>
                                <p className="font-medium text-foreground">¡Todo al día!</p>
                                <p className="text-sm text-muted-foreground">No hay entregas pendientes</p>
                            </div>
                        )}
                    </SectionCard>

                    {/* Gestión de Datos */}
                    <SectionCard
                        title="Gestión de Datos"
                        subtitle="Respaldo y restauración"
                        icon={Download}
                        className="lg:col-span-5"
                    >
                        <div className="space-y-3">
                            <div className="flex gap-2">
                                <Button onClick={handleExport} variant="outline" className="flex-1 h-10" disabled={loading}>
                                    <Download className="mr-2 h-4 w-4" />
                                    Exportar
                                </Button>
                                <Button onClick={handleImportClick} variant="outline" className="flex-1 h-10" disabled={loading}>
                                    <Upload className="mr-2 h-4 w-4" />
                                    Importar
                                </Button>
                                <Input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    className="hidden"
                                    accept=".json"
                                />
                            </div>

                            <div className="p-2.5 bg-amber-500/10 rounded-lg border border-amber-500/20 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                <p className="text-xs text-muted-foreground">
                                    La importación reemplazará los datos existentes.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                                <div className="text-center p-2 bg-muted/30 rounded-lg">
                                    <p className="text-lg font-bold text-foreground">{stats?.serviciosPorTipo?.length || 0}</p>
                                    <p className="text-[10px] text-muted-foreground">Tipos de Servicio</p>
                                </div>
                                <div className="text-center p-2 bg-muted/30 rounded-lg">
                                    <p className="text-lg font-bold text-foreground">{stats?.canjesPorTipo?.length || 0}</p>
                                    <p className="text-[10px] text-muted-foreground">Tipos de Producto</p>
                                </div>
                            </div>
                        </div>
                    </SectionCard>
                </div>
            </div>
        </>
    );
};

export default Admin;
