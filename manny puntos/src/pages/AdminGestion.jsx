import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ShieldCheck, User, Search, Loader2 } from 'lucide-react';
import { useNotionAPI } from '@/context/NotionAPIContext';
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
  DialogTrigger,
} from "@/components/ui/dialog";

const AdminGestion = () => {
    const api = useNotionAPI();
    const { toast } = useToast();
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchClientes = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.getTodosLosClientes();
            setClientes(data);
        } catch (error) {
            toast({ title: "Error", description: "No se pudieron cargar los usuarios.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [api, toast]);

    useEffect(() => {
        fetchClientes();
    }, [fetchClientes]);

    const handleRoleChange = async (cliente, makeAdmin) => {
        try {
            await api.cambiarRolAdmin(cliente.id, makeAdmin);
            toast({
                title: 'Rol actualizado',
                description: `${cliente.nombre} ahora es ${makeAdmin ? 'administrador' : 'cliente'}.`
            });
            fetchClientes();
        } catch (error) {
            toast({ title: "Error", description: "No se pudo cambiar el rol.", variant: "destructive" });
        }
    };

    const { admins, regularUsers } = useMemo(() => {
        const admins = clientes.filter(c => c.es_admin);
        const regularUsers = clientes.filter(c =>
            !c.es_admin &&
            (c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
             c.telefono.includes(searchTerm))
        );
        return { admins, regularUsers };
    }, [clientes, searchTerm]);

    const UserRow = ({ cliente, action }) => (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-muted/50 rounded-xl">
            <div>
                <p className="font-bold text-foreground">{cliente.nombre}</p>
                <p className="text-sm text-muted-foreground">{cliente.telefono}</p>
            </div>
            <Dialog>
                <DialogTrigger asChild>
                    <Button variant={cliente.es_admin ? 'destructive' : 'investment'} className="mt-2 sm:mt-0">
                        {action}
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar cambio de rol</DialogTitle>
                        <DialogDescription>
                            ¿Estás seguro de que quieres {cliente.es_admin ? 'revocar el rol de administrador a' : 'promover a administrador a'} {cliente.nombre}?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="ghost" className="mr-auto">Cancelar</Button>
                        <Button onClick={() => handleRoleChange(cliente, !cliente.es_admin)} variant={cliente.es_admin ? 'destructive' : 'investment'}>
                            Confirmar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );

    return (
        <>
            <Helmet>
                <title>Gestión de Administradores - Manny</title>
            </Helmet>
            <div className="container mx-auto px-4 py-8">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                    <h1 className="text-3xl md:text-4xl flex items-center gap-3"><ShieldCheck className="w-8 h-8 text-primary" />Gestión de Administradores</h1>
                    <p className="text-muted-foreground mt-1">Promueve clientes a administradores o revoca sus permisos.</p>
                </motion.div>

                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <Loader2 className="w-12 h-12 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <section className="bg-card p-6 rounded-2xl shadow-xl">
                            <h2 className="text-2xl mb-4 flex items-center gap-2"><ShieldCheck className="text-primary"/>Administradores Actuales</h2>
                            <div className="space-y-3">
                                {admins.map(admin => (
                                    <UserRow key={admin.id} cliente={admin} action="Revocar" />
                                ))}
                            </div>
                        </section>
                        <section className="bg-card p-6 rounded-2xl shadow-xl">
                            <h2 className="text-2xl mb-4 flex items-center gap-2"><User className="text-blue-500" />Clientes</h2>
                            <div className="relative mb-4">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar cliente para promover..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 h-11 bg-background"
                                />
                            </div>
                            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                                {regularUsers.length > 0 ? regularUsers.map(user => (
                                    <UserRow key={user.id} cliente={user} action="Promover" />
                                )) : <p className="text-center text-muted-foreground pt-8">No se encontraron clientes.</p>}
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </>
    );
};

export default AdminGestion;