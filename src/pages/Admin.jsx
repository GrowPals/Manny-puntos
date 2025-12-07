
import React, { useState, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import {
    Users, TrendingUp, Gift, Truck, Loader2, Download, Upload,
    DollarSign, ArrowUpRight, ArrowDownRight, Wrench, ShoppingBag
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
    PieChart, Pie, Cell, Legend,
    AreaChart, Area, Line
} from 'recharts';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

// Colores para gráficas
const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];
const NIVEL_COLORS = {
    normal: '#6b7280',
    partner: '#f59e0b',
    vip: '#8b5cf6'
};

const AdminMetricCard = ({ icon, title, value, subtitle, gradient, loading, trend }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`card p-5 ${gradient} text-white relative overflow-hidden`}
    >
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16" />
        <div className="relative">
            <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center`}>
                    {React.cloneElement(icon, { className: `w-5 h-5` })}
                </div>
                {trend && (
                    <div className={`flex items-center gap-1 text-xs ${trend > 0 ? 'text-green-200' : 'text-red-200'}`}>
                        {trend > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {Math.abs(trend)}%
                    </div>
                )}
            </div>
            <p className="text-white/70 text-sm font-medium mb-1">{title}</p>
            {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
                <>
                    <p className="text-3xl font-bold">{value}</p>
                    {subtitle && <p className="text-xs text-white/60 mt-1">{subtitle}</p>}
                </>
            )}
        </div>
    </motion.div>
);

const ChartCard = ({ title, children, className = "" }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-card rounded-2xl shadow-lg border border-border p-5 ${className}`}
    >
        <h3 className="text-lg font-semibold text-foreground mb-4">{title}</h3>
        {children}
    </motion.div>
);

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                <p className="font-medium text-foreground">{label}</p>
                {payload.map((entry, index) => (
                    <p key={index} className="text-sm" style={{ color: entry.color }}>
                        {entry.name}: {typeof entry.value === 'number' && entry.name.includes('Ingreso')
                            ? `$${entry.value.toLocaleString('es-MX')}`
                            : entry.value.toLocaleString('es-MX')}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

const Admin = () => {
    const { toast } = useToast();
    const fileInputRef = useRef(null);
    const [importData, setImportData] = useState(null);
    const [showImportConfirm, setShowImportConfirm] = useState(false);

    // Query para estadísticas del dashboard
    const { data: stats, isLoading: loadingStats } = useQuery({
        queryKey: ['admin-dashboard-stats'],
        queryFn: api.admin.getDashboardStats,
        staleTime: 30000, // 30 segundos
    });

    const { data: clientes = [], isLoading: loadingClientes } = useQuery({
        queryKey: ['admin-clientes'],
        queryFn: api.clients.getTodosLosClientes,
    });

    const { data: canjesPendientes = [], isLoading: loadingCanjes } = useQuery({
        queryKey: ['admin-canjes-pendientes'],
        queryFn: api.redemptions.getCanjesPendientes,
    });

    const loading = loadingStats || loadingClientes || loadingCanjes;

    const entregas = canjesPendientes.slice(0, 5);

    const topClients = React.useMemo(() => {
        return [...clientes]
          .filter(c => !c.es_admin)
          .sort((a, b) => b.puntos_actuales - a.puntos_actuales)
          .slice(0, 5);
    }, [clientes]);

    // Datos para gráfica de niveles
    const nivelesData = stats?.niveles ? [
        { name: 'Normal', value: stats.niveles.normal, fill: NIVEL_COLORS.normal },
        { name: 'Partner', value: stats.niveles.partner, fill: NIVEL_COLORS.partner },
        { name: 'VIP', value: stats.niveles.vip, fill: NIVEL_COLORS.vip },
    ].filter(n => n.value > 0) : [];

    // Datos para gráfica de canjes por tipo
    const canjesPorTipoData = stats?.canjesPorTipo || [];

    // Datos para gráfica de servicios por mes
    const serviciosPorMesData = stats?.serviciosPorMes || [];

    const handleExport = async () => {
        try {
            await api.admin.exportMannyData();
            toast({ title: "Exportación iniciada", description: "El archivo de respaldo se está descargando." });
        } catch (error) {
            toast({ title: "Error de exportación", description: error.message, variant: "destructive" });
        }
    };

    const handleImportClick = () => {
        fileInputRef.current.click();
    };

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const fileContent = await file.text();
            const data = JSON.parse(fileContent);
            setImportData(data);
            setShowImportConfirm(true);
        } catch (error) {
            toast({ title: "Error de lectura", description: `No se pudo leer el archivo: ${error.message}`, variant: "destructive" });
        }
        event.target.value = null;
    };

    const handleImportConfirm = async () => {
        if (!importData) return;
        setShowImportConfirm(false);
        try {
            await api.admin.importMannyData(importData);
            toast({ title: "Importación exitosa", description: "Los datos se han importado correctamente. La página se recargará." });
            setTimeout(() => window.location.reload(), 2000);
        } catch (error) {
            toast({ title: "Error de importación", description: error.message, variant: "destructive" });
        }
        setImportData(null);
    };

    return (
        <>
            <Helmet>
                <title>Panel Admin - Manny</title>
                <meta name="description" content="Dashboard de administración del sistema de recompensas Manny" />
            </Helmet>

            <Dialog open={showImportConfirm} onOpenChange={setShowImportConfirm}>
                <DialogContent className="bg-card border-border text-foreground">
                    <DialogHeader>
                        <DialogTitle className="text-xl">Confirmar Importación</DialogTitle>
                        <DialogDescription>
                            Esta acción importará datos desde un archivo JSON.
                        </DialogDescription>
                    </DialogHeader>
                    <p className="text-muted-foreground py-4">
                        ¿Seguro que quieres importar? Esto <strong className="text-destructive">sobreescribirá todos los datos actuales</strong>.
                    </p>
                    <DialogFooter className="gap-2">
                        <DialogClose asChild>
                            <Button variant="outline">Cancelar</Button>
                        </DialogClose>
                        <Button variant="destructive" onClick={handleImportConfirm}>
                            Importar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
                <h1 className="text-3xl md:text-4xl font-bold">Dashboard de Admin</h1>
                <p className="text-muted-foreground mt-1">Resumen completo del sistema de recompensas.</p>
            </motion.div>

            {/* Métricas principales */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                <AdminMetricCard
                    icon={<Users />}
                    title="Clientes"
                    value={stats?.resumen?.totalClientes || 0}
                    subtitle={`+${stats?.resumen?.clientesNuevosMes || 0} este mes`}
                    gradient="bg-gradient-to-br from-blue-500 to-blue-600"
                    loading={loading}
                />
                <AdminMetricCard
                    icon={<TrendingUp />}
                    title="Puntos Totales"
                    value={(stats?.resumen?.totalPuntos || 0).toLocaleString('es-MX')}
                    gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
                    loading={loading}
                />
                <AdminMetricCard
                    icon={<DollarSign />}
                    title="Ingresos"
                    value={`$${((stats?.resumen?.totalIngresos || 0) / 1000).toFixed(0)}k`}
                    subtitle="Total acumulado"
                    gradient="bg-gradient-to-br from-green-500 to-green-600"
                    loading={loading}
                />
                <AdminMetricCard
                    icon={<Wrench />}
                    title="Servicios"
                    value={stats?.resumen?.totalServicios || 0}
                    gradient="bg-gradient-to-br from-orange-500 to-orange-600"
                    loading={loading}
                />
                <AdminMetricCard
                    icon={<Gift />}
                    title="Recompensas"
                    value={stats?.productosActivos || 0}
                    subtitle="Productos activos"
                    gradient="bg-gradient-to-br from-purple-500 to-purple-600"
                    loading={loading}
                />
                <AdminMetricCard
                    icon={<Truck />}
                    title="Pendientes"
                    value={stats?.canjesStats?.pendientes || 0}
                    subtitle={`${stats?.canjesStats?.total || 0} canjes total`}
                    gradient="bg-manny-gradient"
                    loading={loading}
                />
            </div>

            {/* Gráficas principales */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Tendencia de Servicios e Ingresos */}
                <ChartCard title="Tendencia Mensual (últimos 6 meses)">
                    <div className="h-64">
                        {loading ? (
                            <div className="h-full flex justify-center items-center">
                                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={serviciosPorMesData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="colorServicios" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                    <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                    <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Area
                                        yAxisId="right"
                                        type="monotone"
                                        dataKey="ingresos"
                                        name="Ingresos"
                                        stroke="#22c55e"
                                        fillOpacity={1}
                                        fill="url(#colorIngresos)"
                                    />
                                    <Line
                                        yAxisId="left"
                                        type="monotone"
                                        dataKey="servicios"
                                        name="Servicios"
                                        stroke="#6366f1"
                                        strokeWidth={2}
                                        dot={{ fill: '#6366f1', strokeWidth: 2 }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </ChartCard>

                {/* Top 5 Clientes */}
                <ChartCard title="Top 5 Clientes por Puntos">
                    <div className="h-64">
                        {loading ? (
                            <div className="h-full flex justify-center items-center">
                                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topClients} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                    <YAxis
                                        dataKey="nombre"
                                        type="category"
                                        stroke="hsl(var(--muted-foreground))"
                                        fontSize={12}
                                        width={80}
                                        tickFormatter={(value) => value.length > 10 ? value.slice(0, 10) + '...' : value}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar
                                        dataKey="puntos_actuales"
                                        name="Puntos"
                                        fill="url(#barGradient)"
                                        radius={[0, 4, 4, 0]}
                                    />
                                    <defs>
                                        <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                                        </linearGradient>
                                    </defs>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </ChartCard>
            </div>

            {/* Gráficas secundarias */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                {/* Distribución de Niveles */}
                <ChartCard title="Distribución de Clientes">
                    <div className="h-52">
                        {loading ? (
                            <div className="h-full flex justify-center items-center">
                                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : nivelesData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={nivelesData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={40}
                                        outerRadius={70}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {nivelesData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend
                                        verticalAlign="bottom"
                                        height={36}
                                        formatter={(value) => <span className="text-foreground text-sm">{value}</span>}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex justify-center items-center text-muted-foreground">
                                Sin datos de niveles
                            </div>
                        )}
                    </div>
                </ChartCard>

                {/* Canjes por Tipo */}
                <ChartCard title="Canjes por Tipo de Producto">
                    <div className="h-52">
                        {loading ? (
                            <div className="h-full flex justify-center items-center">
                                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : canjesPorTipoData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={canjesPorTipoData}
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={70}
                                        dataKey="cantidad"
                                        nameKey="tipo"
                                        label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                                        labelLine={false}
                                    >
                                        {canjesPorTipoData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend
                                        verticalAlign="bottom"
                                        height={36}
                                        formatter={(value) => <span className="text-foreground text-sm">{value}</span>}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex justify-center items-center text-muted-foreground">
                                Sin canjes registrados
                            </div>
                        )}
                    </div>
                </ChartCard>

                {/* Estadísticas de Canjes */}
                <ChartCard title="Resumen de Canjes">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                                    <ShoppingBag className="w-5 h-5 text-blue-500" />
                                </div>
                                <span className="text-sm text-muted-foreground">Total Canjes</span>
                            </div>
                            <span className="text-xl font-bold">{stats?.canjesStats?.total || 0}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                                    <Gift className="w-5 h-5 text-green-500" />
                                </div>
                                <span className="text-sm text-muted-foreground">Entregados</span>
                            </div>
                            <span className="text-xl font-bold text-green-500">{stats?.canjesStats?.entregados || 0}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                                    <Truck className="w-5 h-5 text-orange-500" />
                                </div>
                                <span className="text-sm text-muted-foreground">Pendientes</span>
                            </div>
                            <span className="text-xl font-bold text-orange-500">{stats?.canjesStats?.pendientes || 0}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-primary/10 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                                    <TrendingUp className="w-5 h-5 text-primary" />
                                </div>
                                <span className="text-sm text-muted-foreground">Puntos Canjeados</span>
                            </div>
                            <span className="text-xl font-bold text-primary">
                                {(stats?.canjesStats?.puntosCanjeados || 0).toLocaleString('es-MX')}
                            </span>
                        </div>
                    </div>
                </ChartCard>
            </div>

            {/* Sección inferior */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Últimos canjes pendientes */}
                <ChartCard title="Canjes Pendientes de Entrega">
                    <div className="space-y-3">
                        {loading ? (
                            <div className="h-40 flex justify-center items-center">
                                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : entregas.length > 0 ? (
                            entregas.map((entrega) => (
                                <div
                                    key={entrega.id}
                                    className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 p-4 bg-muted/50 rounded-xl hover:bg-muted transition-colors"
                                >
                                    <div className="flex-1">
                                        <p className="font-semibold text-foreground">{entrega.producto_nombre}</p>
                                        <p className="text-sm text-muted-foreground">
                                            Para: <span className="font-medium text-foreground/80">{entrega.cliente_nombre}</span>
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-1 text-xs rounded-full ${
                                            entrega.estado === 'en_lista'
                                                ? 'bg-blue-500/20 text-blue-500'
                                                : 'bg-orange-500/20 text-orange-500'
                                        }`}>
                                            {entrega.estado === 'en_lista' ? 'En lista' : 'Pendiente'}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(entrega.fecha).toLocaleDateString('es-MX')}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-8 text-center text-muted-foreground">
                                <Gift className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p>¡No hay canjes pendientes!</p>
                            </div>
                        )}
                    </div>
                </ChartCard>

                {/* Gestión de datos */}
                <ChartCard title="Gestión de Datos">
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Exporta o importa los datos del sistema para respaldos o migraciones.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Button
                                onClick={handleExport}
                                variant="outline"
                                className="flex-1"
                                disabled={loading}
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Exportar Datos
                            </Button>
                            <Button
                                onClick={handleImportClick}
                                variant="outline"
                                className="flex-1"
                                disabled={loading}
                            >
                                <Upload className="mr-2 h-4 w-4" />
                                Importar Datos
                            </Button>
                            <Input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                accept=".json"
                                disabled={loading}
                            />
                        </div>
                        <div className="p-4 bg-destructive/10 rounded-xl border border-destructive/20">
                            <p className="text-xs text-destructive">
                                <strong>Advertencia:</strong> La importación sobreescribirá los datos existentes.
                                Asegúrate de tener un respaldo antes de importar.
                            </p>
                        </div>

                        {/* Resumen rápido del sistema */}
                        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
                            <div className="text-center p-3 bg-muted/30 rounded-lg">
                                <p className="text-2xl font-bold text-foreground">
                                    {stats?.serviciosPorTipo?.length || 0}
                                </p>
                                <p className="text-xs text-muted-foreground">Tipos de Servicio</p>
                            </div>
                            <div className="text-center p-3 bg-muted/30 rounded-lg">
                                <p className="text-2xl font-bold text-foreground">
                                    {stats?.canjesPorTipo?.length || 0}
                                </p>
                                <p className="text-xs text-muted-foreground">Tipos de Producto</p>
                            </div>
                        </div>
                    </div>
                </ChartCard>
            </div>
        </>
    );
};

export default Admin;
