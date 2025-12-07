
import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Users, TrendingUp, Gift, Truck, Loader2, Download, Upload, Database } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
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
    const { toast } = useToast();
    const fileInputRef = useRef(null);
    const [importData, setImportData] = useState(null);
    const [showImportConfirm, setShowImportConfirm] = useState(false);

    const { data: clientes = [], isLoading: loadingClientes } = useQuery({
        queryKey: ['admin-clientes'],
        queryFn: api.clients.getTodosLosClientes,
    });

    const { data: productos = [], isLoading: loadingProductos } = useQuery({
        queryKey: ['admin-productos'],
        queryFn: api.products.getProductosCanje,
    });

    const { data: canjesPendientes = [], isLoading: loadingCanjes } = useQuery({
        queryKey: ['admin-canjes-pendientes'],
        queryFn: api.redemptions.getCanjesPendientes,
    });

    const loading = loadingClientes || loadingProductos || loadingCanjes;

    const metrics = React.useMemo(() => {
        const totalPoints = clientes.reduce((sum, c) => sum + (Number(c.puntos_actuales) || 0), 0);
        const activeProducts = productos.filter(p => p.activo).length;
        
        return {
            clientes: clientes.length || 0,
            puntos: totalPoints || 0,
            productos: activeProducts || 0,
            canjes: canjesPendientes.length || 0,
        };
    }, [clientes, productos, canjesPendientes]);

    const entregas = canjesPendientes.slice(0, 5);
    
    const topClients = React.useMemo(() => {
        return [...clientes]
          .filter(c => !c.es_admin)
          .sort((a, b) => b.puntos_actuales - a.puntos_actuales)
          .slice(0, 5);
    }, [clientes]);

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
        // setLoading(true); // Loading is now derived from queries, but here we might want a local loading state or just rely on toast
        try {
            await api.admin.importMannyData(importData);
            toast({ title: "Importación exitosa", description: "Los datos se han importado correctamente. La página se recargará." });
            setTimeout(() => window.location.reload(), 2000);
        } catch (error) {
            toast({ title: "Error de importación", description: error.message, variant: "destructive" });
            // setLoading(false);
        }
        setImportData(null);
    };


    const chartColor = '#6b7280'; // Static color as requested

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
                    <Button onClick={handleExport} variant="outline" className="w-full sm:w-auto" disabled={loading}>
                        <Download className="mr-2 h-4 w-4" /> Exportar Datos (JSON)
                    </Button>
                    <Button onClick={handleImportClick} variant="outline" className="w-full sm:w-auto" disabled={loading}>
                        <Upload className="mr-2 h-4 w-4" /> Importar Datos
                    </Button>
                    <Input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" disabled={loading} />
                </div>
                 <p className="text-xs text-muted-foreground mt-3">La importación sobreescribirá los datos existentes basados en IDs y conflictos.</p>
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
