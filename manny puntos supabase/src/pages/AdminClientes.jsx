import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Users, Search, PlusCircle, Edit, Loader2 } from 'lucide-react';
import { useSupabaseAPI } from '@/context/SupabaseContext';
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

const sanitizeInput = (value, maxLength = 255) => {
    if (typeof value !== 'string') return value;
    return value.trim().slice(0, maxLength).replace(/[<>]/g, '');
};

const ClientForm = ({ client, onFinished }) => {
    const [formData, setFormData] = useState(
        client || { nombre: '', telefono: '', puntos_actuales: 0 }
    );
    const api = useSupabaseAPI();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleSanitizedChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: sanitizeInput(value) }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (!formData.nombre?.trim()) {
                toast({ title: 'Error de validación', description: 'El nombre es requerido.', variant: 'destructive' });
                return;
            }
            if (!/^\d{10}$/.test(formData.telefono)) {
                toast({ title: 'Error de validación', description: 'El teléfono debe tener 10 dígitos.', variant: 'destructive' });
                return;
            }
            await api.crearOActualizarCliente({
                ...formData,
                puntos_actuales: Number(formData.puntos_actuales) || 0,
            });
            toast({ title: client ? 'Cliente actualizado' : 'Cliente creado' });
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
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre</Label>
                    <Input id="nombre" name="nombre" value={formData.nombre} onChange={handleSanitizedChange} placeholder="Nombre completo" required className="h-12 text-base" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="telefono">Teléfono (10 dígitos)</Label>
                    <Input id="telefono" name="telefono" type="tel" pattern="\d{10}" maxLength="10" value={formData.telefono} onChange={handleChange} placeholder="4771234567" required className="h-12 text-base" disabled={!!client} />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="puntos_actuales">Puntos Iniciales</Label>
                    <Input id="puntos_actuales" name="puntos_actuales" type="number" value={formData.puntos_actuales} onChange={handleChange} placeholder="0" required className="h-12 text-base" />
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
    const api = useSupabaseAPI();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAssignPoints = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (!client || !pointsToAdd || !concept.trim()) {
                toast({ title: "Datos incompletos", description: "Completa todos los campos.", variant: "destructive" });
                return;
            }

            const points = parseInt(pointsToAdd, 10);
            if (isNaN(points)) {
                 toast({ title: "Dato inválido", description: "La cantidad de puntos debe ser un número.", variant: "destructive" });
                 return;
            }

            await api.asignarPuntosManualmente(client.telefono, points, concept);
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
                    <Input id="concepto" placeholder="Ej: 'Bono especial'" value={concept} onChange={(e) => setConcept(sanitizeInput(e.target.value))} className="h-12 text-lg" />
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

const AdminClientes = () => {
    const api = useSupabaseAPI();
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [modalState, setModalState] = useState({ type: null, client: null }); // type: 'edit', 'create', 'assign'

    const fetchClients = useCallback(async () => {
        if (!api) return;
        try {
            setLoading(true);
            const data = await api.getTodosLosClientes();
            setClientes(data.sort((a,b) => (b.puntos_actuales || 0) - (a.puntos_actuales || 0)));
        } catch (error) {
            console.error("Failed to fetch clients", error);
        } finally {
            setLoading(false);
        }
    }, [api]);

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
                    <div className="bg-card rounded-2xl shadow-xl overflow-hidden md:block hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="p-4 font-bold text-foreground">Nombre</th>
                                        <th className="p-4 font-bold text-foreground">Teléfono</th>
                                        <th className="p-4 font-bold text-foreground text-right">Puntos</th>
                                        <th className="p-4 font-bold text-foreground text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredClientes.map(cliente => (
                                        <tr key={cliente.id} className="border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors">
                                            <td className="p-4 text-foreground font-medium">{cliente.nombre}</td>
                                            <td className="p-4 text-muted-foreground">{cliente.telefono}</td>
                                            <td className="p-4 text-primary font-bold text-right">{cliente.puntos_actuales}</td>
                                            <td className="p-4 text-center flex justify-center items-center gap-2">
                                                <Button variant="ghost" size="sm" onClick={() => setModalState({ type: 'assign', client: cliente })}>
                                                    <PlusCircle className="w-4 h-4 mr-2" />
                                                    Asignar
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => setModalState({ type: 'edit', client: cliente })}>
                                                    <Edit className="w-4 h-4 mr-2" />
                                                    Editar
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                 {/* Mobile View */}
                 <div className="md:hidden space-y-4">
                    {loading ? (
                        <div className="flex justify-center items-center py-20">
                            <Loader2 className="w-12 h-12 animate-spin text-primary" />
                        </div>
                    ) : (
                        filteredClientes.map(cliente => (
                            <div key={cliente.id} className="bg-card p-4 rounded-xl shadow-lg">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-lg text-foreground">{cliente.nombre}</p>
                                        <p className="text-sm text-muted-foreground">{cliente.telefono}</p>
                                    </div>
                                    <p className="font-black text-lg text-primary">{cliente.puntos_actuales} pts</p>
                                </div>
                                <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border">
                                    <Button variant="ghost" size="sm" onClick={() => setModalState({ type: 'assign', client: cliente })}>
                                        <PlusCircle className="w-4 h-4 mr-2" />
                                        Asignar
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => setModalState({ type: 'edit', client: cliente })}>
                                        <Edit className="w-4 h-4 mr-2" />
                                        Editar
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                 </div>
            </div>

            <Dialog open={!!modalState.type} onOpenChange={() => setModalState({ type: null, client: null })}>
                {modalState.type === 'create' && <ClientForm onFinished={handleModalClose} />}
                {modalState.type === 'edit' && <ClientForm client={modalState.client} onFinished={handleModalClose} />}
                {modalState.type === 'assign' && <AssignPointsForm client={modalState.client} onFinished={handleModalClose} />}
            </Dialog>
        </>
    );
};

export default AdminClientes;