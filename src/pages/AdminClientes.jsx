import { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Users, Search, Edit, Loader2, Gift, Crown, ChevronRight,
    ArrowUpDown, Coins, X, Star, TrendingUp, Phone, UserPlus
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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

// Avatar Component with gradient background
const ClientAvatar = ({ nombre, nivel, size = 'md' }) => {
    const sizeClasses = {
        sm: 'w-9 h-9 text-sm',
        md: 'w-11 h-11 text-base',
        lg: 'w-14 h-14 text-xl'
    };

    // VIP = dorado/naranja, Partner = azul/cyan
    const gradientClasses = nivel === 'vip'
        ? 'bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600'
        : 'bg-gradient-to-br from-cyan-500 via-blue-500 to-blue-700';

    return (
        <div className={`${sizeClasses[size]} ${gradientClasses} rounded-full flex items-center justify-center flex-shrink-0 shadow-lg`}>
            <span className="font-bold text-white drop-shadow-sm">
                {nombre.charAt(0).toUpperCase()}
            </span>
        </div>
    );
};

// Level Badge Component - Clickeable para cambiar nivel
const LevelBadge = ({ nivel, showLabel = true, onClick, clickable = false }) => {
    const content = nivel === 'vip' ? (
        <div className="flex items-center gap-1">
            <Crown className="w-4 h-4 text-amber-500" />
            {showLabel && <span className="text-xs font-semibold text-amber-500">VIP</span>}
        </div>
    ) : (
        <div className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-blue-500" />
            {showLabel && <span className="text-xs font-medium text-blue-500">Partner</span>}
        </div>
    );

    if (clickable && onClick) {
        return (
            <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all hover:bg-muted ${
                    nivel === 'vip' ? 'hover:bg-amber-500/10' : 'hover:bg-blue-500/10'
                }`}
                title="Cambiar nivel"
            >
                {content}
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
            </button>
        );
    }

    return content;
};

// Stats Card Component - Enhanced design
const StatCard = ({ icon: Icon, label, value, color, subtext, bgAccent }) => (
    <div className="relative bg-card rounded-xl p-4 border border-border overflow-hidden group hover:border-border/80 transition-colors">
        {/* Subtle gradient accent */}
        <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-10 -translate-y-1/2 translate-x-1/2 ${bgAccent || 'bg-primary'}`} />

        <div className="relative flex items-start justify-between">
            <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">{label}</p>
                <p className={`text-3xl font-bold ${color} tabular-nums`}>{value}</p>
                {subtext && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-current opacity-50" />
                        {subtext}
                    </p>
                )}
            </div>
            <div className={`p-2.5 rounded-xl ${color} bg-current/10 flex-shrink-0`}>
                <Icon className="w-5 h-5" />
            </div>
        </div>
    </div>
);

// Filter Tab Component
const FilterTab = ({ active, onClick, children, count, color }) => (
    <button
        onClick={onClick}
        className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            active
                ? 'bg-card border border-border shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        }`}
    >
        {children}
        <span className={`text-xs px-1.5 py-0.5 rounded-md ${
            active ? `${color} bg-current/10` : 'text-muted-foreground'
        }`}>
            {count}
        </span>
    </button>
);

// Quick Action Button
const QuickAction = ({ icon: Icon, label, onClick, color = 'text-muted-foreground' }) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-muted/50 transition-colors ${color} hover:text-foreground`}
    >
        <Icon className="w-4 h-4" />
        <span className="text-[10px] font-medium">{label}</span>
    </button>
);

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
                            <SelectItem value="partner">
                                <div className="flex items-center gap-2">
                                    <Star className="w-4 h-4 text-blue-500" />
                                    Partner
                                </div>
                            </SelectItem>
                            <SelectItem value="vip">
                                <div className="flex items-center gap-2">
                                    <Crown className="w-4 h-4 text-amber-500" />
                                    VIP
                                </div>
                            </SelectItem>
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
        onSuccess: (_, variables) => {
            toast({ title: "¡Puntos asignados!", description: `${variables.puntos} puntos agregados a ${client.nombre}` });
            queryClient.invalidateQueries(['admin-clientes']);
            onFinished();
        },
        onError: (error) => {
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
                <DialogTitle className="text-2xl flex items-center gap-3">
                    <ClientAvatar nombre={client?.nombre || ''} nivel={client?.nivel} size="sm" />
                    Asignar Puntos
                </DialogTitle>
                <DialogDescription>
                    Cliente: <span className="font-semibold text-foreground">{client?.nombre}</span>
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAssignPoints} className="space-y-4 py-4">
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
                <DialogTitle className="text-2xl flex items-center gap-3">
                    <ClientAvatar nombre={client?.nombre || ''} nivel={client?.nivel} size="sm" />
                    Asignar Beneficio
                </DialogTitle>
                <DialogDescription>
                    Cliente: <span className="font-semibold text-foreground">{client?.nombre}</span>
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
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
                                        ? 'border-primary bg-primary/5'
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
                        Asignar Beneficio
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    );
};

const ChangeLevelForm = ({ client, onFinished }) => {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: ({ clienteId, nuevoNivel }) => api.clients.cambiarNivelCliente(clienteId, nuevoNivel),
        onSuccess: (_, variables) => {
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

    const handleLevelChange = (nuevoNivel) => {
        if (nuevoNivel !== client?.nivel) {
            mutation.mutate({ clienteId: client.id, nuevoNivel });
        }
    };

    const isSubmitting = mutation.isPending;
    const currentLevel = client?.nivel || 'partner';

    return (
        <DialogContent className="bg-card border-border text-foreground sm:max-w-sm">
            <DialogHeader>
                <DialogTitle className="text-lg font-medium">Cambiar Nivel</DialogTitle>
            </DialogHeader>
            <div className="py-2">
                {/* Client Info - Compact */}
                <div className="flex items-center gap-3 mb-4">
                    <ClientAvatar nombre={client?.nombre || ''} nivel={currentLevel} size="md" />
                    <p className="font-medium text-foreground">{client?.nombre}</p>
                </div>

                {/* Toggle Switch - Notion style */}
                <div className="relative flex bg-muted rounded-lg p-1">
                    {/* Sliding background */}
                    <div
                        className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-md transition-all duration-200 ease-out ${
                            currentLevel === 'vip'
                                ? 'translate-x-[calc(100%+4px)] bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30'
                                : 'translate-x-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-blue-500/30'
                        }`}
                    />

                    {/* Partner Option */}
                    <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleLevelChange('partner')}
                        className={`relative flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-md text-sm font-medium transition-colors ${
                            currentLevel === 'partner'
                                ? 'text-blue-500'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        {isSubmitting && currentLevel !== 'partner' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Star className="w-4 h-4" />
                        )}
                        Partner
                    </button>

                    {/* VIP Option */}
                    <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleLevelChange('vip')}
                        className={`relative flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-md text-sm font-medium transition-colors ${
                            currentLevel === 'vip'
                                ? 'text-amber-500'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        {isSubmitting && currentLevel !== 'vip' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Crown className="w-4 h-4" />
                        )}
                        VIP
                    </button>
                </div>
            </div>
        </DialogContent>
    );
};

