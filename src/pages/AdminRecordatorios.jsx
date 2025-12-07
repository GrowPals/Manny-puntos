import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import {
    Bell,
    Loader2,
    Plus,
    Trash2,
    Save,
    Clock,
    Wrench,
    Settings,
    MessageSquare,
    Smartphone,
    Power,
    ChevronRight
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";

const AdminRecordatorios = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [editingTipo, setEditingTipo] = useState(null);
    const [newTipo, setNewTipo] = useState({ tipo_trabajo: '', dias_recordatorio: 180 });

    const { data: config = {
        activo: false,
        max_notificaciones_mes: 1,
        titulo_default: '¿Es hora de dar mantenimiento?',
        mensaje_default: 'Hola {nombre}, han pasado {dias} días desde tu último {servicio}. ¿Te ayudamos a agendar tu próximo servicio?',
        hora_envio: 10
    }, isLoading: loadingConfig } = useQuery({
        queryKey: ['admin-recordatorios-config'],
        queryFn: api.admin.getConfigRecordatorios,
    });

    const { data: tiposRecurrentes = [], isLoading: loadingTipos } = useQuery({
        queryKey: ['admin-recordatorios-tipos'],
        queryFn: api.admin.getTiposServicioRecurrente,
    });

    const { data: tiposDisponibles = [], isLoading: loadingDisponibles } = useQuery({
        queryKey: ['admin-recordatorios-disponibles'],
        queryFn: api.admin.getTiposTrabajoDisponibles,
    });

    const loading = loadingConfig || loadingTipos || loadingDisponibles;

    const configMutation = useMutation({
        mutationFn: api.admin.actualizarConfigRecordatorios,
        onSuccess: (data) => {
            queryClient.setQueryData(['admin-recordatorios-config'], data);
            toast({ title: "Guardado", description: "Configuración actualizada correctamente." });
        },
        onError: (error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    const addTipoMutation = useMutation({
        mutationFn: ({ tipoTrabajo, diasRecordatorio }) => api.admin.agregarTipoServicioRecurrente(tipoTrabajo, diasRecordatorio),
        onSuccess: (data) => {
            toast({ title: "Agregado", description: `"${data.tipo_trabajo}" configurado para recordar cada ${data.dias_recordatorio} días.` });
            setShowAddDialog(false);
            setNewTipo({ tipo_trabajo: '', dias_recordatorio: 180 });
            queryClient.invalidateQueries(['admin-recordatorios-tipos']);
        },
        onError: (error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    const updateTipoMutation = useMutation({
        mutationFn: ({ id, updates }) => api.admin.actualizarTipoServicioRecurrente(id, updates),
        onSuccess: () => {
            toast({ title: "Guardado" });
            setEditingTipo(null);
            queryClient.invalidateQueries(['admin-recordatorios-tipos']);
        },
        onError: (error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    const deleteTipoMutation = useMutation({
        mutationFn: api.admin.eliminarTipoServicioRecurrente,
        onSuccess: () => {
            toast({ title: "Eliminado" });
            queryClient.invalidateQueries(['admin-recordatorios-tipos']);
        },
        onError: (error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    const [localConfig, setLocalConfig] = useState(null);

    useEffect(() => {
        if (config) {
            setLocalConfig(config);
        }
    }, [config]);

    const handleToggleActive = (checked) => {
        const newConfig = { ...localConfig, activo: checked };
        setLocalConfig(newConfig);
        configMutation.mutate(newConfig);
    };

    const handleSaveConfig = () => {
        configMutation.mutate(localConfig);
    };

    const handleAddTipo = () => {
        if (!newTipo.tipo_trabajo || !newTipo.dias_recordatorio) {
            toast({ title: "Error", description: "Completa todos los campos", variant: "destructive" });
            return;
        }
        addTipoMutation.mutate({ tipoTrabajo: newTipo.tipo_trabajo, diasRecordatorio: newTipo.dias_recordatorio });
    };

    const handleSaveTipo = () => {
        if (!editingTipo) return;
        updateTipoMutation.mutate({
            id: editingTipo.id,
            updates: {
                dias_recordatorio: editingTipo.dias_recordatorio,
                mensaje_personalizado: editingTipo.mensaje_personalizado || null,
                activo: editingTipo.activo
            }
        });
    };

    const handleDeleteTipo = (id, nombre) => {
        if (!confirm(`¿Eliminar "${nombre}"?`)) return;
        deleteTipoMutation.mutate(id);
    };

    const saving = configMutation.isPending || addTipoMutation.isPending || updateTipoMutation.isPending || deleteTipoMutation.isPending;

    // Filtrar tipos disponibles que no están ya configurados
    const tiposSinConfigurar = tiposDisponibles.filter(
        tipo => !tiposRecurrentes.some(t => t.tipo_trabajo.toLowerCase() === tipo.toLowerCase())
    );

    // Preview del mensaje
    const generatePreview = (mensaje, tipoTrabajo = 'mantenimiento de A/C', dias = 180) => {
        return (mensaje || config?.mensaje_default || '')
            .replace('{nombre}', 'Juan')
            .replace('{servicio}', tipoTrabajo)
            .replace('{tipo}', tipoTrabajo)
            .replace('{dias}', dias);
    };

    const formatDays = (dias) => {
        if (dias === 7) return '1 semana';
        if (dias === 30) return '1 mes';
        if (dias === 60) return '2 meses';
        if (dias === 90) return '3 meses';
        if (dias === 180) return '6 meses';
        if (dias === 365) return '1 año';
        return `${dias} días`;
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
                <title>Recordatorios - Admin Manny</title>
            </Helmet>

            {/* Dialog para agregar tipo */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent className="bg-card border-border text-foreground">
                    <DialogHeader>
                        <DialogTitle className="text-xl flex items-center gap-2">
                            <Plus className="w-5 h-5 text-primary" />
                            Nuevo Servicio Recurrente
                        </DialogTitle>
                        <DialogDescription>
                            Configura un tipo de servicio para enviar recordatorios automáticos a los clientes.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <label className="text-sm font-medium text-muted-foreground mb-2 block">
                                Tipo de servicio
                            </label>
                            {tiposSinConfigurar.length > 0 ? (
                                <Select
                                    value={newTipo.tipo_trabajo}
                                    onValueChange={(value) => setNewTipo(prev => ({ ...prev, tipo_trabajo: value }))}
                                >
                                    <SelectTrigger className="bg-background border-border">
                                        <SelectValue placeholder="Selecciona un tipo..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {tiposSinConfigurar.map(tipo => (
                                            <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    placeholder="Ej: Mantenimiento A/C"
                                    value={newTipo.tipo_trabajo}
                                    onChange={(e) => setNewTipo(prev => ({ ...prev, tipo_trabajo: e.target.value }))}
                                    className="bg-background border-border"
                                />
                            )}
                        </div>
                        <div>
                            <label className="text-sm font-medium text-muted-foreground mb-2 block">
                                Recordar después de...
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { dias: 30, label: '1 mes' },
                                    { dias: 90, label: '3 meses' },
                                    { dias: 180, label: '6 meses' },
                                    { dias: 365, label: '1 año' },
                                ].map(({ dias, label }) => (
                                    <Button
                                        key={dias}
                                        type="button"
                                        variant={newTipo.dias_recordatorio === dias ? "default" : "outline"}
                                        className="w-full"
                                        onClick={() => setNewTipo(prev => ({ ...prev, dias_recordatorio: dias }))}
                                    >
                                        {label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <DialogClose asChild>
                            <Button variant="outline">Cancelar</Button>
                        </DialogClose>
                        <Button onClick={handleAddTipo} disabled={saving || !newTipo.tipo_trabajo}>
                            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            Agregar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog para editar tipo */}
            <Dialog open={!!editingTipo} onOpenChange={() => setEditingTipo(null)}>
                <DialogContent className="bg-card border-border text-foreground">
                    <DialogHeader>
                        <DialogTitle className="text-xl flex items-center gap-2">
                            <Settings className="w-5 h-5 text-primary" />
                            {editingTipo?.tipo_trabajo}
                        </DialogTitle>
                        <DialogDescription>
                            Configura los días de recordatorio y mensaje personalizado para este servicio.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {/* Switch activo */}
                        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                            <span className="font-medium">Enviar recordatorios</span>
                            <Switch
                                checked={editingTipo?.activo || false}
                                onCheckedChange={(checked) => setEditingTipo(prev => ({ ...prev, activo: checked }))}
                            />
                        </div>

                        {/* Días */}
                        <div>
                            <label className="text-sm font-medium text-muted-foreground mb-2 block">
                                Recordar después de...
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { dias: 7, label: '1 sem' },
                                    { dias: 30, label: '1 mes' },
                                    { dias: 90, label: '3 meses' },
                                    { dias: 180, label: '6 meses' },
                                    { dias: 365, label: '1 año' },
                                ].map(({ dias, label }) => (
                                    <Button
                                        key={dias}
                                        type="button"
                                        variant={editingTipo?.dias_recordatorio === dias ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setEditingTipo(prev => ({ ...prev, dias_recordatorio: dias }))}
                                    >
                                        {label}
                                    </Button>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2 text-center">
                                o escribe un número personalizado:
                            </p>
                            <Input
                                type="number"
                                min="7"
                                max="730"
                                value={editingTipo?.dias_recordatorio || 180}
                                onChange={(e) => setEditingTipo(prev => ({ ...prev, dias_recordatorio: parseInt(e.target.value) || 180 }))}
                                className="bg-background border-border mt-2 text-center"
                            />
                        </div>

                        {/* Mensaje personalizado */}
                        <div>
                            <label className="text-sm font-medium text-muted-foreground mb-2 block">
                                Mensaje personalizado (opcional)
                            </label>
                            <textarea
                                value={editingTipo?.mensaje_personalizado || ''}
                                onChange={(e) => setEditingTipo(prev => ({ ...prev, mensaje_personalizado: e.target.value }))}
                                placeholder="Dejar vacío para usar mensaje general..."
                                className="w-full h-24 p-3 rounded-xl bg-background border border-border text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Variables: {'{nombre}'}, {'{servicio}'}, {'{dias}'}
                            </p>
                        </div>

                        {/* Preview */}
                        {editingTipo && (
                            <div className="bg-muted/20 rounded-xl p-4 border border-border/50">
                                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                                    <Smartphone className="w-3.5 h-3.5" />
                                    Vista previa
                                </p>
                                <div className="bg-background rounded-xl p-3 shadow-sm border border-border">
                                    <p className="font-semibold text-sm">{config?.titulo_default}</p>
                                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                                        {generatePreview(
                                            editingTipo.mensaje_personalizado || config?.mensaje_default,
                                            editingTipo.tipo_trabajo,
                                            editingTipo.dias_recordatorio
                                        )}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter className="gap-2">
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                                handleDeleteTipo(editingTipo.id, editingTipo.tipo_trabajo);
                                setEditingTipo(null);
                            }}
                        >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Eliminar
                        </Button>
                        <div className="flex-1" />
                        <DialogClose asChild>
                            <Button variant="outline">Cancelar</Button>
                        </DialogClose>
                        <Button onClick={handleSaveTipo} disabled={saving}>
                            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            Guardar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Header */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
                <h1 className="text-2xl md:text-3xl flex items-center gap-3">
                    <Bell className="w-7 h-7 text-primary" />
                    Recordatorios Automáticos
                </h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    Notificaciones push automáticas para servicios recurrentes
                </p>
            </motion.div>

            {/* Control principal ON/OFF */}
            <div className="bg-card rounded-2xl p-5 mb-6 border border-border shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl transition-colors ${localConfig?.activo ? 'bg-primary/10' : 'bg-muted/50'}`}>
                            <Power className={`w-6 h-6 transition-colors ${localConfig?.activo ? 'text-primary' : 'text-muted-foreground'}`} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="font-bold text-lg">
                                    {localConfig?.activo ? 'Sistema Activo' : 'Sistema Inactivo'}
                                </h2>
                                {localConfig?.activo && (
                                    <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-full">
                                        ON
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {localConfig?.activo
                                    ? `Envío diario a las ${localConfig.hora_envio}:00 hrs`
                                    : 'Activa para enviar recordatorios automáticos'}
                            </p>
                        </div>
                    </div>
                    <Switch
                        checked={localConfig?.activo || false}
                        onCheckedChange={handleToggleActive}
                        disabled={saving}
                        className="scale-110"
                    />
                </div>
            </div>

            {/* Servicios configurados */}
            <div className="bg-card rounded-2xl shadow-sm border border-border p-5 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-lg flex items-center gap-2">
                        <Wrench className="w-5 h-5 text-primary" />
                        Servicios ({tiposRecurrentes.length})
                    </h2>
                    <Button onClick={() => setShowAddDialog(true)} size="sm">
                        <Plus className="w-4 h-4 mr-1" />
                        Agregar
                    </Button>
                </div>

                {tiposRecurrentes.length > 0 ? (
                    <div className="space-y-2">
                        {tiposRecurrentes.map((tipo) => (
                            <button
                                key={tipo.id}
                                onClick={() => setEditingTipo(tipo)}
                                className={`w-full p-4 rounded-xl border text-left transition-all hover:bg-muted/50 flex items-center justify-between group ${
                                    tipo.activo ? 'border-border bg-muted/20' : 'border-border/50 bg-muted/10 opacity-60'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${tipo.activo ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                                    <div>
                                        <p className="font-medium">{tipo.tipo_trabajo}</p>
                                        <p className="text-xs text-muted-foreground">
                                            Recordar cada {formatDays(tipo.dias_recordatorio)}
                                            {tipo.mensaje_personalizado && ' • Mensaje personalizado'}
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-muted-foreground">
                        <Wrench className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No hay servicios configurados</p>
                        <Button onClick={() => setShowAddDialog(true)} className="mt-3" size="sm">
                            <Plus className="w-4 h-4 mr-1" />
                            Agregar servicio
                        </Button>
                    </div>
                )}
            </div>

            {/* Configuración del mensaje */}
            <div className="bg-card rounded-2xl shadow-sm border border-border p-5">
                <div className="flex items-center gap-2 mb-4">
                    <MessageSquare className="w-5 h-5 text-primary" />
                    <h2 className="font-bold text-lg">Mensaje General</h2>
                </div>

                <div className="space-y-4">
                    {/* Título de la notificación */}
                    <div>
                        <label className="text-sm font-medium text-muted-foreground mb-2 block">
                            Título de la notificación
                        </label>
                        <Input
                            value={localConfig?.titulo_default || ''}
                            onChange={(e) => setLocalConfig(prev => ({ ...prev, titulo_default: e.target.value }))}
                            className="bg-background border-border"
                            placeholder="¿Es hora de dar mantenimiento?"
                        />
                    </div>

                    {/* Mensaje */}
                    <div>
                        <label className="text-sm font-medium text-muted-foreground mb-2 block">
                            Cuerpo del mensaje
                        </label>
                        <textarea
                            value={localConfig?.mensaje_default || ''}
                            onChange={(e) => setLocalConfig(prev => ({ ...prev, mensaje_default: e.target.value }))}
                            placeholder="Hola {nombre}, han pasado {dias} días..."
                            className="w-full h-24 p-3 rounded-xl bg-background border border-border text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                        <div className="flex gap-2 mt-2 flex-wrap">
                            {['{nombre}', '{servicio}', '{dias}'].map(v => (
                                <code key={v} className="px-2 py-1 bg-primary/10 text-primary rounded text-xs">
                                    {v}
                                </code>
                            ))}
                        </div>
                    </div>

                    {/* Hora de envío */}
                    <div className="flex items-center gap-4 pt-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            Hora de envío:
                        </div>
                        <Select
                            value={String(localConfig?.hora_envio || 10)}
                            onValueChange={(value) => setLocalConfig(prev => ({ ...prev, hora_envio: parseInt(value) }))}
                        >
                            <SelectTrigger className="w-32 bg-background border-border">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {[9, 10, 11, 12, 14, 15, 16, 17, 18].map(hora => (
                                    <SelectItem key={hora} value={String(hora)}>
                                        {hora}:00 hrs
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Preview */}
                    <div className="bg-muted/20 rounded-xl p-4 mt-4 border border-border/50">
                        <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                            <Smartphone className="w-3.5 h-3.5" />
                            Vista previa de notificación
                        </p>
                        <div className="bg-background rounded-xl p-4 shadow-sm border border-border">
                            <p className="font-semibold text-sm text-foreground">{localConfig?.titulo_default || '¿Es hora de dar mantenimiento?'}</p>
                            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                                {generatePreview(localConfig?.mensaje_default)}
                            </p>
                            <div className="flex gap-2 mt-4">
                                <div className="flex-1 bg-primary text-primary-foreground text-xs font-medium py-2.5 px-4 rounded-lg text-center">
                                    Contactar por WhatsApp
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Guardar */}
                    <div className="flex justify-end pt-2">
                        <Button onClick={handleSaveConfig} disabled={saving}>
                            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Guardar Cambios
                        </Button>
                    </div>
                </div>
            </div>

            {/* Info footer */}
            <div className="mt-6 p-4 bg-muted/30 rounded-xl border border-border/50">
                <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">¿Cómo funciona?</strong><br />
                    El sistema revisa diariamente los servicios completados. Si han pasado los días configurados desde el último servicio de un cliente,
                    reciben una notificación push con botón para contactarte por WhatsApp.
                </p>
            </div>
        </>
    );
};

export default AdminRecordatorios;
