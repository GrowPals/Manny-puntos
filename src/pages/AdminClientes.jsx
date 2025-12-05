import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Search, PlusCircle, Edit, Loader2, Gift, Crown, ChevronRight } from 'lucide-react';
import { useSupabaseAPI } from '@/context/SupabaseContext';
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

const ClientForm = ({ client, onFinished }) => {
    const initialState = client ? { ...client } : { id: undefined, nombre: '', telefono: '', puntos_actuales: 0, nivel: 'partner' };
    const [formData, setFormData] = useState(initialState);
    const { crearOActualizarCliente } = useSupabaseAPI();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (formData.nombre.trim().length < 3) {
                toast({ title: 'Error de validación', description: 'El nombre es requerido.', variant: 'destructive' });
                setIsSubmitting(false);
                return;
            }
            if (!/^\d{10}$/.test(formData.telefono)) {
                toast({ title: 'Error de validación', description: 'El teléfono debe tener 10 dígitos.', variant: 'destructive' });
                setIsSubmitting(false);
                return;
            }
            await crearOActualizarCliente({
                ...formData,
                puntos_actuales: Number(formData.puntos_actuales) || 0,
            });
            toast({ title: client ? 'Cliente actualizado' : 'Cliente creado con éxito' });
            onFinished();
        } catch(error) {
            toast({ title: 'Error al guardar', description: error.message, variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

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
    const { asignarPuntosManualmente } = useSupabaseAPI();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAssignPoints = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (!client || !pointsToAdd || !concept.trim()) {
                toast({ title: "Datos incompletos", description: "Completa todos los campos.", variant: "destructive" });
                setIsSubmitting(false);
                return;
            }

            const points = parseInt(pointsToAdd, 10);
            if (isNaN(points)) {
                toast({ title: "Dato inválido", description: "La cantidad de puntos debe ser un número.", variant: "destructive" });
                setIsSubmitting(false);
                return;
            }

            await asignarPuntosManualmente(client.telefono, points, concept);
            toast({ title: "¡Puntos asignados!", description: `${points} puntos agregados a ${client.nombre}` });
            onFinished();
        } catch (error) {
            console.error("Error assigning points:", error);
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <DialogContent className="bg-card border-border text-foreground">
            <DialogHeader>
                <DialogTitle className="text-2xl">Asignar Puntos a {client?.nombre}</DialogTitle>
                <DialogDescription>
                    Agrega o resta puntos manualmente. Usa números negativos para restar.
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAssignPoints} className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="puntos">Puntos a asignar</Label>
                    <Input id="puntos" type="number" placeholder="Ej: 50 o -20" value={pointsToAdd} onChange={(e) => setPointsToAdd(e.target.value)} className="h-12 text-lg" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="concepto">Concepto</Label>
                    <Input id="concepto" placeholder="Ej: 'Bono especial'" value={concept} onChange={(e) => setConcept(e.target.value)} className="h-12 text-lg" />
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline" disabled={isSubmitting}>Cancelar</Button>
                    </DialogClose>
                    <Button type="submit" variant="investment" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Confirmar Asignación
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    );
};

