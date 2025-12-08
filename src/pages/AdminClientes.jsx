import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, Search, PlusCircle, Edit, Loader2, Gift, Crown, ChevronRight,
    Filter, ArrowUpDown, Coins, TrendingUp, X, Sparkles
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Stats Card Component - Enhanced with icon backgrounds and better contrast
const StatCard = ({ icon: Icon, label, value, color = "primary", trend }) => {
    const colorClasses = {
        primary: 'bg-primary/10 text-primary',
        'amber-500': 'bg-amber-500/10 text-amber-500',
        'green-500': 'bg-green-500/10 text-green-500',
        'purple-500': 'bg-purple-500/10 text-purple-500',
    };

    return (
        <div className="bg-card rounded-xl p-4 border border-border hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-foreground/70">{label}</p>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClasses[color] || colorClasses.primary}`}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>
            <div className="flex items-end justify-between">
                <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
                {trend && (
                    <div className="flex items-center gap-1 text-green-500 text-sm font-medium px-2 py-0.5 bg-green-500/10 rounded-lg">
                        <TrendingUp className="w-3.5 h-3.5" />
                        {trend}
                    </div>
                )}
            </div>
        </div>
    );
};

const ClientForm = ({ client, onFinished }) => {
    const initialState = client ? { ...client } : { id: undefined, nombre: '', telefono: '', puntos_actuales: 0, nivel: 'partner' };
    const [formData, setFormData] = useState(initialState);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: api.clients.crearOActualizarCliente,
        onSuccess: () => {
            toast({ title: client ? 'Cliente actualizado' : 'Cliente creado con éxito' });
            queryClient.invalidateQueries(['admin-clientes']);
            onFinished();
        },
        onError: (error) => {
            toast({ title: 'Error al guardar', description: error.message, variant: 'destructive' });
        }
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (formData.nombre.trim().length < 3) {
            toast({ title: 'Error de validación', description: 'El nombre es requerido.', variant: 'destructive' });
            return;
        }
        if (!/^\d{10}$/.test(formData.telefono)) {
            toast({ title: 'Error de validación', description: 'El teléfono debe tener 10 dígitos.', variant: 'destructive' });
            return;
        }

        mutation.mutate({
            ...formData,
            puntos_actuales: Number(formData.puntos_actuales) || 0,
        });
    };

    const isSubmitting = mutation.isPending;

    return (
        <DialogContent className="bg-card border-border text-foreground">
            <DialogHeader>
                <DialogTitle className="text-2xl">{client ? 'Editar' : 'Nuevo'} Cliente</DialogTitle>
                <DialogDescription className="sr-only">
                    {client ? 'Modifica los datos del cliente' : 'Ingresa los datos del nuevo cliente'}
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre</Label>
                    <Input id="nombre" name="nombre" value={formData.nombre} onChange={handleChange} placeholder="Nombre completo" required className="h-12 text-base" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="telefono">Teléfono (10 dígitos)</Label>
                    <Input id="telefono" name="telefono" type="tel" pattern="\d{10}" maxLength="10" value={formData.telefono} onChange={handleChange} placeholder="4771234567" required className="h-12 text-base" disabled={!!client} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="puntos_actuales">Puntos Iniciales/Actuales</Label>
                    <Input id="puntos_actuales" name="puntos_actuales" type="number" value={formData.puntos_actuales} onChange={handleChange} placeholder="0" required className="h-12 text-base" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="nivel">Nivel del Cliente</Label>
                    <Select value={formData.nivel || 'partner'} onValueChange={(value) => setFormData(prev => ({ ...prev, nivel: value }))}>
                        <SelectTrigger className="h-12 text-base">
                            <SelectValue placeholder="Seleccionar nivel" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="partner">Partner</SelectItem>
                            <SelectItem value="vip">VIP</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline" disabled={isSubmitting}>Cancelar</Button>
                    </DialogClose>
                    <Button type="submit" variant="investment" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        {client ? 'Actualizar' : 'Crear'} Cliente
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    );
};

const AssignPointsForm = ({ client, onFinished }) => {
    const [pointsToAdd, setPointsToAdd] = useState('');
    const [concept, setConcept] = useState('');
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const quickPoints = [50, 100, 200, 500];

    const mutation = useMutation({
        mutationFn: ({ telefono, puntos, concepto }) => api.clients.asignarPuntosManualmente(telefono, puntos, concepto),
        onSuccess: (data, variables) => {
            toast({ title: "¡Puntos asignados!", description: `${variables.puntos} puntos agregados a ${client.nombre}` });
            queryClient.invalidateQueries(['admin-clientes']);
            onFinished();
        },
        onError: (error) => {
            console.error("Error assigning points:", error);
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    const handleQuickPoints = (points) => {
        setPointsToAdd(points.toString());
    };

    const handleAssignPoints = async (e) => {
        e.preventDefault();

        if (!client || !pointsToAdd || !concept.trim()) {
            toast({ title: "Datos incompletos", description: "Completa todos los campos.", variant: "destructive" });
            return;
        }

        const points = parseInt(pointsToAdd, 10);
        if (isNaN(points)) {
            toast({ title: "Dato inválido", description: "La cantidad de puntos debe ser un número.", variant: "destructive" });
            return;
        }

        mutation.mutate({ telefono: client.telefono, puntos: points, concepto: concept });
    };

    const isSubmitting = mutation.isPending;

    return (
        <DialogContent className="bg-card border-border text-foreground">
            <DialogHeader>
                <DialogTitle className="text-2xl">Asignar Puntos</DialogTitle>
                <DialogDescription>
                    Agrega puntos a <span className="font-semibold text-foreground">{client?.nombre}</span>
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAssignPoints} className="space-y-4 py-4">
                {/* Quick Points Buttons */}
                <div className="space-y-2">
                    <Label>Puntos rápidos</Label>
                    <div className="grid grid-cols-4 gap-2">
                        {quickPoints.map((points) => (
                            <Button
                                key={points}
                                type="button"
                                variant={pointsToAdd === points.toString() ? "default" : "outline"}
                                size="sm"
                                onClick={() => handleQuickPoints(points)}
                                className="h-10"
                            >
                                +{points}
                            </Button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="puntos">O ingresa cantidad personalizada</Label>
                    <Input
                        id="puntos"
                        type="number"
                        placeholder="Ej: 75 o -20 para restar"
                        value={pointsToAdd}
                        onChange={(e) => setPointsToAdd(e.target.value)}
                        className="h-12 text-lg"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="concepto">Concepto</Label>
                    <Input id="concepto" placeholder="Ej: Servicio de afinación" value={concept} onChange={(e) => setConcept(e.target.value)} className="h-12 text-base" />
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline" disabled={isSubmitting}>Cancelar</Button>
                    </DialogClose>
                    <Button type="submit" variant="investment" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Confirmar
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    );
};

const AssignServiceForm = ({ client, onFinished }) => {
    const [serviceName, setServiceName] = useState('');
    const [serviceDesc, setServiceDesc] = useState('');
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const templates = [
        { name: 'Lavado Premium Gratis', desc: 'Incluye encerado y aspirado' },
        { name: 'Cambio de Aceite Gratis', desc: 'Incluye filtro y revisión de niveles' },
        { name: 'Alineación y Balanceo', desc: 'Servicio completo' },
        { name: 'Descuento 20%', desc: 'En tu próximo servicio' },
    ];

    const mutation = useMutation({
        mutationFn: api.services.crearServicioAsignado,
        onSuccess: () => {
            toast({ title: "¡Beneficio asignado!", description: `${serviceName} asignado a ${client.nombre}` });
            queryClient.invalidateQueries(['admin-clientes']);
            onFinished();
        },
        onError: (error) => {
            console.error("Error assigning service:", error);
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    const handleTemplateSelect = (template) => {
        setServiceName(template.name);
        setServiceDesc(template.desc);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!serviceName.trim()) {
            toast({ title: "Nombre requerido", description: "Ingresa el nombre del beneficio.", variant: "destructive" });
            return;
        }

        mutation.mutate({
            cliente_id: client.id,
            nombre: serviceName,
            descripcion: serviceDesc
        });
    };

    const isSubmitting = mutation.isPending;

    return (
        <DialogContent className="bg-card border-border text-foreground max-w-lg">
            <DialogHeader>
                <DialogTitle className="text-2xl">Asignar Beneficio</DialogTitle>
                <DialogDescription>
                    Crea un beneficio para <span className="font-semibold text-foreground">{client?.nombre}</span>
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
                {/* Template Suggestions */}
                <div className="space-y-2">
                    <Label>Sugerencias rápidas</Label>
                    <div className="grid grid-cols-2 gap-2">
                        {templates.map((template, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => handleTemplateSelect(template)}
                                className={`text-left p-3 rounded-lg border transition-all ${
                                    serviceName === template.name
                                        ? 'border-primary bg-primary/10'
                                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                                }`}
                            >
                                <p className="font-medium text-sm text-foreground">{template.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{template.desc}</p>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="serviceName">Nombre del Beneficio</Label>
                    <Input
                        id="serviceName"
                        placeholder="O escribe uno personalizado..."
                        value={serviceName}
                        onChange={(e) => setServiceName(e.target.value)}
                        className="h-12 text-base"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="serviceDesc">Descripción (opcional)</Label>
                    <Input
                        id="serviceDesc"
                        placeholder="Detalles adicionales..."
                        value={serviceDesc}
                        onChange={(e) => setServiceDesc(e.target.value)}
                        className="h-12 text-base"
                    />
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline" disabled={isSubmitting}>Cancelar</Button>
                    </DialogClose>
                    <Button type="submit" variant="investment" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Asignar
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    );
};

const ChangeLevelForm = ({ client, onFinished }) => {
    const [newLevel, setNewLevel] = useState(client?.nivel || 'partner');
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: ({ clienteId, nuevoNivel }) => api.clients.cambiarNivelCliente(clienteId, nuevoNivel),
        onSuccess: (data, variables) => {
            toast({
                title: "Nivel actualizado",
                description: `${client.nombre} ahora es ${variables.nuevoNivel === 'vip' ? 'VIP' : 'Partner'}`
            });
            queryClient.invalidateQueries(['admin-clientes']);
            onFinished();
        },
        onError: (error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        mutation.mutate({ clienteId: client.id, nuevoNivel: newLevel });
    };

    const isSubmitting = mutation.isPending;

    return (
        <DialogContent className="bg-card border-border text-foreground">
            <DialogHeader>
                <DialogTitle className="text-2xl">Cambiar Nivel de {client?.nombre}</DialogTitle>
                <DialogDescription>
                    Selecciona el nuevo nivel para este cliente.
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label>Nivel Actual</Label>
                    <div>
                        <Badge className={client?.nivel === 'vip' ? 'bg-amber-500' : 'bg-purple-500'}>
                            {client?.nivel === 'vip' ? 'VIP' : 'Partner'}
                        </Badge>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="newLevel">Nuevo Nivel</Label>
                    <Select value={newLevel} onValueChange={setNewLevel}>
                        <SelectTrigger className="h-12 text-base">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="partner">Partner</SelectItem>
                            <SelectItem value="vip">VIP</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline" disabled={isSubmitting}>Cancelar</Button>
                    </DialogClose>
                    <Button type="submit" variant="investment" disabled={isSubmitting || newLevel === client?.nivel}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Confirmar Cambio
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    );
};

const AdminClientes = () => {
    const { toast } = useToast();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [modalState, setModalState] = useState({ type: null, client: null });
    const [showFilters, setShowFilters] = useState(false);
    const [levelFilter, setLevelFilter] = useState('all');
    const [sortBy, setSortBy] = useState('nombre');
    const [sortOrder, setSortOrder] = useState('asc');

    const { data: clientes = [], isLoading: loading } = useQuery({
        queryKey: ['admin-clientes'],
        queryFn: api.clients.getTodosLosClientes,
    });

    // Calculate stats
    const stats = useMemo(() => {
        const totalClientes = clientes.length;
        const vipCount = clientes.filter(c => c.nivel === 'vip').length;
        const totalPuntos = clientes.reduce((sum, c) => sum + (c.puntos_actuales || 0), 0);
        const avgPuntos = totalClientes > 0 ? Math.round(totalPuntos / totalClientes) : 0;
        return { totalClientes, vipCount, totalPuntos, avgPuntos };
    }, [clientes]);

    const filteredAndSortedClientes = useMemo(() => {
        let result = [...clientes];

        // Apply search filter
        if (searchTerm) {
            result = result.filter(c =>
                c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.telefono.includes(searchTerm)
            );
        }

        // Apply level filter
        if (levelFilter !== 'all') {
            result = result.filter(c => c.nivel === levelFilter);
        }

        // Apply sorting
        result.sort((a, b) => {
            let comparison = 0;
            if (sortBy === 'nombre') {
                comparison = a.nombre.localeCompare(b.nombre);
            } else if (sortBy === 'puntos') {
                comparison = (a.puntos_actuales || 0) - (b.puntos_actuales || 0);
            } else if (sortBy === 'nivel') {
                comparison = a.nivel.localeCompare(b.nivel);
            }
            return sortOrder === 'asc' ? comparison : -comparison;
        });

        return result;
    }, [searchTerm, clientes, levelFilter, sortBy, sortOrder]);

    const handleModalClose = () => {
        setModalState({ type: null, client: null });
    };

    const toggleSort = (field) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('asc');
        }
    };

    const clearFilters = () => {
        setSearchTerm('');
        setLevelFilter('all');
        setSortBy('nombre');
        setSortOrder('asc');
    };

    const hasActiveFilters = searchTerm || levelFilter !== 'all' || sortBy !== 'nombre';

    return (
        <>
            <Helmet>
                <title>Gestión de Clientes - Admin Manny</title>
            </Helmet>
            <div className="container mx-auto px-4 py-6">
                {/* Header */}
                <PageHeader
                    icon={Users}
                    title="Clientes"
                    subtitle={`${stats.totalClientes} registrados`}
                >
                    <Button variant="investment" onClick={() => setModalState({ type: 'create', client: null })} className="w-full md:w-auto">
                        <PlusCircle className="w-4 h-4 mr-2" />
                        Nuevo Cliente
                    </Button>
                </PageHeader>

                {/* Stats Cards */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6"
                >
                    <StatCard
                        icon={Users}
                        label="Total Clientes"
                        value={stats.totalClientes.toLocaleString()}
                    />
                    <StatCard
                        icon={Crown}
                        label="Clientes VIP"
                        value={stats.vipCount.toLocaleString()}
                        color="amber-500"
                    />
                    <StatCard
                        icon={Coins}
                        label="Puntos Totales"
                        value={stats.totalPuntos.toLocaleString()}
                        color="green-500"
                    />
                    <StatCard
                        icon={Sparkles}
                        label="Promedio Puntos"
                        value={stats.avgPuntos.toLocaleString()}
                        color="purple-500"
                    />
                </motion.div>

                {/* Search and Filters */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="space-y-3 mb-6"
                >
                    {/* Search Bar */}
                    <div className="flex gap-2">
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                            <Input
                                placeholder="Buscar por nombre o teléfono..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-12 h-12 text-base bg-card border-2 border-input rounded-xl pr-10"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full"
                                >
                                    <X className="w-4 h-4 text-muted-foreground" />
                                </button>
                            )}
                        </div>
                        <Button
                            variant={showFilters ? "default" : "outline"}
                            size="icon"
                            className="h-12 w-12 shrink-0"
                            onClick={() => setShowFilters(!showFilters)}
                        >
                            <Filter className="w-5 h-5" />
                        </Button>
                    </div>

                    {/* Expandable Filters */}
                    <AnimatePresence>
                        {showFilters && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                            >
                                <div className="bg-card rounded-xl border border-border p-4 space-y-4">
                                    <div className="flex flex-wrap gap-4">
                                        <div className="flex-1 min-w-[140px]">
                                            <Label className="text-sm mb-2 block">Nivel</Label>
                                            <Select value={levelFilter} onValueChange={setLevelFilter}>
                                                <SelectTrigger className="h-10">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">Todos</SelectItem>
                                                    <SelectItem value="partner">Partner</SelectItem>
                                                    <SelectItem value="vip">VIP</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex-1 min-w-[140px]">
                                            <Label className="text-sm mb-2 block">Ordenar por</Label>
                                            <Select value={sortBy} onValueChange={setSortBy}>
                                                <SelectTrigger className="h-10">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="nombre">Nombre</SelectItem>
                                                    <SelectItem value="puntos">Puntos</SelectItem>
                                                    <SelectItem value="nivel">Nivel</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex-1 min-w-[140px]">
                                            <Label className="text-sm mb-2 block">Orden</Label>
                                            <Select value={sortOrder} onValueChange={setSortOrder}>
                                                <SelectTrigger className="h-10">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="asc">Ascendente</SelectItem>
                                                    <SelectItem value="desc">Descendente</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    {hasActiveFilters && (
                                        <div className="flex justify-end">
                                            <Button variant="ghost" size="sm" onClick={clearFilters}>
                                                <X className="w-4 h-4 mr-1" />
                                                Limpiar filtros
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Results count */}
                    {(searchTerm || levelFilter !== 'all') && (
                        <p className="text-sm text-muted-foreground">
                            Mostrando {filteredAndSortedClientes.length} de {clientes.length} clientes
                        </p>
                    )}
                </motion.div>

                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <Loader2 className="w-12 h-12 animate-spin text-primary" />
                    </div>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="bg-card rounded-2xl shadow-xl overflow-hidden hidden md:block border border-border">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-muted/50">
                                        <tr>
                                            <th className="p-4">
                                                <button
                                                    onClick={() => toggleSort('nombre')}
                                                    className="flex items-center gap-2 font-bold text-foreground hover:text-primary transition-colors"
                                                >
                                                    Cliente
                                                    <ArrowUpDown className={`w-4 h-4 ${sortBy === 'nombre' ? 'text-primary' : 'text-muted-foreground'}`} />
                                                </button>
                                            </th>
                                            <th className="p-4 text-right">
                                                <button
                                                    onClick={() => toggleSort('puntos')}
                                                    className="flex items-center gap-2 font-bold text-foreground hover:text-primary transition-colors ml-auto"
                                                >
                                                    Puntos
                                                    <ArrowUpDown className={`w-4 h-4 ${sortBy === 'puntos' ? 'text-primary' : 'text-muted-foreground'}`} />
                                                </button>
                                            </th>
                                            <th className="p-4 font-bold text-foreground text-center">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredAndSortedClientes.map(cliente => (
                                            <tr
                                                key={cliente.id}
                                                onClick={() => navigate(`/admin/clientes/${cliente.id}`)}
                                                className="border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors cursor-pointer"
                                            >
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        {/* Avatar with gradient background */}
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                                            cliente.nivel === 'vip'
                                                                ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white'
                                                                : 'bg-gradient-to-br from-violet-400 to-violet-600 text-white'
                                                        }`}>
                                                            <span className="font-bold">{cliente.nombre.charAt(0).toUpperCase()}</span>
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium text-foreground">{cliente.nombre}</span>
                                                                {/* Improved badge with solid background */}
                                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                                                    cliente.nivel === 'vip'
                                                                        ? 'bg-amber-500 text-white'
                                                                        : 'bg-violet-500 text-white'
                                                                }`}>
                                                                    {cliente.nivel === 'vip' && <Crown className="w-3 h-3" />}
                                                                    {cliente.nivel === 'vip' ? 'VIP' : 'Partner'}
                                                                </span>
                                                            </div>
                                                            <span className="text-sm text-muted-foreground">{cliente.telefono}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <span className="font-bold text-primary text-lg">{cliente.puntos_actuales?.toLocaleString() || 0}</span>
                                                    <span className="text-xs text-muted-foreground ml-1">pts</span>
                                                </td>
                                                <td className="p-4" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex justify-center items-center gap-1">
                                                        <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-green-500/10 hover:text-green-500" onClick={() => setModalState({ type: 'assign', client: cliente })} title="Asignar puntos">
                                                            <Coins className="w-4 h-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-purple-500/10 hover:text-purple-500" onClick={() => setModalState({ type: 'service', client: cliente })} title="Asignar beneficio">
                                                            <Gift className="w-4 h-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-blue-500/10 hover:text-blue-500" onClick={() => setModalState({ type: 'edit', client: cliente })} title="Editar cliente">
                                                            <Edit className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden space-y-3">
                            {filteredAndSortedClientes.map(cliente => (
                                <motion.div
                                    key={cliente.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                                >
                                    {/* Card Header - Clickable area */}
                                    <Link
                                        to={`/admin/clientes/${cliente.id}`}
                                        className="block p-4 active:bg-muted/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            {/* Avatar with gradient background */}
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                                                cliente.nivel === 'vip'
                                                    ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg shadow-amber-500/25'
                                                    : 'bg-gradient-to-br from-violet-400 to-violet-600 text-white shadow-lg shadow-violet-500/25'
                                            }`}>
                                                <span className="font-bold text-lg">{cliente.nombre.charAt(0).toUpperCase()}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="font-semibold text-foreground truncate">{cliente.nombre}</p>
                                                    {/* Improved badge with better contrast */}
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold flex-shrink-0 ${
                                                        cliente.nivel === 'vip'
                                                            ? 'bg-amber-500 text-white dark:bg-amber-500/90'
                                                            : 'bg-violet-500 text-white dark:bg-violet-500/90'
                                                    }`}>
                                                        {cliente.nivel === 'vip' && <Crown className="w-3 h-3" />}
                                                        {cliente.nivel === 'vip' ? 'VIP' : 'Partner'}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-muted-foreground">{cliente.telefono}</p>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <div className="text-right">
                                                    <p className="font-bold text-primary text-xl">{cliente.puntos_actuales?.toLocaleString('es-MX') || 0}</p>
                                                    <p className="text-xs text-muted-foreground">puntos</p>
                                                </div>
                                                <ChevronRight className="w-5 h-5 text-muted-foreground" />
                                            </div>
                                        </div>
                                    </Link>

                                    {/* Quick Actions Bar - Enhanced with icons and better spacing */}
                                    <div className="border-t border-border bg-muted/30 px-1 py-1.5 flex justify-around gap-1">
                                        <button
                                            onClick={() => setModalState({ type: 'assign', client: cliente })}
                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all active:scale-95"
                                        >
                                            <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center">
                                                <Coins className="w-4 h-4 text-green-500" />
                                            </div>
                                            <span>Puntos</span>
                                        </button>
                                        <button
                                            onClick={() => setModalState({ type: 'service', client: cliente })}
                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all active:scale-95"
                                        >
                                            <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                                <Gift className="w-4 h-4 text-purple-500" />
                                            </div>
                                            <span>Beneficio</span>
                                        </button>
                                        <button
                                            onClick={() => setModalState({ type: 'edit', client: cliente })}
                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all active:scale-95"
                                        >
                                            <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                                <Edit className="w-4 h-4 text-blue-500" />
                                            </div>
                                            <span>Editar</span>
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* Empty State */}
                        {filteredAndSortedClientes.length === 0 && !loading && (
                            <div className="text-center py-12 bg-card rounded-2xl border border-border">
                                <Users className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                                <p className="text-muted-foreground text-lg mb-2">
                                    {searchTerm || levelFilter !== 'all'
                                        ? 'No se encontraron clientes con esos filtros'
                                        : 'Aún no hay clientes registrados'}
                                </p>
                                {(searchTerm || levelFilter !== 'all') && (
                                    <Button variant="outline" onClick={clearFilters} className="mt-2">
                                        Limpiar filtros
                                    </Button>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            <Dialog open={!!modalState.type} onOpenChange={() => setModalState({ type: null, client: null })}>
                {modalState.type === 'create' && <ClientForm onFinished={handleModalClose} />}
                {modalState.type === 'edit' && <ClientForm client={modalState.client} onFinished={handleModalClose} />}
                {modalState.type === 'assign' && <AssignPointsForm client={modalState.client} onFinished={handleModalClose} />}
                {modalState.type === 'service' && <AssignServiceForm client={modalState.client} onFinished={handleModalClose} />}
                {modalState.type === 'level' && <ChangeLevelForm client={modalState.client} onFinished={handleModalClose} />}
            </Dialog>
        </>
    );
};

export default AdminClientes;
