import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import {
    Gift,
    Loader2,
    Plus,
    Copy,
    CheckCircle2,
    Clock,
    XCircle,
    Trash2,
    Eye,
    ExternalLink,
    Coins,
    Wrench,
    RefreshCw,
    Share2,
    Users,
    Megaphone,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useToast } from '@/components/ui/use-toast';
import { VALIDATION } from '@/config';
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

const AdminRegalos = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showDetailsDialog, setShowDetailsDialog] = useState(false);
    const [showBeneficiariosDialog, setShowBeneficiariosDialog] = useState(false);
    const [selectedLink, setSelectedLink] = useState(null);
    const [copiedId, setCopiedId] = useState(null);
    const [expandedLinkId, setExpandedLinkId] = useState(null);

    // Form state para crear
    const [newLink, setNewLink] = useState({
        tipo: 'servicio',
        nombre_beneficio: '',
        descripcion_beneficio: '',
        puntos_regalo: 100,
        mensaje_personalizado: '',
        destinatario_telefono: '',
        dias_expiracion: 30,
        // Campos de campaña
        es_campana: false,
        nombre_campana: '',
        max_canjes: 100,
        terminos_condiciones: '',
        instrucciones_uso: '',
        vigencia_beneficio: 365,
        imagen_banner: '',
        color_tema: '#E91E63'
    });

    // Beneficiarios de campaña seleccionada
    const [beneficiarios, setBeneficiarios] = useState([]);
    const [loadingBeneficiarios, setLoadingBeneficiarios] = useState(false);

    // Stats
    const { data: stats = {}, isLoading: loadingStats } = useQuery({
        queryKey: ['admin-regalos-stats'],
        queryFn: api.gifts.getGiftStats,
    });

    // Lista de links
    const { data: links = [], isLoading: loadingLinks, refetch: refetchLinks } = useQuery({
        queryKey: ['admin-regalos-list'],
        queryFn: api.gifts.getAllGiftLinks,
    });

    const loading = loadingStats || loadingLinks;

    // Crear link
    const createMutation = useMutation({
        mutationFn: (data) => api.gifts.createGiftLink({
            ...data,
            creado_por: null // El backend debe asignar el admin actual
        }),
        onSuccess: (data) => {
            toast({
                title: "Link creado",
                description: `Código: ${data.codigo}`,
            });
            queryClient.invalidateQueries(['admin-regalos-list']);
            queryClient.invalidateQueries(['admin-regalos-stats']);
            setShowCreateDialog(false);
            resetForm();

            // Mostrar link creado
            setSelectedLink({
                ...newLink,
                codigo: data.codigo,
                url: data.url
            });
            setShowDetailsDialog(true);
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive"
            });
        }
    });

    // Expirar link
    const expireMutation = useMutation({
        mutationFn: api.gifts.expireGiftLink,
        onSuccess: () => {
            toast({ title: "Link expirado" });
            queryClient.invalidateQueries(['admin-regalos-list']);
            queryClient.invalidateQueries(['admin-regalos-stats']);
        },
        onError: (error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    // Eliminar link
    const deleteMutation = useMutation({
        mutationFn: api.gifts.deleteGiftLink,
        onSuccess: () => {
            toast({ title: "Link eliminado" });
            queryClient.invalidateQueries(['admin-regalos-list']);
            queryClient.invalidateQueries(['admin-regalos-stats']);
        },
        onError: (error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    const resetForm = () => {
        setNewLink({
            tipo: 'servicio',
            nombre_beneficio: '',
            descripcion_beneficio: '',
            puntos_regalo: 100,
            mensaje_personalizado: '',
            destinatario_telefono: '',
            dias_expiracion: 30,
            es_campana: false,
            nombre_campana: '',
            max_canjes: 100,
            terminos_condiciones: '',
            instrucciones_uso: '',
            vigencia_beneficio: 365,
            imagen_banner: '',
            color_tema: '#E91E63'
        });
    };

    // Cargar beneficiarios de una campaña
    const handleLoadBeneficiarios = async (link) => {
        setSelectedLink(link);
        setLoadingBeneficiarios(true);
        setShowBeneficiariosDialog(true);
        try {
            const data = await api.gifts.getLinkBeneficiarios(link.id);
            setBeneficiarios(data);
        } catch (error) {
            toast({
                title: "Error",
                description: "No se pudieron cargar los beneficiarios",
                variant: "destructive"
            });
        } finally {
            setLoadingBeneficiarios(false);
        }
    };

    const handleCreate = () => {
        // Validaciones según tipo
        if (newLink.tipo === 'servicio' && !newLink.nombre_beneficio.trim()) {
            toast({
                title: "Error",
                description: "Ingresa el nombre del servicio/beneficio",
                variant: "destructive"
            });
            return;
        }
        if (newLink.tipo === 'puntos' && (!newLink.puntos_regalo || newLink.puntos_regalo < 1)) {
            toast({
                title: "Error",
                description: "Ingresa una cantidad de puntos válida",
                variant: "destructive"
            });
            return;
        }

        // Validaciones para campañas
        if (newLink.es_campana) {
            if (!newLink.nombre_campana.trim()) {
                toast({
                    title: "Error",
                    description: "Ingresa un nombre para la campaña",
                    variant: "destructive"
                });
                return;
            }
            if (!newLink.max_canjes || newLink.max_canjes < 1) {
                toast({
                    title: "Error",
                    description: "Ingresa el número máximo de participantes",
                    variant: "destructive"
                });
                return;
            }
        }

        createMutation.mutate(newLink);
    };

    const handleCopyLink = async (link) => {
        const url = `${window.location.origin}/g/${link.codigo}`;
        try {
            await navigator.clipboard.writeText(url);
            setCopiedId(link.id);
            toast({ title: "Link copiado" });
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            toast({ title: "Error al copiar", variant: "destructive" });
        }
    };

    const handleShareWhatsApp = (link) => {
        const url = `${window.location.origin}/g/${link.codigo}`;
        const message = link.mensaje_personalizado
            ? `${link.mensaje_personalizado}\n\n${url}`
            : `Te envío un regalo de Manny Rewards.\n\n${url}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    };

    const handleExpire = (linkId) => {
        if (!confirm('¿Expirar este link? Ya no podrá ser canjeado.')) return;
        expireMutation.mutate(linkId);
    };

    const handleDelete = (linkId) => {
        if (!confirm('¿Eliminar este link permanentemente?')) return;
        deleteMutation.mutate(linkId);
    };

    const getEstadoBadge = (estado, esCampana = false, canjesRealizados = 0, maxCanjes = 0) => {
        const badges = {
            pendiente: { color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', icon: Clock, label: 'Activo' },
            canjeado: { color: 'bg-green-500/10 text-green-500 border-green-500/20', icon: CheckCircle2, label: 'Canjeado' },
            expirado: { color: 'bg-red-500/10 text-red-500 border-red-500/20', icon: XCircle, label: 'Expirado' },
            agotado: { color: 'bg-orange-500/10 text-orange-500 border-orange-500/20', icon: Users, label: 'Agotado' },
        };
        const badge = badges[estado] || badges.pendiente;
        const Icon = badge.icon;

        // Para campañas activas, mostrar progreso
        if (esCampana && estado === 'pendiente' && maxCanjes) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-blue-500/10 text-blue-500 border-blue-500/20">
                    <Users className="w-3 h-3" />
                    {canjesRealizados}/{maxCanjes}
                </span>
            );
        }

        return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${badge.color}`}>
                <Icon className="w-3 h-3" />
                {badge.label}
            </span>
        );
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('es-MX', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 className="animate-spin h-8 w-8 text-primary" />
            </div>
        );
    }

    return (
        <>
            <Helmet>
                <title>Links de Regalo - Admin Manny</title>
            </Helmet>

            {/* Dialog de crear */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent className="bg-card border-border text-foreground sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold">Nuevo Link de Regalo</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Tipo toggle compacto */}
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setNewLink({ ...newLink, es_campana: false })}
                                className={`p-3 rounded-xl border-2 transition-all text-center ${
                                    !newLink.es_campana
                                        ? 'border-primary bg-primary/5'
                                        : 'border-border hover:border-primary/50'
                                }`}
                            >
                                <Gift className={`w-5 h-5 mx-auto mb-1 ${!newLink.es_campana ? 'text-primary' : 'text-muted-foreground'}`} />
                                <p className="font-medium text-sm">Link único</p>
                            </button>
                            <button
                                type="button"
                                onClick={() => setNewLink({ ...newLink, es_campana: true })}
                                className={`p-3 rounded-xl border-2 transition-all text-center ${
                                    newLink.es_campana
                                        ? 'border-primary bg-primary/5'
                                        : 'border-border hover:border-primary/50'
                                }`}
                            >
                                <Megaphone className={`w-5 h-5 mx-auto mb-1 ${newLink.es_campana ? 'text-primary' : 'text-muted-foreground'}`} />
                                <p className="font-medium text-sm">Campaña</p>
                            </button>
                        </div>

                        {/* Nombre campaña */}
                        {newLink.es_campana && (
                            <Input
                                value={newLink.nombre_campana}
                                onChange={(e) => setNewLink({ ...newLink, nombre_campana: e.target.value })}
                                placeholder="Nombre de la campaña *"
                            />
                        )}

                        {/* Tipo de regalo - inline */}
                        <div className="flex items-center gap-2 p-1 bg-muted/50 rounded-lg">
                            <button
                                type="button"
                                onClick={() => setNewLink({ ...newLink, tipo: 'servicio' })}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                                    newLink.tipo === 'servicio'
                                        ? 'bg-background shadow-sm text-foreground'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <Wrench className="w-4 h-4" />
                                Servicio
                            </button>
                            <button
                                type="button"
                                onClick={() => setNewLink({ ...newLink, tipo: 'puntos' })}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                                    newLink.tipo === 'puntos'
                                        ? 'bg-background shadow-sm text-foreground'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <Coins className="w-4 h-4" />
                                Puntos
                            </button>
                        </div>

                        {/* Campos según tipo */}
                        {newLink.tipo === 'servicio' ? (
                            <Input
                                value={newLink.nombre_beneficio}
                                onChange={(e) => setNewLink({ ...newLink, nombre_beneficio: e.target.value })}
                                placeholder="Nombre del servicio *"
                            />
                        ) : (
                            <div className="space-y-2">
                                <Input
                                    type="number"
                                    value={newLink.puntos_regalo}
                                    onChange={(e) => setNewLink({ ...newLink, puntos_regalo: parseInt(e.target.value) || 0 })}
                                    placeholder="Cantidad de puntos *"
                                    min={1}
                                />
                                <div className="flex gap-1.5">
                                    {[50, 100, 200, 500].map(pts => (
                                        <Button
                                            key={pts}
                                            type="button"
                                            size="sm"
                                            variant={newLink.puntos_regalo === pts ? 'default' : 'outline'}
                                            onClick={() => setNewLink({ ...newLink, puntos_regalo: pts })}
                                            className="flex-1 h-8"
                                        >
                                            {pts}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Vigencia - siempre visible, compacto */}
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground whitespace-nowrap">Vigencia:</span>
                            <div className="flex gap-1.5 flex-1">
                                {[7, 30, 90].map(dias => (
                                    <Button
                                        key={dias}
                                        type="button"
                                        size="sm"
                                        variant={newLink.dias_expiracion === dias ? 'default' : 'outline'}
                                        onClick={() => setNewLink({ ...newLink, dias_expiracion: dias })}
                                        className="flex-1 h-8"
                                    >
                                        {dias} días
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Sección colapsable de opciones avanzadas */}
                        <details className="group">
                            <summary className="flex items-center justify-between cursor-pointer py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors list-none">
                                <span className="flex items-center gap-2">
                                    <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                                    Opciones avanzadas
                                </span>
                            </summary>
                            <div className="space-y-3 pt-3 border-t border-border mt-2">
                                {/* Teléfono o Max canjes */}
                                {newLink.es_campana ? (
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1 block">Máx. participantes (0 = sin límite)</label>
                                        <Input
                                            type="number"
                                            value={newLink.max_canjes}
                                            onChange={(e) => setNewLink({ ...newLink, max_canjes: parseInt(e.target.value) || 0 })}
                                            placeholder="Sin límite"
                                            min={0}
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1 block">Teléfono destinatario (opcional)</label>
                                        <Input
                                            type="tel"
                                            value={newLink.destinatario_telefono}
                                            onChange={(e) => setNewLink({
                                                ...newLink,
                                                destinatario_telefono: e.target.value.replace(/\D/g, '').slice(0, VALIDATION.PHONE.LENGTH)
                                            })}
                                            placeholder="Cualquiera puede usarlo"
                                            maxLength={VALIDATION.PHONE.LENGTH}
                                        />
                                    </div>
                                )}

                                {/* Descripción para servicios */}
                                {newLink.tipo === 'servicio' && (
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1 block">Descripción</label>
                                        <textarea
                                            value={newLink.descripcion_beneficio}
                                            onChange={(e) => setNewLink({ ...newLink, descripcion_beneficio: e.target.value })}
                                            placeholder="Qué incluye el servicio..."
                                            className="w-full h-16 p-2.5 rounded-lg bg-background border border-border text-foreground resize-none text-sm"
                                        />
                                    </div>
                                )}

                                {/* Mensaje personalizado */}
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1 block">Mensaje personalizado</label>
                                    <textarea
                                        value={newLink.mensaje_personalizado}
                                        onChange={(e) => setNewLink({ ...newLink, mensaje_personalizado: e.target.value })}
                                        placeholder="Un mensaje especial..."
                                        className="w-full h-14 p-2.5 rounded-lg bg-background border border-border text-foreground resize-none text-sm"
                                    />
                                </div>

                                {/* Campos extra para campañas */}
                                {newLink.es_campana && (
                                    <>
                                        <div>
                                            <label className="text-xs text-muted-foreground mb-1 block">Términos y condiciones</label>
                                            <textarea
                                                value={newLink.terminos_condiciones}
                                                onChange={(e) => setNewLink({ ...newLink, terminos_condiciones: e.target.value })}
                                                placeholder="• Condición 1&#10;• Condición 2"
                                                className="w-full h-20 p-2.5 rounded-lg bg-background border border-border text-foreground resize-none text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-muted-foreground mb-1 block">Instrucciones de uso</label>
                                            <Input
                                                value={newLink.instrucciones_uso}
                                                onChange={(e) => setNewLink({ ...newLink, instrucciones_uso: e.target.value })}
                                                placeholder="Cómo usar el beneficio..."
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-muted-foreground mb-1.5 block">Color del tema</label>
                                            <div className="flex gap-2">
                                                {['#E91E63', '#9C27B0', '#2196F3', '#4CAF50', '#FF9800'].map(color => (
                                                    <button
                                                        key={color}
                                                        type="button"
                                                        onClick={() => setNewLink({ ...newLink, color_tema: color })}
                                                        className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                                                            newLink.color_tema === color ? 'border-foreground scale-110' : 'border-transparent'
                                                        }`}
                                                        style={{ backgroundColor: color }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </details>
                    </div>

                    <DialogFooter className="gap-2 mt-2">
                        <DialogClose asChild>
                            <Button variant="outline" size="sm">Cancelar</Button>
                        </DialogClose>
                        <Button
                            onClick={handleCreate}
                            disabled={createMutation.isPending}
                            size="sm"
                        >
                            {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
                            {newLink.es_campana ? 'Crear Campaña' : 'Crear Link'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog de detalles/compartir */}
            <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
                <DialogContent className="bg-card border-border text-foreground">
                    <DialogHeader>
                        <DialogTitle className="text-xl flex items-center gap-2">
                            {selectedLink?.es_campana ? (
                                <Megaphone className="w-5 h-5 text-primary" />
                            ) : (
                                <Gift className="w-5 h-5 text-primary" />
                            )}
                            {selectedLink?.es_campana ? 'Campaña Creada' : 'Link de Regalo Creado'}
                        </DialogTitle>
                    </DialogHeader>

                    {selectedLink && (
                        <div className="space-y-4 py-4">
                            {selectedLink.es_campana && selectedLink.nombre_campana && (
                                <p className="text-center font-medium text-lg">{selectedLink.nombre_campana}</p>
                            )}

                            <div className="bg-primary/5 rounded-xl p-4 border border-primary/20 text-center">
                                <p className="text-xs text-muted-foreground mb-1">Código</p>
                                <p className="text-2xl font-mono font-bold text-primary">
                                    {selectedLink.codigo}
                                </p>
                            </div>

                            <div className="bg-muted/30 rounded-xl p-3">
                                <p className="text-xs text-muted-foreground mb-1">Link completo</p>
                                <p className="text-sm font-mono break-all">
                                    {selectedLink.url || `${window.location.origin}/g/${selectedLink.codigo}`}
                                </p>
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    className="flex-1"
                                    onClick={() => handleCopyLink(selectedLink)}
                                >
                                    <Copy className="w-4 h-4 mr-2" />
                                    Copiar Link
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => handleShareWhatsApp(selectedLink)}
                                >
                                    <Share2 className="w-4 h-4 mr-2" />
                                    WhatsApp
                                </Button>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Cerrar</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog de beneficiarios de campaña */}
            <Dialog open={showBeneficiariosDialog} onOpenChange={setShowBeneficiariosDialog}>
                <DialogContent className="bg-card border-border text-foreground max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl flex items-center gap-2">
                            <Users className="w-5 h-5 text-primary" />
                            Beneficiarios
                        </DialogTitle>
                        {selectedLink && (
                            <DialogDescription>
                                {selectedLink.nombre_campana || selectedLink.nombre_beneficio} - Código: {selectedLink.codigo}
                            </DialogDescription>
                        )}
                    </DialogHeader>

                    <div className="py-4">
                        {loadingBeneficiarios ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="animate-spin w-6 h-6 text-primary" />
                            </div>
                        ) : beneficiarios.length > 0 ? (
                            <div className="space-y-3">
                                {beneficiarios.map((b) => (
                                    <div key={b.id} className="p-3 bg-muted/30 rounded-xl border border-border">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-medium">{b.cliente?.nombre || 'Sin nombre'}</p>
                                                <p className="text-sm text-muted-foreground">{b.cliente?.telefono}</p>
                                            </div>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                b.estado === 'activo'
                                                    ? 'bg-green-500/10 text-green-500'
                                                    : b.estado === 'usado'
                                                    ? 'bg-blue-500/10 text-blue-500'
                                                    : 'bg-red-500/10 text-red-500'
                                            }`}>
                                                {b.estado === 'activo' ? 'Activo' : b.estado === 'usado' ? 'Usado' : 'Expirado'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Canjeado: {formatDate(b.fecha_canje)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                <p>Aún no hay beneficiarios</p>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Cerrar</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6"
            >
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl flex items-center gap-3">
                            <Gift className="w-7 h-7 text-primary" />
                            Links de Regalo
                        </h1>
                        <p className="text-muted-foreground mt-1 text-sm">
                            Crea links que otorgan beneficios automáticamente
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refetchLinks()}
                        >
                            <RefreshCw className="w-4 h-4 mr-1" />
                            Actualizar
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => setShowCreateDialog(true)}
                        >
                            <Plus className="w-4 h-4 mr-1" />
                            Crear Link
                        </Button>
                    </div>
                </div>
            </motion.div>

            {/* Stats Grid - 4 columnas para que sea par en mobile */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                <div className="bg-card rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-3">
                        <Megaphone className="w-5 h-5 text-purple-500" />
                        <div>
                            <p className="text-2xl font-bold">{stats.campanas || 0}</p>
                            <p className="text-xs text-muted-foreground">Campañas</p>
                        </div>
                    </div>
                </div>

                <div className="bg-card rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-3">
                        <Users className="w-5 h-5 text-blue-500" />
                        <div>
                            <p className="text-2xl font-bold">{stats.total_canjes || 0}</p>
                            <p className="text-xs text-muted-foreground">Canjes totales</p>
                        </div>
                    </div>
                </div>

                <div className="bg-card rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        <div>
                            <p className="text-2xl font-bold">{stats.beneficios_activos || 0}</p>
                            <p className="text-xs text-muted-foreground">Beneficios activos</p>
                        </div>
                    </div>
                </div>

                <div className="bg-card rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-3">
                        <Eye className="w-5 h-5 text-amber-500" />
                        <div>
                            <p className="text-2xl font-bold">{stats.total_vistas || 0}</p>
                            <p className="text-xs text-muted-foreground">Vistas totales</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Lista de links */}
            <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
                <div className="p-5 border-b border-border">
                    <h2 className="font-bold text-lg">
                        Todos los Links ({links.length})
                    </h2>
                </div>

                {links.length > 0 ? (
                    <div className="divide-y divide-border">
                        {links.map((link) => (
                            <div key={link.id}>
                                <div
                                    className="p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                                    onClick={() => link.es_campana && setExpandedLinkId(expandedLinkId === link.id ? null : link.id)}
                                >
                                    <div className="flex items-start gap-4">
                                        {/* Icono tipo */}
                                        <div className={`p-2.5 rounded-xl ${
                                            link.es_campana
                                                ? 'bg-purple-500/10'
                                                : link.tipo === 'puntos'
                                                ? 'bg-yellow-500/10'
                                                : 'bg-blue-500/10'
                                        }`}>
                                            {link.es_campana ? (
                                                <Megaphone className="w-5 h-5 text-purple-500" />
                                            ) : link.tipo === 'puntos' ? (
                                                <Coins className="w-5 h-5 text-yellow-500" />
                                            ) : (
                                                <Wrench className="w-5 h-5 text-blue-500" />
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <span className="font-mono font-bold text-primary">
                                                    {link.codigo}
                                                </span>
                                                {link.es_campana && (
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-500 border border-purple-500/20">
                                                        Campaña
                                                    </span>
                                                )}
                                                {getEstadoBadge(link.estado, link.es_campana, link.canjes_realizados, link.max_canjes)}
                                            </div>

                                            <p className="font-medium text-sm truncate">
                                                {link.es_campana && link.nombre_campana
                                                    ? link.nombre_campana
                                                    : link.tipo === 'puntos'
                                                    ? `${link.puntos_regalo?.toLocaleString()} puntos`
                                                    : link.nombre_beneficio
                                                }
                                            </p>

                                            {link.es_campana && link.nombre_beneficio && (
                                                <p className="text-sm text-muted-foreground truncate">
                                                    {link.nombre_beneficio}
                                                </p>
                                            )}

                                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                                                <span>Creado: {formatDate(link.created_at)}</span>
                                                {link.veces_visto > 0 && (
                                                    <span className="flex items-center gap-1">
                                                        <Eye className="w-3 h-3" /> {link.veces_visto}
                                                    </span>
                                                )}
                                                {!link.es_campana && link.destinatario_telefono && (
                                                    <span>Para: {link.destinatario_telefono}</span>
                                                )}
                                                {link.es_campana && (
                                                    <span className="flex items-center gap-1">
                                                        <Users className="w-3 h-3" />
                                                        {link.canjes_realizados || 0} canjes
                                                    </span>
                                                )}
                                            </div>

                                            {!link.es_campana && link.estado === 'canjeado' && link.canjeador && (
                                                <p className="text-xs text-green-600 mt-1">
                                                    Canjeado por: {link.canjeador.nombre} ({link.canjeador.telefono})
                                                </p>
                                            )}
                                        </div>

                                        {/* Acciones */}
                                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                            {/* Ver beneficiarios (campañas) */}
                                            {link.es_campana && link.canjes_realizados > 0 && (
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={() => handleLoadBeneficiarios(link)}
                                                    title="Ver beneficiarios"
                                                >
                                                    <Users className="w-4 h-4" />
                                                </Button>
                                            )}

                                            {(link.estado === 'pendiente' || (link.es_campana && link.estado !== 'expirado' && link.estado !== 'agotado')) && (
                                                <>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() => handleCopyLink(link)}
                                                        title="Copiar link"
                                                    >
                                                        {copiedId === link.id ? (
                                                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                        ) : (
                                                            <Copy className="w-4 h-4" />
                                                        )}
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() => handleShareWhatsApp(link)}
                                                        title="Compartir por WhatsApp"
                                                    >
                                                        <Share2 className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() => window.open(`/g/${link.codigo}`, '_blank')}
                                                        title="Ver página"
                                                    >
                                                        <ExternalLink className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() => handleExpire(link.id)}
                                                        title="Expirar"
                                                        className="text-orange-500 hover:text-orange-600"
                                                    >
                                                        <XCircle className="w-4 h-4" />
                                                    </Button>
                                                </>
                                            )}

                                            {/* Expandir/contraer para campañas */}
                                            {link.es_campana && (
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={() => setExpandedLinkId(expandedLinkId === link.id ? null : link.id)}
                                                >
                                                    {expandedLinkId === link.id ? (
                                                        <ChevronUp className="w-4 h-4" />
                                                    ) : (
                                                        <ChevronDown className="w-4 h-4" />
                                                    )}
                                                </Button>
                                            )}

                                            {link.estado !== 'canjeado' && (!link.es_campana || link.canjes_realizados === 0) && (
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={() => handleDelete(link.id)}
                                                    title="Eliminar"
                                                    className="text-red-500 hover:text-red-600"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Panel expandido para campañas */}
                                {link.es_campana && expandedLinkId === link.id && (
                                    <div className="px-4 pb-4 bg-muted/20">
                                        <div className="p-4 rounded-xl border border-border bg-background space-y-3">
                                            {link.terminos_condiciones && (
                                                <div>
                                                    <p className="text-xs font-medium text-muted-foreground mb-1">Términos y Condiciones:</p>
                                                    <p className="text-sm whitespace-pre-wrap">{link.terminos_condiciones}</p>
                                                </div>
                                            )}
                                            {link.instrucciones_uso && (
                                                <div>
                                                    <p className="text-xs font-medium text-muted-foreground mb-1">Instrucciones de uso:</p>
                                                    <p className="text-sm">{link.instrucciones_uso}</p>
                                                </div>
                                            )}
                                            <div className="flex gap-4 text-xs text-muted-foreground">
                                                <span>Vigencia del beneficio: {link.vigencia_beneficio || 365} días</span>
                                                <span>Max participantes: {link.max_canjes || 'Sin límite'}</span>
                                            </div>
                                            {link.imagen_banner && (
                                                <img
                                                    src={link.imagen_banner}
                                                    alt="Banner"
                                                    className="w-full h-24 object-cover rounded-lg"
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 text-muted-foreground">
                        <Gift className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="text-lg font-medium">Sin links de regalo</p>
                        <p className="text-sm mb-4">
                            Crea un link para regalar servicios o puntos.
                        </p>
                        <Button onClick={() => setShowCreateDialog(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Crear primer link
                        </Button>
                    </div>
                )}
            </div>

            {/* Info footer */}
            <div className="mt-6 p-4 bg-muted/30 rounded-xl border border-border/50">
                <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">¿Cómo funciona?</strong><br />
                    Los links de regalo son URLs únicas que al ser abiertas muestran una experiencia de "regalo".
                    Cuando el usuario ingresa su teléfono, el beneficio se agrega automáticamente a su cuenta.
                    Si es nuevo, se crea su cuenta.
                </p>
            </div>
        </>
    );
};

export default AdminRegalos;