// Desktop Table Row
const ClientRow = ({ cliente, onAction, navigate }) => (
    <tr
        onClick={() => navigate(`/admin/clientes/${cliente.id}`)}
        className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors cursor-pointer"
    >
        <td className="p-4">
            <div className="flex items-center gap-3">
                <ClientAvatar nombre={cliente.nombre} nivel={cliente.nivel} size="md" />
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{cliente.nombre}</span>
                        <LevelBadge nivel={cliente.nivel} showLabel={false} />
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Phone className="w-3 h-3" />
                        {cliente.telefono}
                    </div>
                </div>
            </div>
        </td>
        <td className="p-4" onClick={(e) => e.stopPropagation()}>
            <LevelBadge
                nivel={cliente.nivel}
                clickable
                onClick={() => onAction('level', cliente)}
            />
        </td>
        <td className="p-4 text-right">
            <div className="flex items-center justify-end gap-1">
                <Coins className="w-4 h-4 text-primary" />
                <span className="font-bold text-lg text-foreground">{cliente.puntos_actuales?.toLocaleString() || 0}</span>
            </div>
            <p className="text-xs text-muted-foreground">puntos acumulados</p>
        </td>
        <td className="p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end items-center gap-1">
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-muted-foreground hover:text-foreground"
                    onClick={() => onAction('assign', cliente)}
                >
                    <Coins className="w-4 h-4 mr-1" />
                    Puntos
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-muted-foreground hover:text-foreground"
                    onClick={() => onAction('service', cliente)}
                >
                    <Gift className="w-4 h-4 mr-1" />
                    Beneficio
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => onAction('edit', cliente)}
                >
                    <Edit className="w-4 h-4" />
                </Button>
            </div>
        </td>
    </tr>
);

