
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Package, Plus, Edit, Trash2, Image as ImageIcon, Wrench, Loader2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useAuth } from '@/context/AuthContext';
import { logger } from '@/lib/logger';


const ProductForm = ({ product, onFinished }) => {
    const defaultState = { id: undefined, nombre: '', descripcion: '', tipo: 'producto', puntos_requeridos: '', stock: '', categoria: '', imagen_url: '', activo: true };
    const [formData, setFormData] = useState(product ? { ...product, puntos_requeridos: product.puntos_requeridos || '', stock: product.stock || '' } : defaultState);
    const [imagePreview, setImagePreview] = useState(product?.imagen_url || null);
    const [isUploading, setIsUploading] = useState(false);
    const { toast } = useToast();
    const { isAdmin } = useAuth();
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: api.products.crearOActualizarProducto,
        onSuccess: () => {
            toast({ title: product ? 'Recompensa actualizada' : 'Recompensa creada con éxito' });
            queryClient.invalidateQueries(['admin-productos']);
            onFinished();
        },
        onError: (error) => {
            logger.error('Error submitting product', { error: error.message });
            toast({ title: 'Error al guardar', description: error.message, variant: 'destructive' });
        }
    });

    useEffect(() => {
      setFormData(product ? { ...product, puntos_requeridos: product.puntos_requeridos || '', stock: product.stock || '' } : defaultState);
      setImagePreview(product?.imagen_url || null);
    }, [product]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const finalValue = type === 'checkbox' ? checked : value;
        setFormData(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleTypeChange = (value) => {
      setFormData(prev => ({ ...prev, tipo: value, stock: value === 'servicio' ? null : (prev.stock || '') }));
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const publicUrl = await api.products.subirImagenProducto(file);
            setFormData(prev => ({ ...prev, imagen_url: publicUrl }));
            setImagePreview(publicUrl);
            toast({ title: 'Imagen subida', description: 'La imagen se cargó correctamente.' });
        } catch (error) {
            logger.error('Error uploading image', { error: error.message });
            toast({ title: 'Error al subir imagen', description: error.message, variant: 'destructive' });
        } finally {
            setIsUploading(false);
        }
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!isAdmin) {
             toast({ title: 'Acción no permitida', description: 'No tienes permisos de administrador.', variant: 'destructive' });
             return;
        }
        if (formData.nombre.trim().length < 3) {
            toast({ title: 'Error de validación', description: 'El nombre es requerido.', variant: 'destructive' });
            return;
        }
        if (Number(formData.puntos_requeridos) <= 0) {
            toast({ title: 'Error de validación', description: 'Los puntos deben ser un número positivo.', variant: 'destructive' });
            return;
        }
        
        const cleanData = {
            ...formData,
            puntos_requeridos: Number(formData.puntos_requeridos),
            stock: formData.tipo === 'producto' ? Number(formData.stock) : null,
        };

        mutation.mutate(cleanData);
    };

    const isSubmitting = mutation.isPending;

    return (
        <DialogContent className="bg-card border-border text-foreground sm:max-w-md">
            <DialogHeader>
                <DialogTitle className="text-lg font-bold">{product ? 'Editar' : 'Nueva'} Recompensa</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Tipo - inline toggle */}
                <div className="flex items-center gap-2 p-1 bg-muted/50 rounded-lg">
                    <button
                        type="button"
                        onClick={() => handleTypeChange('producto')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                            formData.tipo === 'producto'
                                ? 'bg-background shadow-sm text-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Package className="w-4 h-4" />
                        Producto
                    </button>
                    <button
                        type="button"
                        onClick={() => handleTypeChange('servicio')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                            formData.tipo === 'servicio'
                                ? 'bg-background shadow-sm text-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Wrench className="w-4 h-4" />
                        Servicio
                    </button>
                </div>

                {/* Nombre */}
                <Input
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleChange}
                    placeholder="Nombre de la recompensa *"
                    required
                />

                {/* Puntos y Stock/Categoría en grid */}
                <div className="grid grid-cols-2 gap-3">
                    <Input
                        name="puntos_requeridos"
                        type="number"
                        value={formData.puntos_requeridos}
                        onChange={handleChange}
                        placeholder="Puntos requeridos *"
                        required
                        min="1"
                    />
                    {formData.tipo === 'producto' ? (
                        <Input
                            name="stock"
                            type="number"
                            value={formData.stock || ''}
                            onChange={handleChange}
                            placeholder="Stock disponible *"
                            required
                            min="0"
                        />
                    ) : (
                        <Input
                            name="categoria"
                            value={formData.categoria || ''}
                            onChange={handleChange}
                            placeholder="Categoría"
                        />
                    )}
                </div>

                {/* Estado activo - compacto */}
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 border border-border">
                    <span className="text-sm font-medium">Activa en catálogo</span>
                    <input
                        type="checkbox"
                        name="activo"
                        checked={formData.activo}
                        onChange={handleChange}
                        className="w-5 h-5 accent-primary rounded"
                    />
                </div>

                {/* Opciones avanzadas colapsables */}
                <details className="group">
                    <summary className="flex items-center cursor-pointer py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors list-none">
                        <ChevronDown className="w-4 h-4 mr-2 transition-transform group-open:rotate-180" />
                        Más opciones
                    </summary>
                    <div className="space-y-3 pt-3 border-t border-border mt-2">
                        {/* Descripción */}
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Descripción</label>
                            <textarea
                                name="descripcion"
                                value={formData.descripcion || ''}
                                onChange={handleChange}
                                placeholder="Qué incluye esta recompensa..."
                                className="w-full h-16 p-2.5 rounded-lg bg-background border border-border text-foreground resize-none text-sm"
                            />
                        </div>

                        {/* Categoría para productos */}
                        {formData.tipo === 'producto' && (
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Categoría</label>
                                <Input
                                    name="categoria"
                                    value={formData.categoria || ''}
                                    onChange={handleChange}
                                    placeholder="Ej: Herramientas, Accesorios"
                                />
                            </div>
                        )}

                        {/* Imagen */}
                        <div className="space-y-2">
                            <label className="text-xs text-muted-foreground block">Imagen</label>

                            {imagePreview && (
                                <div className="relative rounded-lg overflow-hidden bg-muted">
                                    <img src={imagePreview} alt="preview" className="w-full h-32 object-contain"/>
                                </div>
                            )}

                            <Input
                                name="imagen_url"
                                value={formData.imagen_url || ''}
                                onChange={handleChange}
                                placeholder="URL de la imagen"
                            />

                            <label className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer ${isUploading ? 'opacity-50' : ''}`}>
                                {isUploading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                        <span className="text-sm text-muted-foreground">Subiendo...</span>
                                    </>
                                ) : (
                                    <>
                                        <ImageIcon className="w-4 h-4 text-muted-foreground" />
                                        <span className="text-sm text-muted-foreground">Subir imagen</span>
                                    </>
                                )}
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                    onChange={handleFileChange}
                                    className="hidden"
                                    disabled={isUploading}
                                />
                            </label>
                        </div>
                    </div>
                </details>

                <DialogFooter className="gap-2 mt-2">
                    <DialogClose asChild>
                        <Button type="button" variant="outline" size="sm" disabled={isSubmitting}>Cancelar</Button>
                    </DialogClose>
                    <Button type="submit" size="sm" disabled={isSubmitting || isUploading}>
                        {isSubmitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                        {product ? 'Guardar' : 'Crear'}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    );
};

const AdminProductos = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState({ open: false, producto: null });

    const { data: productos = [], isLoading: loading } = useQuery({
        queryKey: ['admin-productos'],
        queryFn: api.products.getAllProductosAdmin,
    });

    const deleteMutation = useMutation({
        mutationFn: api.products.eliminarProducto,
        onSuccess: () => {
            toast({ title: 'Recompensa eliminada' });
            queryClient.invalidateQueries(['admin-productos']);
            setDeleteConfirm({ open: false, producto: null });
        },
        onError: (error) => {
            logger.error('Error deleting product', { error: error.message });
            toast({ title: 'Error al eliminar', description: error.message, variant: 'destructive' });
        }
    });

    const handleEdit = (producto) => {
        setEditingProduct(producto);
        setShowForm(true);
    };
    
    const handleAddNew = () => {
        setEditingProduct(null);
        setShowForm(true);
    };

    const handleDeleteClick = (producto) => {
        setDeleteConfirm({ open: true, producto });
    };

    const handleDeleteConfirm = () => {
        if (!deleteConfirm.producto) return;
        deleteMutation.mutate(deleteConfirm.producto.id);
    };

    const handleFormFinished = () => {
        setShowForm(false);
        setEditingProduct(null);
    }

    if (loading) {
      return <div className="flex justify-center items-center py-20"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>;
    }

    return (
        <>
            <Helmet>
                <title>Gestión de Recompensas - Admin Manny</title>
            </Helmet>

            <Dialog open={showForm} onOpenChange={setShowForm}>
              {showForm && <ProductForm product={editingProduct} onFinished={handleFormFinished} />}
            </Dialog>

            <Dialog open={deleteConfirm.open} onOpenChange={(open) => setDeleteConfirm({ open, producto: null })}>
                <DialogContent className="bg-card border-border text-foreground">
                    <DialogHeader>
                        <DialogTitle className="text-xl">Eliminar Recompensa</DialogTitle>
                    </DialogHeader>
                    <p className="text-muted-foreground py-4">
                        ¿Estás seguro de que quieres eliminar <strong className="text-foreground">{deleteConfirm.producto?.nombre}</strong>? Esta acción no se puede deshacer.
                    </p>
                    <DialogFooter className="gap-2">
                        <DialogClose asChild>
                            <Button variant="outline">Cancelar</Button>
                        </DialogClose>
                        <Button variant="destructive" onClick={handleDeleteConfirm}>
                            Eliminar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="space-y-6">
                <PageHeader
                    icon={Package}
                    title="Recompensas"
                    subtitle={`${productos.length} en catálogo`}
                >
                    <Button onClick={handleAddNew} variant="investment" className="w-full md:w-auto">
                        <Plus className="w-4 h-4 mr-2" />
                        Añadir Recompensa
                    </Button>
                </PageHeader>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {productos.map((producto) => (
                         <div key={producto.id} className="bg-card rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden border border-border group">
                            {/* Image container with fixed aspect ratio */}
                            <div className="relative aspect-[4/3] bg-muted overflow-hidden">
                                {producto.imagen_url ? (
                                    <img
                                        src={producto.imagen_url}
                                        alt={producto.nombre}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        {producto.tipo === 'servicio' ? (
                                            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                                                <Wrench className="w-8 h-8 text-primary/60" />
                                            </div>
                                        ) : (
                                            <div className="w-16 h-16 rounded-2xl bg-muted-foreground/10 flex items-center justify-center">
                                                <ImageIcon className="w-8 h-8 text-muted-foreground/60" />
                                            </div>
                                        )}
                                    </div>
                                )}
                                {/* Type badge overlay */}
                                <div className="absolute top-3 left-3">
                                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg backdrop-blur-sm capitalize ${
                                        producto.tipo === 'servicio'
                                            ? 'bg-blue-500/90 text-white'
                                            : 'bg-rose-500/90 text-white'
                                    }`}>
                                        {producto.tipo}
                                    </span>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-4">
                                <h3 className="text-base font-bold text-foreground line-clamp-2 min-h-[2.5rem]">
                                    {producto.nombre}
                                </h3>

                                {/* Price and Stock row */}
                                <div className="flex items-center justify-between mt-3 mb-3">
                                    <span className="font-bold text-xl text-primary">{producto.puntos_requeridos.toLocaleString()} pts</span>
                                    {producto.tipo === 'producto' && (
                                        <span className="font-semibold text-sm px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                            Stock: {producto.stock}
                                        </span>
                                    )}
                                </div>

                                {/* Status and Actions row */}
                                <div className="flex items-center justify-between pt-3 border-t border-border">
                                    <span className={`font-semibold text-xs px-2.5 py-1.5 rounded-lg ${
                                        producto.activo
                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                            : 'bg-red-500/10 text-red-600 dark:text-red-400'
                                    }`}>
                                        {producto.activo ? 'Activo' : 'Pausado'}
                                    </span>
                                    <div className="flex gap-1.5">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleEdit(producto)}
                                            className="h-9 w-9 hover:bg-primary/10 hover:text-primary"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDeleteClick(producto)}
                                            className="h-9 w-9 hover:bg-red-500/10 hover:text-red-500"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

export default AdminProductos;