const AssignServiceForm = ({ client, onFinished }) => {
    const [serviceName, setServiceName] = useState('');
    const [serviceDesc, setServiceDesc] = useState('');
    const { crearServicioAsignado } = useSupabaseAPI();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (!serviceName.trim()) {
                toast({ title: "Nombre requerido", description: "Ingresa el nombre del beneficio.", variant: "destructive" });
                setIsSubmitting(false);
                return;
            }

            await crearServicioAsignado({
                cliente_id: client.id,
                nombre: serviceName,
                descripcion: serviceDesc
            });

            toast({ title: "¡Beneficio asignado!", description: `${serviceName} asignado a ${client.nombre}` });
            onFinished();
        } catch (error) {
            console.error("Error assigning service:", error);
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <DialogContent className="bg-card border-border text-foreground">
            <DialogHeader>
                <DialogTitle className="text-2xl">Asignar Beneficio a {client?.nombre}</DialogTitle>
                <DialogDescription>
                    Crea un beneficio exclusivo que el cliente podrá canjear desde su dashboard.
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="serviceName">Nombre del Beneficio</Label>
                    <Input
                        id="serviceName"
                        placeholder="Ej: Lavado Premium Gratis"
                        value={serviceName}
                        onChange={(e) => setServiceName(e.target.value)}
                        className="h-12 text-base"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="serviceDesc">Descripción (opcional)</Label>
                    <Input
                        id="serviceDesc"
                        placeholder="Ej: Incluye encerado y aspirado"
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
    const [newLevel, setNewLevel] = useState(client?.nivel || 'partner');
    const { cambiarNivelCliente } = useSupabaseAPI();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await cambiarNivelCliente(client.id, newLevel);
            toast({
                title: "Nivel actualizado",
                description: `${client.nombre} ahora es ${newLevel === 'vip' ? 'VIP' : 'Partner'}`
            });
            onFinished();
        } catch (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

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
    const api = useSupabaseAPI();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [modalState, setModalState] = useState({ type: null, client: null });

    const fetchClients = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.getTodosLosClientes();
            setClientes(data.sort((a,b) => b.puntos_actuales - a.puntos_actuales));
        } catch (error) {
            console.error("Failed to fetch clients", error);
            toast({ title: "Error", description: "No se pudieron cargar los clientes.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [api, toast]);

    useEffect(() => {
        fetchClients();
    }, [fetchClients]);

    const filteredClientes = useMemo(() => {
        if (!searchTerm) return clientes;
        return clientes.filter(c =>
            c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.telefono.includes(searchTerm)
        );
    }, [searchTerm, clientes]);

    const handleModalClose = () => {
        setModalState({ type: null, client: null });
        fetchClients();
    };

    const getNivelBadge = (nivel) => {
        if (nivel === 'vip') {
            return <Badge className="bg-amber-500 hover:bg-amber-600"><Crown className="w-3 h-3 mr-1" />VIP</Badge>;
        }
        return <Badge className="bg-purple-500 hover:bg-purple-600">Partner</Badge>;
    };

    return (
        <>
            <Helmet>
                <title>Gestión de Clientes - Admin Manny</title>
            </Helmet>
            <div className="container mx-auto px-4 py-8">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div className="flex items-center gap-3">
                        <Users className="w-8 h-8 text-primary" />
                        <h1 className="text-3xl md:text-4xl">Gestión de Clientes</h1>
                    </div>
                    <Button variant="investment" onClick={() => setModalState({ type: 'create', client: null })}>
                        <PlusCircle className="w-4 h-4 mr-2" />
                        Crear Cliente
                    </Button>
                </motion.div>

                <div className="mb-6 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nombre o teléfono..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-12 h-12 text-lg bg-card border-2 border-input rounded-xl"
                    />
                </div>

                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <Loader2 className="w-12 h-12 animate-spin text-primary" />
                    </div>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="bg-card rounded-2xl shadow-xl overflow-hidden hidden md:block">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-muted/50">
                                        <tr>
                                            <th className="p-4 font-bold text-foreground">Cliente</th>
                                            <th className="p-4 font-bold text-foreground text-right">Puntos</th>
                                            <th className="p-4 font-bold text-foreground text-center">Acciones Rápidas</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredClientes.map(cliente => (
                                            <tr
                                                key={cliente.id}
                                                onClick={() => navigate(`/admin/clientes/${cliente.id}`)}
                                                className="border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors cursor-pointer"
                                            >
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${cliente.nivel === 'vip' ? 'bg-amber-500/20 text-amber-600' : 'bg-purple-500/20 text-purple-600'}`}>
                                                            <span className="font-bold">{cliente.nombre.charAt(0).toUpperCase()}</span>
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium text-foreground">{cliente.nombre}</span>
                                                                {cliente.nivel === 'vip' && <Crown className="w-4 h-4 text-amber-500" />}
                                                            </div>
                                                            <span className="text-sm text-muted-foreground">{cliente.telefono}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <span className="font-bold text-primary text-lg">{cliente.puntos_actuales.toLocaleString()}</span>
                                                </td>
                                                <td className="p-4" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex justify-center items-center gap-1">
                                                        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setModalState({ type: 'assign', client: cliente })} title="Asignar puntos">
                                                            <PlusCircle className="w-4 h-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setModalState({ type: 'service', client: cliente })} title="Asignar beneficio">
                                                            <Gift className="w-4 h-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setModalState({ type: 'edit', client: cliente })} title="Editar cliente">
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
                            {filteredClientes.map(cliente => (
                                <Link
                                    key={cliente.id}
                                    to={`/admin/clientes/${cliente.id}`}
                                    className="block"
                                >
                                    <div className="bg-card p-4 rounded-xl border border-border active:bg-muted/50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            {/* Avatar con inicial */}
                                            <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${cliente.nivel === 'vip' ? 'bg-amber-500/20 text-amber-600' : 'bg-purple-500/20 text-purple-600'}`}>
                                                <span className="font-bold text-lg">{cliente.nombre.charAt(0).toUpperCase()}</span>
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-semibold text-foreground truncate">{cliente.nombre}</p>
                                                    {cliente.nivel === 'vip' && (
                                                        <Crown className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground">{cliente.telefono}</p>
                                            </div>

                                            {/* Puntos y flecha */}
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <span className="font-bold text-primary">{cliente.puntos_actuales}</span>
                                                <ChevronRight className="w-5 h-5 text-muted-foreground" />
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
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