// Mobile Card
const ClientCard = ({ cliente, onAction }) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-2xl border border-border overflow-hidden"
    >
        <Link
            to={`/admin/clientes/${cliente.id}`}
            className="block p-4 active:bg-muted/30 transition-colors"
        >
            <div className="flex items-center gap-3">
                <ClientAvatar nombre={cliente.nombre} nivel={cliente.nivel} size="md" />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground truncate">{cliente.nombre}</p>
                        <LevelBadge nivel={cliente.nivel} showLabel={false} />
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-sm text-muted-foreground">{cliente.telefono}</span>
                        <LevelBadge nivel={cliente.nivel} />
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                        <div className="flex items-center justify-end gap-1">
                            <Coins className="w-4 h-4 text-primary" />
                            <p className="font-bold text-foreground text-xl">{cliente.puntos_actuales?.toLocaleString('es-MX') || 0}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">puntos</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
            </div>
        </Link>

        {/* Quick Actions Bar */}
        <div className="border-t border-border px-4 py-2 flex justify-between items-center bg-muted/20">
            <div className="flex gap-1">
                <QuickAction
                    icon={Coins}
                    label="Puntos"
                    onClick={() => onAction('assign', cliente)}
                    color="text-primary"
                />
                <QuickAction
                    icon={Gift}
                    label="Beneficio"
                    onClick={() => onAction('service', cliente)}
                    color="text-green-500"
                />
                <QuickAction
                    icon={cliente.nivel === 'vip' ? Star : Crown}
                    label="Nivel"
                    onClick={() => onAction('level', cliente)}
                    color={cliente.nivel === 'vip' ? 'text-blue-500' : 'text-amber-500'}
                />
            </div>
            <button
                onClick={() => onAction('edit', cliente)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
                <Edit className="w-4 h-4" />
            </button>
        </div>
    </motion.div>
);

