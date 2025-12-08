import { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import {
    Users, Search, Loader2, X, ShieldCheck, UserPlus, Phone,
    Crown, Star, Trash2, ChevronRight
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";

// Super Admin - no puede ser removido
const SUPER_ADMIN_PHONE = '4624844148';

// Avatar Component - consistente con AdminClientes
const AdminAvatar = ({ nombre, nivel, size = 'md' }) => {
    const sizeClasses = {
        sm: 'w-9 h-9 text-sm',
        md: 'w-11 h-11 text-base',
        lg: 'w-14 h-14 text-xl'
    };

    const gradientClasses = nivel === 'vip'
        ? 'bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600'
        : 'bg-gradient-to-br from-cyan-500 via-blue-500 to-blue-700';

    return (
        <div className={`${sizeClasses[size]} ${gradientClasses} rounded-full flex items-center justify-center flex-shrink-0 shadow-lg`}>
            <span className="font-bold text-white drop-shadow-sm">
                {nombre?.charAt(0).toUpperCase() || '?'}
            </span>
        </div>
    );
};

// Level Badge - consistente con AdminClientes
const LevelBadge = ({ nivel }) => {
    if (nivel === 'vip') {
        return (
            <div className="flex items-center gap-1">
                <Crown className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-semibold text-amber-500">VIP</span>
            </div>
        );
    }
    return (
        <div className="flex items-center gap-1">
            <Star className="w-3 h-3 text-blue-500" />
            <span className="text-xs font-medium text-blue-500">Partner</span>
        </div>
    );
};

// Admin Card Component
const AdminCard = ({ admin, isSuperAdmin, canRemove, onRemove, isRemoving }) => (
    <div className="bg-card rounded-xl border border-border p-4 hover:border-border/80 transition-colors">
        <div className="flex items-center gap-3">
            <AdminAvatar nombre={admin.nombre} nivel={admin.nivel} />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <Link
                        to={`/admin/clientes/${admin.id}`}
                        className="font-semibold text-foreground hover:text-primary transition-colors truncate"
                    >
                        {admin.nombre}
                    </Link>
                    <LevelBadge nivel={admin.nivel} />
                    {isSuperAdmin && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-foreground/10 text-foreground rounded">
                            Owner
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                    <Phone className="w-3 h-3" />
                    {admin.telefono}
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Link
                    to={`/admin/clientes/${admin.id}`}
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                    <ChevronRight className="w-5 h-5" />
                </Link>
                {canRemove && (
                    <button
                        onClick={() => onRemove(admin)}
                        disabled={isRemoving}
                        className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                    >
                        {isRemoving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Trash2 className="w-4 h-4" />
                        )}
                    </button>
                )}
            </div>
        </div>
    </div>
);

// Add Admin Modal
const AddAdminModal = ({ open, onClose, clientes, currentAdminIds, onAdd, isAdding }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [addingId, setAddingId] = useState(null);

    // Clientes disponibles (no admins)
    const availableClientes = useMemo(() => {
        return clientes.filter(c => !currentAdminIds.includes(c.id));
    }, [clientes, currentAdminIds]);

    // Filtrados por búsqueda
    const filteredClientes = useMemo(() => {
        if (!searchTerm.trim()) return availableClientes.slice(0, 8);

        const term = searchTerm.toLowerCase();
        return availableClientes
            .filter(c =>
                c.nombre.toLowerCase().includes(term) ||
                c.telefono.includes(searchTerm)
            )
            .slice(0, 10);
    }, [availableClientes, searchTerm]);

    const handleAdd = (cliente) => {
        setAddingId(cliente.id);
        onAdd(cliente);
    };

    // Reset state when modal closes
    const handleOpenChange = (isOpen) => {
        if (!isOpen) {
            setSearchTerm('');
            setAddingId(null);
            onClose();
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="bg-card border-border sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Agregar Administrador</DialogTitle>
                    <DialogDescription className="sr-only">
                        Busca un cliente para darle acceso de administrador.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input
                            placeholder="Buscar cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 h-10"
                            autoFocus
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full"
                            >
                                <X className="w-3 h-3 text-muted-foreground" />
                            </button>
                        )}
                    </div>

                    {/* Results */}
                    <div className="max-h-72 overflow-y-auto -mx-1 px-1">
                        {availableClientes.length === 0 ? (
                            <div className="text-center py-8">
                                <Users className="w-10 h-10 mx-auto mb-2 text-muted-foreground/50" />
                                <p className="text-sm text-muted-foreground">
                                    Todos los clientes ya son administradores
                                </p>
                            </div>
                        ) : filteredClientes.length === 0 ? (
                            <div className="text-center py-8">
                                <Search className="w-10 h-10 mx-auto mb-2 text-muted-foreground/50" />
                                <p className="text-sm text-muted-foreground">
                                    No se encontró "{searchTerm}"
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {!searchTerm && (
                                    <p className="text-xs text-muted-foreground px-1 mb-2">
                                        Clientes recientes
                                    </p>
                                )}
                                {filteredClientes.map((cliente) => {
                                    const isThisAdding = isAdding && addingId === cliente.id;
                                    return (
                                        <button
                                            key={cliente.id}
                                            onClick={() => handleAdd(cliente)}
                                            disabled={isAdding}
                                            className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/70 transition-colors text-left disabled:opacity-50 group"
                                        >
                                            <AdminAvatar nombre={cliente.nombre} nivel={cliente.nivel} size="sm" />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-foreground truncate text-sm">{cliente.nombre}</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-muted-foreground">{cliente.telefono}</span>
                                                    <LevelBadge nivel={cliente.nivel} />
                                                </div>
                                            </div>
                                            {isThisAdding ? (
                                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                            ) : (
                                                <UserPlus className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

// Remove Admin Confirmation Modal
const RemoveAdminModal = ({ open, admin, onClose, onConfirm, isRemoving }) => (
    <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="bg-card border-border">
            <DialogHeader>
                <DialogTitle>Quitar Administrador</DialogTitle>
                <DialogDescription>
                    ¿Estás seguro de quitar los permisos de administrador a <span className="font-semibold text-foreground">{admin?.nombre}</span>?
                </DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 text-sm">
                    <p className="text-amber-600">
                        Esta persona ya no podrá acceder al panel de administración ni gestionar clientes, productos o canjes.
                    </p>
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="outline" disabled={isRemoving}>Cancelar</Button>
                </DialogClose>
                <Button variant="destructive" onClick={onConfirm} disabled={isRemoving}>
                    {isRemoving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Quitar Acceso
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
);

const AdminGestion = () => {
    const { toast } = useToast();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [showAddModal, setShowAddModal] = useState(false);
    const [adminToRemove, setAdminToRemove] = useState(null);
    const [removingId, setRemovingId] = useState(null);

    const { data: clientes = [], isLoading: loading } = useQuery({
        queryKey: ['admin-gestion-clientes'],
        queryFn: api.clients.getTodosLosClientes,
    });

    // Filter only admins (excluding current user)
    const admins = useMemo(() => {
        return clientes
            .filter(c => c.es_admin && c.id !== user?.id)
            .sort((a, b) => {
                // Super admin first
                if (a.telefono === SUPER_ADMIN_PHONE) return -1;
                if (b.telefono === SUPER_ADMIN_PHONE) return 1;
                return a.nombre.localeCompare(b.nombre);
            });
    }, [clientes, user?.id]);

    const currentAdminIds = useMemo(() => clientes.filter(c => c.es_admin).map(c => c.id), [clientes]);

    const addMutation = useMutation({
        mutationFn: ({ clienteId }) => api.clients.cambiarRolAdmin(clienteId, true, user?.id),
        onSuccess: (_, variables) => {
            const cliente = clientes.find(c => c.id === variables.clienteId);
            toast({ title: `${cliente?.nombre || 'Cliente'} ahora es administrador` });
            queryClient.invalidateQueries(['admin-gestion-clientes']);
            setShowAddModal(false);
        },
        onError: (error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    const removeMutation = useMutation({
        mutationFn: ({ clienteId }) => api.clients.cambiarRolAdmin(clienteId, false, user?.id),
        onSuccess: () => {
            toast({ title: "Administrador removido" });
            queryClient.invalidateQueries(['admin-gestion-clientes']);
            setAdminToRemove(null);
            setRemovingId(null);
        },
        onError: (error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
            setRemovingId(null);
        }
    });

    const handleAddAdmin = (cliente) => {
        addMutation.mutate({ clienteId: cliente.id });
    };

    const handleRemoveAdmin = () => {
        if (!adminToRemove) return;
        setRemovingId(adminToRemove.id);
        removeMutation.mutate({ clienteId: adminToRemove.id });
    };

    const canRemoveAdmin = (admin) => {
        // Can't remove super admin
        if (admin.telefono === SUPER_ADMIN_PHONE) return false;
        return true;
    };

    return (
        <>
            <Helmet>
                <title>Administradores - Admin Manny</title>
            </Helmet>

            <div className="space-y-6">
                <PageHeader
                    icon={ShieldCheck}
                    title="Administradores"
                    subtitle={`${admins.length + 1} personas con acceso`}
                >
                    <Button variant="investment" onClick={() => setShowAddModal(true)} className="gap-2">
                        <UserPlus className="w-4 h-4" />
                        Agregar
                    </Button>
                </PageHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* Current User Card - Always shown first */}
                        {user && (
                            <div className="bg-card rounded-xl border border-primary/20 p-4">
                                <div className="flex items-center gap-3">
                                    <AdminAvatar nombre={user.nombre} nivel={user.nivel} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-foreground truncate">
                                                {user.nombre}
                                            </span>
                                            <LevelBadge nivel={user.nivel} />
                                            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary rounded">
                                                Tú
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                                            <Phone className="w-3 h-3" />
                                            {user.telefono}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Other Admins */}
                        {admins.length === 0 ? (
                            <div className="text-center py-12 bg-card rounded-xl border border-border">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                                    <Users className="w-8 h-8 text-muted-foreground" />
                                </div>
                                <p className="text-foreground font-medium mb-1">Solo tú tienes acceso</p>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Agrega otros administradores para ayudarte a gestionar el negocio.
                                </p>
                                <Button variant="outline" onClick={() => setShowAddModal(true)} className="gap-2">
                                    <UserPlus className="w-4 h-4" />
                                    Agregar Administrador
                                </Button>
                            </div>
                        ) : (
                            admins.map((admin) => (
                                <AdminCard
                                    key={admin.id}
                                    admin={admin}
                                    isSuperAdmin={admin.telefono === SUPER_ADMIN_PHONE}
                                    canRemove={canRemoveAdmin(admin)}
                                    onRemove={setAdminToRemove}
                                    isRemoving={removingId === admin.id}
                                />
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Add Admin Modal */}
            <AddAdminModal
                open={showAddModal}
                onClose={() => setShowAddModal(false)}
                clientes={clientes}
                currentAdminIds={currentAdminIds}
                onAdd={handleAddAdmin}
                isAdding={addMutation.isPending}
            />

            {/* Remove Admin Confirmation */}
            <RemoveAdminModal
                open={!!adminToRemove}
                admin={adminToRemove}
                onClose={() => setAdminToRemove(null)}
                onConfirm={handleRemoveAdmin}
                isRemoving={removeMutation.isPending}
            />
        </>
    );
};

export default AdminGestion;
