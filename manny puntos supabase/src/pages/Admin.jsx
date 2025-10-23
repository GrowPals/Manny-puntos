import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Users, TrendingUp, Gift, Truck, Loader2, Download, Upload, Database } from 'lucide-react';
import { useSupabaseAPI } from '@/context/SupabaseContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const AdminMetricCard = ({ icon, title, value, gradient, loading }) => (
    <div className={`card p-6 ${gradient} text-white`}>
        <div className="flex items-center gap-4 mb-2">
            <div className={`w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center`}>
                {React.cloneElement(icon, { className: `w-6 h-6` })}
            </div>
            <span className="opacity-80 font-medium">{title}</span>
        </div>
        {loading ? <Loader2 className="w-8 h-8 animate-spin" /> : <p className="text-4xl font-black">{value}</p>}
    </div>
);

const Admin = () => {
    const api = useSupabaseAPI();
    const [metrics, setMetrics] = useState({ clientes: 0, puntos: 0, productos: 0, canjes: 0 });
    const [loading, setLoading] = useState(true);
    const [entregas, setEntregas] = useState([]);
    const [topClients, setTopClients] = useState([]);
    const { theme } = useTheme();
    const { toast } = useToast();
    const fileInputRef = useRef(null);

    const fetchDashboardData = useCallback(async () => {
        if (!api) return;
        try {
            setLoading(true);
            const [clientesData, productosData, canjesPendientesData] = await Promise.all([
                api.getTodosLosClientes(),
                api.getProductosCanje(),
                api.getCanjesPendientes(),
            ]);

            const totalPoints = clientesData.reduce((sum, c) => sum + (Number(c.puntos_actuales) || 0), 0);
            const activeProducts = productosData.filter(p => p.activo).length;
            const pendingRedemptionsCount = canjesPendientesData.length;
            const recentPending = canjesPendientesData.slice(0, 5);

            setMetrics({
                clientes: clientesData.length || 0,
                puntos: totalPoints || 0,
                productos: activeProducts || 0,
                canjes: pendingRedemptionsCount || 0,
            });

            setEntregas(recentPending);
            const sortedClients = [...clientesData]
              .filter(c => !c.es_admin)
              .sort((a, b) => (b.puntos_actuales || 0) - (a.puntos_actuales || 0));
            setTopClients(sortedClients.slice(0, 5));

        } catch (error) {
            console.error("Dashboard error:", error);
            toast({ title: 'Error al cargar el dashboard', description: error.message, variant: 'destructive' });
            setMetrics({ clientes: 0, puntos: 0, productos: 0, canjes: 0 });
        } finally {
            setLoading(false);
        }
    }, [api, toast]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    const handleExport = async () => {
        try {
            await api.exportMannyData();
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

        if (window.confirm("¿Seguro que quieres importar? Esto sobreescribirá los datos existentes.")) {
            try {
                const message = await api.importMannyData(file);
                toast({ title: "Importación exitosa", description: message });
                setTimeout(() => window.location.reload(), 2000);
            } catch (error) {
                toast({ title: "Error de importación", description: error.message, variant: "destructive" });
            }
        }
        event.target.value = null;
    };


    const chartColor = theme === 'dark' ? '#9ca3af' : '#6b7280';

    return (
        <>
            <Helmet>
                <title>Panel Admin - Manny</title>
                <meta name="description" content="Dashboard de administración del sistema de recompensas Manny" />
            </Helmet>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                <h1 className="text-3xl md:text-4xl">Dashboard de Admin</h1>
                <p className="text-muted-foreground mt-1">Resumen del sistema de recompensas.</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <AdminMetricCard icon={<Users />} title="Clientes Activos" value={metrics.clientes} gradient="bg-gradient-to-br from-blue-500 to-blue-700" loading={loading} />
                <AdminMetricCard icon={<TrendingUp />} title="Puntos Totales" value={metrics.puntos.toLocaleString('es-MX')} gradient="bg-gradient-to-br from-emerald-500 to-emerald-700" loading={loading} />
                <AdminMetricCard icon={<Gift />} title="Recompensas Activas" value={metrics.productos} gradient="bg-gradient-to-br from-purple-500 to-purple-700" loading={loading} />
                <AdminMetricCard icon={<Truck />} title="Canjes Pendientes" value={metrics.canjes} gradient="bg-manny-gradient" loading={loading} />
            </div>

            <div className="bg-card rounded-3xl shadow-xl p-6 md:p-8 mb-8">
                <h2 className="text-2xl mb-4 flex items-center gap-3"><Database className="text-primary"/>Gestión de Datos</h2>
                <div className="flex flex-col sm:flex-row gap-4">
                    <Button onClick={handleExport} variant="outline" className="w-full sm:w-auto">
                        <Download className="mr-2 h-4 w-4" /> Exportar Datos (JSON)
                    </Button>
                    <Button onClick={handleImportClick} variant="outline" className="w-full sm:w-auto">
                        <Upload className="mr-2 h-4 w-4" /> Importar Datos
                    </Button>
                    <Input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card rounded-3xl shadow-xl p-6 md:p-8">
                    <h2 className="text-2xl mb-6">Top 5 Clientes con más Puntos</h2>
                     <div className="h-72">
                        {loading ? <div className="h-full flex justify-center items-center"><Loader2 className="w-8 h-8 animate-spin" /></div> :
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topClients} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="nombre" stroke={chartColor} fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke={chartColor} fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip cursor={{fill: 'hsl(var(--accent) / 0.1)'}} contentStyle={{backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))'}} />
                                <Bar dataKey="puntos_actuales" name="Puntos" fill="url(#colorUv)" />
                                <defs>
                                    <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                                    </linearGradient>
                                </defs>
                            </BarChart>
                        </ResponsiveContainer>}
                    </div>
                </div>
                <div className="bg-card rounded-3xl shadow-xl p-6 md:p-8">
                    <h2 className="text-2xl mb-6">Últimos Canjes Pendientes</h2>
                    <div className="space-y-4">
                        {loading ? <div className="h-full flex justify-center items-center"><Loader2 className="w-8 h-8 animate-spin" /></div> :
                        entregas.length > 0 ? entregas.map((entrega) => (
                            <div key={entrega.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 bg-muted/50 rounded-xl hover:bg-muted transition-colors">
                                <div>
                                    <p className="font-bold text-foreground">{entrega.producto_nombre}</p>
                                    <p className="text-sm text-muted-foreground">Para: <span className="font-medium text-foreground/80">{entrega.cliente_nombre}</span></p>
                                </div>
                                <div className="text-sm text-muted-foreground/80">
                                    {new Date(entrega.fecha).toLocaleDateString('es-MX')}
                                </div>
                            </div>
                        )) : (
                            <p className="text-center text-muted-foreground py-8">¡No hay canjes pendientes!</p>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default Admin;