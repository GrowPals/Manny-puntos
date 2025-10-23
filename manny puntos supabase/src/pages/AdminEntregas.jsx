import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Truck, Loader2, Wrench, Package, Calendar, CheckCircle, Hourglass, PackageCheck } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useSupabaseAPI } from '@/context/SupabaseContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const AdminEntregas = () => {
    const { toast } = useToast();
    const api = useSupabaseAPI();
    const [canjes, setCanjes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('productos');

    const loadCanjes = useCallback(async () => {
        if (!api) return;
        try {
            setLoading(true);
            const data = await api.getTodosLosCanjes();
            setCanjes(data);
        } catch (error) {
            toast({ title: 'Error al cargar canjes', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [api, toast]);

    useEffect(() => {
        loadCanjes();
    }, [loadCanjes]);

    const handleEstadoChange = async (canjeId, nuevoEstado) => {
        try {
            await api.actualizarEstadoCanje(canjeId, nuevoEstado);
            toast({ title: '¡Estado actualizado!' });
            loadCanjes(); // Recargar
        } catch (error) {
            console.error("Error updating status:", error);
            toast({ title: 'Error al actualizar', description: error.message, variant: 'destructive' });
        }
    };

    const getStatusInfo = (estado) => {
        const statuses = {
            'pendiente_entrega': { text: 'Pendiente', icon: <Hourglass className="w-4 h-4 text-yellow-400" /> },
            'entregado': { text: 'Entregado', icon: <PackageCheck className="w-4 h-4 text-green-400" /> },
            'en_lista': { text: 'En Lista', icon: <Hourglass className="w-4 h-4 text-yellow-400" /> },
            'agendado': { text: 'Agendado', icon: <Calendar className="w-4 h-4 text-blue-400" /> },
            'completado': { text: 'Completado', icon: <CheckCircle className="w-4 h-4 text-green-400" /> },
        };
        return statuses[estado] || { text: 'Desconocido', icon: <Hourglass className="w-4 h-4" /> };
    };
    
    const canjesFiltrados = canjes.filter(c => {
        const tipoCorrecto = activeTab === 'productos' ? c.tipo === 'producto' : c.tipo === 'servicio';
        const estadoFinal = c.tipo === 'producto' ? 'entregado' : 'completado';
        return tipoCorrecto && c.estado !== estadoFinal;
    });

    const CanjeCard = ({ canje }) => {
        const statusInfo = getStatusInfo(canje.estado);
        const options = canje.tipo === 'servicio'
            ? ['en_lista', 'agendado', 'completado']
            : ['pendiente_entrega', 'entregado'];

        return (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-card rounded-2xl shadow-lg p-4 sm:p-6 flex flex-col gap-4">
                <div className="flex items-start gap-4 flex-1">
                    <div className="bg-muted p-3 rounded-lg hidden sm:block">
                        {canje.tipo === 'servicio' ? <Wrench className="w-6 h-6 text-primary"/> : <Package className="w-6 h-6 text-primary"/>}
                    </div>
                    <div className="flex-1">
                        <h3 className="text-base sm:text-lg font-bold text-foreground">{canje.producto_nombre}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            Cliente: <span className="font-medium text-foreground/80">{canje.cliente_nombre}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{canje.cliente_telefono}</p>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 w-full pt-4 border-t border-border">
                    <div className="flex items-center gap-2">
                       {statusInfo.icon}
                       <span className="text-muted-foreground font-medium">{statusInfo.text}</span>
                    </div>
                    <Select onValueChange={(value) => handleEstadoChange(canje.id, value)} defaultValue={canje.estado}>
                        <SelectTrigger className="w-full sm:w-auto sm:min-w-[180px] bg-background border-border h-11 text-base">
                            <SelectValue placeholder="Cambiar estado" />
                        </SelectTrigger>
                        <SelectContent>
                            {options.map(opt => (
                                <SelectItem key={opt} value={opt}>{getStatusInfo(opt).text}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </motion.div>
        );
    }

    return (
        <>
            <Helmet><title>Gestión de Canjes - Admin Manny</title></Helmet>
            <div className="container mx-auto px-0 sm:px-4 py-8">
                <h1 className="text-3xl md:text-4xl mb-6 flex items-center gap-3 px-4 sm:px-0"><Truck className="w-8 h-8 text-primary" />Gestión de Canjes</h1>
                <div className="flex border-b border-border mb-6 px-4 sm:px-0">
                    <button onClick={() => setActiveTab('productos')} className={`px-4 py-2 text-base md:text-lg font-semibold transition-colors ${activeTab === 'productos' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>Entregas Pendientes</button>
                    <button onClick={() => setActiveTab('servicios')} className={`px-4 py-2 text-base md:text-lg font-semibold transition-colors ${activeTab === 'servicios' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>Servicios en Lista</button>
                </div>
                
                {loading ? <div className="text-center py-12"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary" /></div>
                : canjesFiltrados.length > 0 ? (
                    <div className="space-y-4 px-4 sm:px-0">
                        {canjesFiltrados.map((canje) => <CanjeCard key={canje.id} canje={canje} />)}
                    </div>
                ) : (
                    <div className="text-center py-16 bg-card rounded-2xl shadow-lg mx-4 sm:mx-0">
                        <h2 className="text-2xl font-bold text-foreground">¡Todo en orden!</h2>
                        <p className="text-muted-foreground mt-2">No hay {activeTab === 'productos' ? 'entregas' : 'servicios'} pendientes.</p>
                    </div>
                )}
            </div>
        </>
    );
};

export default AdminEntregas;