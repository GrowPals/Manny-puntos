import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';
import {
    Users,
    Search,
    Shield,
    ShieldAlert,
    ShieldCheck,
    Loader2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

const AdminGestion = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');

    const { data: clientes = [], isLoading: loading } = useQuery({
        queryKey: ['admin-gestion-clientes'],
        queryFn: api.clients.getTodosLosClientes,
    });

    const mutation = useMutation({
        mutationFn: ({ clienteId, esAdmin }) => api.clients.cambiarRolAdmin(clienteId, esAdmin),
        onSuccess: (data, variables) => {
            const action = variables.esAdmin ? 'promovido a Administrador' : 'removido de Administradores';
            toast({
                title: "Rol actualizado",
                description: `El usuario ha sido ${action}.`
            });
            queryClient.invalidateQueries(['admin-gestion-clientes']);
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive"
            });
        }
    });

    const handleToggleAdmin = (clienteId, currentStatus) => {
        const newStatus = !currentStatus;
        mutation.mutate({ clienteId, esAdmin: newStatus });
    };

    const filteredClientes = clientes.filter(cliente =>
        cliente.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cliente.telefono.includes(searchTerm)
    );

    const adminsCount = clientes.filter(c => c.es_admin).length;

    return (
        <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8 pb-24">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                    Gestión de Accesos
                </h1>
                <p className="text-muted-foreground mt-2">
                    Administra los permisos y roles de los usuarios del sistema.
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-xl">
                            <ShieldCheck className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Administradores</p>
                            <p className="text-2xl font-bold">{adminsCount}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-500/10 rounded-xl">
                            <Users className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Usuarios</p>
                            <p className="text-2xl font-bold">{clientes.length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search & Filter */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                        placeholder="Buscar por nombre o teléfono..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-12 bg-card border-border"
                    />
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Usuario</TableHead>
                            <TableHead>Rol Actual</TableHead>
                            <TableHead>Permisos de Admin</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={3} className="h-32 text-center">
                                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                                        <Loader2 className="w-6 h-6 animate-spin mb-2" />
                                        <p>Cargando usuarios...</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : filteredClientes.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="h-32 text-center text-muted-foreground">
                                    No se encontraron usuarios
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredClientes.map((cliente) => (
                                <TableRow key={cliente.id}>
                                    <TableCell>
                                        <div>
                                            <p className="font-medium">{cliente.nombre}</p>
                                            <p className="text-sm text-muted-foreground">{cliente.telefono}</p>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={cliente.es_admin ? "default" : "outline"}>
                                            {cliente.es_admin ? 'Administrador' : 'Usuario'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Switch
                                                checked={cliente.es_admin || false}
                                                onCheckedChange={() => handleToggleAdmin(cliente.id, cliente.es_admin)}
                                                disabled={mutation.isPending}
                                            />
                                            <span className="text-sm text-muted-foreground">
                                                {cliente.es_admin ? 'Acceso Total' : 'Sin Acceso Admin'}
                                            </span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default AdminGestion;