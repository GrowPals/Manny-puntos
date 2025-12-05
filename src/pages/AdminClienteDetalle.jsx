
import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ArrowLeft, User, Phone, Coins, Crown, Calendar, Gift, History,
    PlusCircle, Trash2, Loader2, Package, Wrench, CheckCircle,
    Hourglass, PackageCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useSupabaseAPI } from '@/context/SupabaseContext';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const AdminClienteDetalle = () => {
    const { clienteId } = useParams();
    const api = useSupabaseAPI();
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [cliente, setCliente] = useState(null);
    const [canjes, setCanjes] = useState([]);
    const [historialPuntos, setHistorialPuntos] = useState([]);
    const [serviciosAsignados, setServiciosAsignados] = useState([]);
    const [activeTab, setActiveTab] = useState('canjes');

    // Modal states
    const [showPointsModal, setShowPointsModal] = useState(false);
    const [showServiceModal, setShowServiceModal] = useState(false);
    const [showLevelModal, setShowLevelModal] = useState(false);
    const [deleteService, setDeleteService] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.getClienteDetalleAdmin(clienteId);
            setCliente(data.cliente);
            setCanjes(data.canjes);
            setHistorialPuntos(data.historialPuntos);
            setServiciosAsignados(data.serviciosAsignados);
        } catch (error) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [clienteId, api, toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const getEstadoInfo = (estado) => {
        const statuses = {
            'pendiente_entrega': { text: 'Pendiente', icon: <Hourglass className="w-3 h-3" />, color: 'bg-yellow-500/10 text-yellow-600' },
            'entregado': { text: 'Entregado', icon: <PackageCheck className="w-3 h-3" />, color: 'bg-green-500/10 text-green-600' },
            'en_lista': { text: 'En Lista', icon: <Hourglass className="w-3 h-3" />, color: 'bg-blue-500/10 text-blue-600' },
            'agendado': { text: 'Agendado', icon: <Calendar className="w-3 h-3" />, color: 'bg-purple-500/10 text-purple-600' },
            'completado': { text: 'Completado', icon: <CheckCircle className="w-3 h-3" />, color: 'bg-green-500/10 text-green-600' },
        };
        return statuses[estado] || { text: estado, icon: <Hourglass className="w-3 h-3" />, color: 'bg-muted text-muted-foreground' };
    };

    const handleDeleteService = async () => {
        if (!deleteService) return;
        try {
            await api.eliminarServicioAsignado(deleteService.id);
            toast({ title: 'Beneficio eliminado' });
            setDeleteService(null);
            fetchData();
        } catch (error) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
            </div>
        );
    }

    if (!cliente) {
        return (
            <div className="container mx-auto px-4 py-8 text-center">
                <p className="text-muted-foreground">Cliente no encontrado.</p>
                <Link to="/admin/clientes">
                    <Button variant="outline" className="mt-4">Volver a Clientes</Button>
                </Link>
            </div>
        );
    }

    return (
        <>
            <Helmet>
                <title>{cliente.nombre} - Admin Manny</title>
            </Helmet>

            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <Link to="/admin/clientes" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6">
                    <ArrowLeft size={16} />
                    Volver a Clientes
                </Link>

                {/* Cliente Info Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card rounded-2xl shadow-xl p-6 mb-8 border border-border"
                >
                    <div className="flex flex-col lg:flex-row justify-between gap-6">
                        <div className="flex items-start gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 flex-wrap">
                                    <h1 className="text-2xl md:text-3xl font-bold text-foreground">{cliente.nombre}</h1>
                                    <Badge className={cliente.nivel === 'vip' ? 'bg-amber-500' : 'bg-purple-500'}>
                                        {cliente.nivel === 'vip' ? <><Crown className="w-3 h-3 mr-1" />VIP</> : 'Partner'}
                                    </Badge>
                                    {cliente.es_admin && <Badge variant="outline">Admin</Badge>}
                                </div>
                                <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                                    <Phone className="w-4 h-4" />
                                    <span>{cliente.telefono}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-muted-foreground text-sm">
                                    <Calendar className="w-4 h-4" />
                                    <span>Registrado el {new Date(cliente.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                </div>
                            </div>
                            {/* Icon on the right for mobile, hidden on desktop */}
                            <div className="bg-primary/10 p-4 rounded-xl flex-shrink-0 lg:hidden">
                                <User className="w-10 h-10 text-primary" />
                            </div>
                        </div>

                        <div className="flex flex-col items-start lg:items-end gap-4">
                            <div className="bg-primary/10 rounded-xl px-6 py-4 text-center">
                                <div className="flex items-center gap-2 text-primary mb-1">
                                    <Coins className="w-5 h-5" />
                                    <span className="text-sm font-medium">Puntos Actuales</span>
                                </div>
                                <p className="text-4xl font-black text-primary">{cliente.puntos_actuales?.toLocaleString('es-MX') || 0}</p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Button size="sm" variant="outline" onClick={() => setShowPointsModal(true)}>
                                    <PlusCircle className="w-4 h-4 mr-1" />
                                    Puntos
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setShowServiceModal(true)}>
                                    <Gift className="w-4 h-4 mr-1" />
                                    Beneficio
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setShowLevelModal(true)}>
                                    <Crown className="w-4 h-4 mr-1" />
                                    Nivel
                                </Button>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Tabs */}
                <div className="flex border-b border-border mb-6">
                    <button
                        onClick={() => setActiveTab('canjes')}
                        className={`flex-1 sm:flex-none px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold transition-colors ${activeTab === 'canjes' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}
                    >
                        <Package className="w-4 h-4 inline mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Canjes</span> ({canjes.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('puntos')}
                        className={`flex-1 sm:flex-none px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold transition-colors ${activeTab === 'puntos' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}
                    >
                        <Coins className="w-4 h-4 inline mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Puntos</span> ({historialPuntos.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('servicios')}
                        className={`flex-1 sm:flex-none px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold transition-colors ${activeTab === 'servicios' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}
                    >
                        <Gift className="w-4 h-4 inline mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Beneficios</span> ({serviciosAsignados.length})
                    </button>
                </div>

                {/* Tab Content */}
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    {/* Canjes Tab */}
                    {activeTab === 'canjes' && (
                        <div className="space-y-3">
                            {canjes.length > 0 ? canjes.map((canje) => {
                                const estadoInfo = getEstadoInfo(canje.estado);
                                const isService = canje.tipo === 'servicio';
                                return (
                                    <div key={canje.id} className="bg-card rounded-xl p-4 border border-border">
                                        <div className="flex items-start gap-3">
                                            {/* Icon */}
                                            <div className={`p-2.5 rounded-lg flex-shrink-0 ${isService ? 'bg-emerald-500/10' : 'bg-sky-500/10'}`}>
                                                {isService ? <Wrench className="w-5 h-5 text-emerald-600" /> : <Package className="w-5 h-5 text-sky-600" />}
                                            </div>
                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-foreground truncate">{canje.producto_nombre}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {new Date(canje.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </p>
                                            </div>
                                            {/* Puntos */}
                                            <span className="font-mono font-bold text-red-500 flex-shrink-0">-{canje.puntos_usados}</span>
                                        </div>
                                        {/* Status */}
                                        <div className="mt-3 pt-3 border-t border-border/50">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${estadoInfo.color}`}>
                                                {estadoInfo.icon}
                                                {estadoInfo.text}
                                            </span>
                                        </div>
                                    </div>
                                );
                            }) : (
                                <div className="text-center py-12 bg-card rounded-xl border border-border">
                                    <Package className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                                    <p className="text-muted-foreground">Este cliente no ha realizado canjes.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Historial Puntos Tab */}
                    {activeTab === 'puntos' && (
                        <div className="space-y-3">
                            {historialPuntos.length > 0 ? historialPuntos.map((item) => {
                                const isPositive = item.puntos >= 0;
                                return (
                                    <div key={item.id} className="bg-card rounded-xl p-4 border border-border">
                                        <div className="flex items-start gap-3">
                                            {/* Icon */}
                                            <div className={`p-2.5 rounded-lg flex-shrink-0 ${isPositive ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                                                <Coins className={`w-5 h-5 ${isPositive ? 'text-green-600' : 'text-red-500'}`} />
                                            </div>
                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-foreground truncate">{item.concepto}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {new Date(item.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </p>
                                            </div>
                                            {/* Puntos */}
                                            <span className={`font-mono font-bold flex-shrink-0 ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                                                {isPositive ? '+' : ''}{item.puntos}
                                            </span>
                                        </div>
                                    </div>
                                );
                            }) : (
                                <div className="text-center py-12 bg-card rounded-xl border border-border">
                                    <History className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                                    <p className="text-muted-foreground">No hay movimientos de puntos registrados.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Servicios Asignados Tab */}
                    {activeTab === 'servicios' && (
                        <div className="space-y-3">
                            {serviciosAsignados.length > 0 ? serviciosAsignados.map((servicio) => {
                                const isAvailable = servicio.estado === 'disponible';
                                return (
                                    <div key={servicio.id} className="bg-card rounded-xl p-4 border border-border">
                                        <div className="flex items-start gap-3">
                                            {/* Icon */}
                                            <div className={`p-2.5 rounded-lg flex-shrink-0 ${isAvailable ? 'bg-primary/10' : 'bg-muted'}`}>
                                                <Gift className={`w-5 h-5 ${isAvailable ? 'text-primary' : 'text-muted-foreground'}`} />
                                            </div>
                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-foreground truncate">{servicio.nombre}</p>
                                                {servicio.descripcion && <p className="text-sm text-muted-foreground truncate">{servicio.descripcion}</p>}
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {new Date(servicio.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                                                </p>
                                            </div>
                                            {/* Actions */}
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${isAvailable ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                                                    {isAvailable ? 'Activo' : 'Usado'}
                                                </span>
                                                {isAvailable && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteService(servicio)}>
                                                        <Trash2 className="w-4 h-4 text-destructive" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            }) : (
                                <div className="text-center py-12 bg-card rounded-xl border border-border">
                                    <Gift className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                                    <p className="text-muted-foreground">No hay beneficios asignados.</p>
                                    <Button variant="outline" className="mt-4" onClick={() => setShowServiceModal(true)}>
                                        <PlusCircle className="w-4 h-4 mr-2" />
                                        Asignar Beneficio
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </motion.div>
            </div>

            {/* Modal: Asignar Puntos */}
            <AssignPointsModal
                open={showPointsModal}
                onClose={() => setShowPointsModal(false)}
                cliente={cliente}
                onSuccess={fetchData}
            />

            {/* Modal: Asignar Servicio */}
            <AssignServiceModal
                open={showServiceModal}
                onClose={() => setShowServiceModal(false)}
                cliente={cliente}
                onSuccess={fetchData}
            />

            {/* Modal: Cambiar Nivel */}
            <ChangeLevelModal
                open={showLevelModal}
                onClose={() => setShowLevelModal(false)}
                cliente={cliente}
                onSuccess={fetchData}
            />

            {/* Modal: Confirmar Eliminar Servicio */}
            <Dialog open={!!deleteService} onOpenChange={() => setDeleteService(null)}>
                <DialogContent className="bg-card border-border">
                    <DialogHeader>
                        <DialogTitle>Eliminar Beneficio</DialogTitle>
                        <DialogDescription>
                            ¿Eliminar "{deleteService?.nombre}" de {cliente.nombre}?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Cancelar</Button>
                        </DialogClose>
                        <Button variant="destructive" onClick={handleDeleteService}>Eliminar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

// Sub-components for modals
const AssignPointsModal = ({ open, onClose, cliente, onSuccess }) => {
    const [points, setPoints] = useState('');
    const [concept, setConcept] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { asignarPuntosManualmente } = useSupabaseAPI();
    const { toast } = useToast();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!points || !concept.trim()) {
            toast({ title: 'Completa todos los campos', variant: 'destructive' });
            return;
        }
        setIsSubmitting(true);
        try {
            await asignarPuntosManualmente(cliente.telefono, parseInt(points), concept);
            toast({ title: `${points} puntos asignados a ${cliente.nombre}` });
            setPoints('');
            setConcept('');
            onClose();
            onSuccess();
        } catch (error) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="bg-card border-border">
                <DialogHeader>
                    <DialogTitle>Asignar Puntos a {cliente?.nombre}</DialogTitle>
                    <DialogDescription>Usa números negativos para restar puntos.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Puntos</Label>
                        <Input type="number" placeholder="Ej: 50 o -20" value={points} onChange={(e) => setPoints(e.target.value)} className="h-12" />
                    </div>
                    <div className="space-y-2">
                        <Label>Concepto</Label>
                        <Input placeholder="Ej: Bono por referido" value={concept} onChange={(e) => setConcept(e.target.value)} className="h-12" />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
                        <Button type="submit" variant="investment" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Asignar
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

const AssignServiceModal = ({ open, onClose, cliente, onSuccess }) => {
    const [name, setName] = useState('');
    const [desc, setDesc] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { crearServicioAsignado } = useSupabaseAPI();
    const { toast } = useToast();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            toast({ title: 'El nombre es requerido', variant: 'destructive' });
            return;
        }
        setIsSubmitting(true);
        try {
            await crearServicioAsignado({ cliente_id: cliente.id, nombre: name, descripcion: desc });
            toast({ title: `Beneficio asignado a ${cliente.nombre}` });
            setName('');
            setDesc('');
            onClose();
            onSuccess();
        } catch (error) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="bg-card border-border">
                <DialogHeader>
                    <DialogTitle>Asignar Beneficio a {cliente?.nombre}</DialogTitle>
                    <DialogDescription>Crea un beneficio exclusivo que el cliente podrá usar.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Nombre del Beneficio</Label>
                        <Input placeholder="Ej: Lavado Premium Gratis" value={name} onChange={(e) => setName(e.target.value)} className="h-12" />
                    </div>
                    <div className="space-y-2">
                        <Label>Descripción (opcional)</Label>
                        <Input placeholder="Ej: Incluye encerado" value={desc} onChange={(e) => setDesc(e.target.value)} className="h-12" />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
                        <Button type="submit" variant="investment" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Asignar
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

const ChangeLevelModal = ({ open, onClose, cliente, onSuccess }) => {
    const [level, setLevel] = useState(cliente?.nivel || 'partner');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { cambiarNivelCliente } = useSupabaseAPI();
    const { toast } = useToast();

    useEffect(() => {
        if (cliente) setLevel(cliente.nivel || 'partner');
    }, [cliente]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (level === cliente?.nivel) {
            onClose();
            return;
        }
        setIsSubmitting(true);
        try {
            await cambiarNivelCliente(cliente.id, level);
            toast({ title: `${cliente.nombre} ahora es ${level === 'vip' ? 'VIP' : 'Partner'}` });
            onClose();
            onSuccess();
        } catch (error) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="bg-card border-border">
                <DialogHeader>
                    <DialogTitle>Cambiar Nivel de {cliente?.nombre}</DialogTitle>
                    <DialogDescription>Selecciona el nuevo nivel para este cliente.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Nivel Actual</Label>
                        <Badge className={cliente?.nivel === 'vip' ? 'bg-amber-500' : 'bg-purple-500'}>
                            {cliente?.nivel === 'vip' ? 'VIP' : 'Partner'}
                        </Badge>
                    </div>
                    <div className="space-y-2">
                        <Label>Nuevo Nivel</Label>
                        <Select value={level} onValueChange={setLevel}>
                            <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="partner">Partner</SelectItem>
                                <SelectItem value="vip">VIP</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
                        <Button type="submit" variant="investment" disabled={isSubmitting || level === cliente?.nivel}>
                            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Confirmar
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default AdminClienteDetalle;
