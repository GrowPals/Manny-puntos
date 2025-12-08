import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Truck, Loader2, Wrench, Package, Calendar, CheckCircle, Hourglass, PackageCheck, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from '@/components/ui/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logger } from '@/lib/logger';

const AdminEntregas = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('productos');
    const [searchTerm, setSearchTerm] = useState('');

    const { data: canjes = [], isLoading: loading } = useQuery({
        queryKey: ['admin-canjes'],
        queryFn: api.redemptions.getTodosLosCanjes,
    });

    const mutation = useMutation({
        mutationFn: ({ canjeId, nuevoEstado }) => api.redemptions.actualizarEstadoCanje(canjeId, nuevoEstado),
        onSuccess: () => {
            toast({ title: '¡Estado actualizado!' });
            queryClient.invalidateQueries(['admin-canjes']);
        },
        onError: (error) => {
            logger.error('Error updating status', { error: error.message });
            toast({ title: 'Error al actualizar', description: error.message, variant: 'destructive' });
        }
    });

    const handleEstadoChange = (canjeId, nuevoEstado) => {
        mutation.mutate({ canjeId, nuevoEstado });
    };

    const getStatusInfo = (estado) => {
        const statuses = {
            'pendiente_entrega': { text: 'Pendiente', icon: <Hourglass className="w-4 h-4 text-yellow-500" /> },
            'entregado': { text: 'Entregado', icon: <PackageCheck className="w-4 h-4 text-green-500" /> },
            'en_lista': { text: 'En Lista', icon: <Hourglass className="w-4 h-4 text-yellow-500" /> },
            'agendado': { text: 'Agendado', icon: <Calendar className="w-4 h-4 text-blue-500" /> },
            'completado': { text: 'Completado', icon: <CheckCircle className="w-4 h-4 text-green-500" /> },
        };
        return statuses[estado] || { text: 'Desconocido', icon: <Hourglass className="w-4 h-4" /> };
    };

    const canjesFiltrados = useMemo(() => {
        const lowercasedSearch = searchTerm.toLowerCase();
        return canjes.filter(c => {
            // Filtrar por tab (productos vs servicios)
            const matchesTab = activeTab === 'productos' ? c.tipo === 'producto' : c.tipo === 'servicio';
            // Filtrar solo pendientes (no entregados/completados)
            const isPending = c.estado !== (c.tipo === 'producto' ? 'entregado' : 'completado');
            // Filtrar por búsqueda
            const matchesSearch = !searchTerm ||
                c.cliente_nombre?.toLowerCase().includes(lowercasedSearch) ||
                c.cliente_telefono?.includes(searchTerm) ||
                c.producto_nombre?.toLowerCase().includes(lowercasedSearch);

            return matchesTab && isPending && matchesSearch;
        });
    }, [canjes, activeTab, searchTerm]);

    const CanjeCard = ({ canje }) => {
        const statusInfo = getStatusInfo(canje.estado);
        const options = canje.tipo === 'servicio'
            ? ['en_lista', 'agendado', 'completado']
            : ['pendiente_entrega', 'entregado'];

        return (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-card rounded-2xl shadow-sm border border-border p-4 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="text-primary">
                        {canje.tipo === 'servicio' ? <Wrench className="w-6 h-6"/> : <Package className="w-6 h-6"/>}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-foreground truncate">{canje.producto_nombre}</h3>
                        <p className="text-sm text-foreground/80 truncate">{canje.cliente_nombre}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span>{canje.cliente_telefono}</span>
                            <span>•</span>
                            <span>{new Date(canje.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>
                        </div>
                    </div>
                    {/* Status badge mobile */}
                    <div className="sm:hidden flex-shrink-0">
                        {statusInfo.icon}
                    </div>
                </div>
                <div className="flex items-center justify-between gap-3 pt-3 border-t border-border">
                    <div className="hidden sm:flex items-center gap-2">
                       {statusInfo.icon}
                       <span className="text-sm text-muted-foreground font-medium">{statusInfo.text}</span>
                    </div>
                    <Select onValueChange={(value) => handleEstadoChange(canje.id, value)} defaultValue={canje.estado}>
                        <SelectTrigger className="flex-1 sm:flex-none sm:min-w-[160px] bg-background border-border h-10 text-sm">
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
            <div className="space-y-6">
                <PageHeader
                    icon={Truck}
                    title="Canjes"
                    subtitle={`${canjes.filter(c => c.estado !== 'entregado' && c.estado !== 'completado').length} pendientes`}
                />

                {/* Search */}
                <div className="mb-4 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <Input
                        placeholder="Buscar por cliente o producto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-11 bg-card"
                    />
                </div>

                {/* Tabs */}
                <div className="flex border-b border-border mb-6">
                    <button
                        onClick={() => setActiveTab('productos')}
                        className={`px-4 py-2 text-base md:text-lg font-semibold transition-colors ${activeTab === 'productos' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <Package className="w-4 h-4 inline mr-2" />
                        Entregas ({canjes.filter(c => c.tipo === 'producto' && c.estado !== 'entregado').length})
                    </button>
                    <button
                        onClick={() => setActiveTab('servicios')}
                        className={`px-4 py-2 text-base md:text-lg font-semibold transition-colors ${activeTab === 'servicios' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <Wrench className="w-4 h-4 inline mr-2" />
                        Servicios ({canjes.filter(c => c.tipo === 'servicio' && c.estado !== 'completado').length})
                    </button>
                </div>

                {loading ? (
                    <div className="text-center py-12">
                        <Loader2 className="animate-spin h-8 w-8 mx-auto text-primary" />
                    </div>
                ) : canjesFiltrados.length > 0 ? (
                    <div className="space-y-4">
                        {canjesFiltrados.map((canje) => <CanjeCard key={canje.id} canje={canje} />)}
                    </div>
                ) : (
                    <div className="text-center py-16 bg-card rounded-2xl shadow-sm border border-border">
                        {searchTerm ? (
                            <>
                                <Search className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                                <h2 className="text-xl font-bold text-foreground">Sin resultados</h2>
                                <p className="text-muted-foreground mt-2">No se encontraron canjes para "{searchTerm}"</p>
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-12 h-12 mx-auto text-green-500/50 mb-4" />
                                <h2 className="text-xl font-bold text-foreground">¡Todo en orden!</h2>
                                <p className="text-muted-foreground mt-2">No hay {activeTab === 'productos' ? 'entregas' : 'servicios'} pendientes.</p>
                            </>
                        )}
                    </div>
                )}
            </div>
        </>
    );
};

export default AdminEntregas;