const AdminClientes = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [modalState, setModalState] = useState({ type: null, client: null });
    const [levelFilter, setLevelFilter] = useState('all');
    const [sortBy, setSortBy] = useState('nombre');
    const [sortOrder, setSortOrder] = useState('asc');

    const { data: clientes = [], isLoading: loading } = useQuery({
        queryKey: ['admin-clientes'],
        queryFn: api.clients.getTodosLosClientes,
        staleTime: 30000,
    });

    // Calculate stats
    const stats = useMemo(() => {
        const totalClientes = clientes.length;
        const vipCount = clientes.filter(c => c.nivel === 'vip').length;
        const partnerCount = clientes.filter(c => c.nivel === 'partner').length;
        const totalPuntos = clientes.reduce((sum, c) => sum + (c.puntos_actuales || 0), 0);
        const avgPuntos = totalClientes > 0 ? Math.round(totalPuntos / totalClientes) : 0;
        return { totalClientes, vipCount, partnerCount, totalPuntos, avgPuntos };
    }, [clientes]);

    const filteredAndSortedClientes = useMemo(() => {
        let result = [...clientes];

        // Apply level filter
        if (levelFilter === 'vip') {
            result = result.filter(c => c.nivel === 'vip');
        } else if (levelFilter === 'partner') {
            result = result.filter(c => c.nivel === 'partner');
        }

        // Apply search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(c =>
                c.nombre.toLowerCase().includes(term) ||
                c.telefono.includes(searchTerm)
            );
        }

        // Apply sorting
        result.sort((a, b) => {
            let comparison = 0;
            if (sortBy === 'nombre') {
                comparison = a.nombre.localeCompare(b.nombre);
            } else if (sortBy === 'puntos') {
                comparison = (a.puntos_actuales || 0) - (b.puntos_actuales || 0);
            } else if (sortBy === 'nivel') {
                comparison = (b.nivel === 'vip' ? 1 : 0) - (a.nivel === 'vip' ? 1 : 0);
            }
            return sortOrder === 'asc' ? comparison : -comparison;
        });

        return result;
    }, [searchTerm, clientes, levelFilter, sortBy, sortOrder]);

    const handleModalClose = () => {
        setModalState({ type: null, client: null });
    };

    const handleAction = (type, client) => {
        setModalState({ type, client });
    };

    const toggleSort = (field) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder(field === 'puntos' ? 'desc' : 'asc');
        }
    };

    return (
        <>
            <Helmet>
                <title>Gestión de Clientes - Admin Manny</title>
            </Helmet>
            <div className="space-y-6">
                {/* Header */}
                <PageHeader
                    icon={Users}
                    title="Clientes"
                    subtitle={`${stats.totalClientes} clientes registrados`}
                >
                    <Button variant="investment" onClick={() => setModalState({ type: 'create', client: null })} className="gap-2">
                        <UserPlus className="w-4 h-4" />
                        Nuevo Cliente
                    </Button>
                </PageHeader>

                {/* Stats Grid */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="grid grid-cols-2 md:grid-cols-4 gap-3"
                >
                    <StatCard
                        icon={Users}
                        label="Total Clientes"
                        value={stats.totalClientes}
                        color="text-foreground"
                        bgAccent="bg-gray-500"
                    />
                    <StatCard
                        icon={Star}
                        label="Partners"
                        value={stats.partnerCount}
                        color="text-blue-500"
                        bgAccent="bg-blue-500"
                        subtext={`${stats.totalClientes > 0 ? Math.round(stats.partnerCount / stats.totalClientes * 100) : 0}% del total`}
                    />
                    <StatCard
                        icon={Crown}
                        label="VIP"
                        value={stats.vipCount}
                        color="text-amber-500"
                        bgAccent="bg-amber-500"
                        subtext={`${stats.totalClientes > 0 ? Math.round(stats.vipCount / stats.totalClientes * 100) : 0}% del total`}
                    />
                    <StatCard
                        icon={TrendingUp}
                        label="Puntos Totales"
                        value={stats.totalPuntos.toLocaleString()}
                        color="text-primary"
                        bgAccent="bg-primary"
                        subtext={`~${stats.avgPuntos} promedio`}
                    />
                </motion.div>

                {/* Search + Filters */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="space-y-4"
                >
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                        <Input
                            placeholder="Buscar por nombre o teléfono..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-12 h-12 text-base bg-card border-border rounded-xl pr-10"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-muted rounded-full transition-colors"
                            >
                                <X className="w-4 h-4 text-muted-foreground" />
                            </button>
                        )}
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-xl">
                            <FilterTab
                                active={levelFilter === 'all'}
                                onClick={() => setLevelFilter('all')}
                                count={stats.totalClientes}
                                color="text-foreground"
                            >
                                <Users className="w-4 h-4" />
                                <span className="hidden sm:inline">Todos</span>
                            </FilterTab>
                            <FilterTab
                                active={levelFilter === 'partner'}
                                onClick={() => setLevelFilter('partner')}
                                count={stats.partnerCount}
                                color="text-blue-500"
                            >
                                <Star className="w-4 h-4 text-blue-500" />
                                <span className="hidden sm:inline">Partner</span>
                            </FilterTab>
                            <FilterTab
                                active={levelFilter === 'vip'}
                                onClick={() => setLevelFilter('vip')}
                                count={stats.vipCount}
                                color="text-amber-500"
                            >
                                <Crown className="w-4 h-4 text-amber-500" />
                                <span className="hidden sm:inline">VIP</span>
                            </FilterTab>
                        </div>

                        {/* Results count on filter */}
                        {(searchTerm || levelFilter !== 'all') && (
                            <span className="text-sm text-muted-foreground">
                                {filteredAndSortedClientes.length} resultado{filteredAndSortedClientes.length !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                </motion.div>

                {loading ? (
                    <div className="flex flex-col justify-center items-center py-20 gap-3">
                        <Loader2 className="w-10 h-10 animate-spin text-primary" />
                        <p className="text-muted-foreground">Cargando clientes...</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="bg-card rounded-2xl border border-border overflow-hidden hidden md:block"
                        >
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-muted/30 border-b border-border">
                                        <tr>
                                            <th className="p-4">
                                                <button
                                                    onClick={() => toggleSort('nombre')}
                                                    className="flex items-center gap-2 font-semibold text-foreground hover:text-primary transition-colors"
                                                >
                                                    Cliente
                                                    <ArrowUpDown className={`w-4 h-4 ${sortBy === 'nombre' ? 'text-primary' : 'text-muted-foreground'}`} />
                                                </button>
                                            </th>
                                            <th className="p-4">
                                                <button
                                                    onClick={() => toggleSort('nivel')}
                                                    className="flex items-center gap-2 font-semibold text-foreground hover:text-primary transition-colors"
                                                >
                                                    Nivel
                                                    <ArrowUpDown className={`w-4 h-4 ${sortBy === 'nivel' ? 'text-primary' : 'text-muted-foreground'}`} />
                                                </button>
                                            </th>
                                            <th className="p-4 text-right">
                                                <button
                                                    onClick={() => toggleSort('puntos')}
                                                    className="flex items-center gap-2 font-semibold text-foreground hover:text-primary transition-colors ml-auto"
                                                >
                                                    Puntos
                                                    <ArrowUpDown className={`w-4 h-4 ${sortBy === 'puntos' ? 'text-primary' : 'text-muted-foreground'}`} />
                                                </button>
                                            </th>
                                            <th className="p-4 text-right font-semibold text-foreground">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredAndSortedClientes.map(cliente => (
                                            <ClientRow
                                                key={cliente.id}
                                                cliente={cliente}
                                                onAction={handleAction}
                                                navigate={navigate}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>

                        {/* Mobile Cards */}
                        <div className="md:hidden space-y-3">
                            {filteredAndSortedClientes.map((cliente, index) => (
                                <motion.div
                                    key={cliente.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.05 * Math.min(index, 10) }}
                                >
                                    <ClientCard
                                        cliente={cliente}
                                        onAction={handleAction}
                                    />
                                </motion.div>
                            ))}
                        </div>

                        {/* Empty State */}
                        {filteredAndSortedClientes.length === 0 && !loading && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center py-16 bg-card rounded-2xl border border-border"
                            >
                                {levelFilter === 'vip' ? (
                                    <>
                                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-amber-500/10 flex items-center justify-center">
                                            <Crown className="w-10 h-10 text-amber-500" />
                                        </div>
                                        <p className="text-lg font-medium text-foreground mb-1">
                                            {searchTerm ? 'No se encontraron clientes VIP' : 'Aún no hay clientes VIP'}
                                        </p>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            Los clientes VIP tienen beneficios exclusivos
                                        </p>
                                    </>
                                ) : levelFilter === 'partner' ? (
                                    <>
                                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-blue-500/10 flex items-center justify-center">
                                            <Star className="w-10 h-10 text-blue-500" />
                                        </div>
                                        <p className="text-lg font-medium text-foreground mb-1">
                                            {searchTerm ? 'No se encontraron Partners' : 'Aún no hay clientes Partner'}
                                        </p>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            Los Partners acumulan puntos en cada servicio
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                                            <Users className="w-10 h-10 text-muted-foreground" />
                                        </div>
                                        <p className="text-lg font-medium text-foreground mb-1">
                                            {searchTerm ? 'No se encontraron clientes' : 'Aún no hay clientes registrados'}
                                        </p>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            Comienza agregando tu primer cliente
                                        </p>
                                    </>
                                )}
                                {(searchTerm || levelFilter !== 'all') ? (
                                    <Button
                                        variant="outline"
                                        onClick={() => { setSearchTerm(''); setLevelFilter('all'); }}
                                    >
                                        Limpiar filtros
                                    </Button>
                                ) : (
                                    <Button
                                        variant="investment"
                                        onClick={() => setModalState({ type: 'create', client: null })}
                                        className="gap-2"
                                    >
                                        <UserPlus className="w-4 h-4" />
                                        Agregar Cliente
                                    </Button>
                                )}
                            </motion.div>
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
