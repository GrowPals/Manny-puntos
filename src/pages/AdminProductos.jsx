
import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Package, Plus, Edit, Trash2, Image as ImageIcon, Wrench, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { useSupabaseAPI } from '@/context/SupabaseContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from '@/context/AuthContext';


const ProductForm = ({ product, onFinished }) => {
    const defaultState = { id: undefined, nombre: '', descripcion: '', tipo: 'producto', puntos_requeridos: '', stock: '', categoria: '', imagen_url: '', activo: true };
    const [formData, setFormData] = useState(product ? { ...product, puntos_requeridos: product.puntos_requeridos || '', stock: product.stock || '' } : defaultState);
    const [imagePreview, setImagePreview] = useState(product?.imagen_url || null);
    const api = useSupabaseAPI();
    const { toast } = useToast();
    const { isAdmin } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);

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
        toast({ title: 'Función no disponible', description: 'La carga de archivos de imagen no está implementada. Por favor, usa una URL de imagen por ahora.' });
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
        
        setIsSubmitting(true);
        try {
            const cleanData = {
                ...formData,
                puntos_requeridos: Number(formData.puntos_requeridos),
                stock: formData.tipo === 'producto' ? Number(formData.stock) : null,
            };

            await api.crearOActualizarProducto(cleanData);
            toast({ title: product ? 'Recompensa actualizada' : 'Recompensa creada con éxito' });
            onFinished();
        } catch(error) {
            console.error("Error submitting product:", error);
            toast({ title: 'Error al guardar', description: error.message, variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <DialogContent className="bg-card border-border text-foreground">
            <DialogHeader>
                <DialogTitle className="text-2xl">{product ? 'Editar' : 'Nueva'} Recompensa</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-2">
                <Input name="nombre" value={formData.nombre} onChange={handleChange} placeholder="Nombre de la recompensa (ej. Kit de Herramientas)" required className="h-12 text-base" />
                <Select value={formData.tipo} onValueChange={handleTypeChange}>
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue placeholder="Tipo de recompensa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="producto">Producto Físico</SelectItem>
                    <SelectItem value="servicio">Servicio</SelectItem>
                  </SelectContent>
                </Select>
                <Input name="descripcion" value={formData.descripcion || ''} onChange={handleChange} placeholder="Descripción" className="h-12 text-base" />
                <Input name="puntos_requeridos" type="number" value={formData.puntos_requeridos} onChange={handleChange} placeholder="Puntos requeridos" required className="h-12 text-base" />
                {formData.tipo === 'producto' &&
                    <Input name="stock" type="number" value={formData.stock || ''} onChange={handleChange} placeholder="Stock disponible" required className="h-12 text-base" />
                }
                <Input name="categoria" value={formData.categoria || ''} onChange={handleChange} placeholder="Categoría (e.g., Bienestar)" className="h-12 text-base" />
                
                <div className="space-y-2">
                    <Label>Imagen</Label>
                    {imagePreview && <img src={imagePreview} alt="preview" className="w-full h-32 object-contain rounded-lg bg-muted mb-2"/>}
                    <Input name="imagen_url" value={formData.imagen_url || ''} onChange={handleChange} placeholder="URL de la imagen (la carga de archivos está deshabilitada)" className="h-12 text-base" />
                    <Input type="file" accept="image/*" onChange={handleFileChange} className="text-sm" disabled/>
                </div>

                <div className="flex items-center gap-2">
                   <input type="checkbox" id="activo" name="activo" checked={formData.activo} onChange={handleChange} className="w-5 h-5 accent-primary" />
                   <Label htmlFor="activo" className="text-base text-muted-foreground">Recompensa Activa</Label>
                </div>
                 <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline" disabled={isSubmitting}>Cancelar</Button>
                    </DialogClose>
                    <Button type="submit" variant="investment" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {product ? 'Actualizar' : 'Crear'}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    );
};

const AdminProductos = () => {
    const { toast } = useToast();
    const { getAllProductosAdmin, eliminarProducto } = useSupabaseAPI();
    const [productos, setProductos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);

    const loadProductos = useCallback(async () => {
        try {
            setLoading(true);
            const prods = await getAllProductosAdmin();
            setProductos(prods);
        } catch (error) {
            toast({ title: "Error", description: "No se pudieron cargar las recompensas.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [getAllProductosAdmin, toast]);

    useEffect(() => {
        loadProductos();
    }, [loadProductos]);

    const handleEdit = (producto) => {
        setEditingProduct(producto);
        setShowForm(true);
    };
    
    const handleAddNew = () => {
        setEditingProduct(null);
        setShowForm(true);
    };

    const handleDelete = async (productoId) => {
        if (window.confirm('¿Estás seguro de que quieres eliminar esta recompensa? Esta acción no se puede deshacer.')) {
            try {
                await eliminarProducto(productoId);
                toast({ title: 'Recompensa eliminada' });
                loadProductos();
            } catch (error) {
                console.error("Error deleting product:", error);
                toast({ title: 'Error al eliminar', description: error.message, variant: 'destructive' });
            }
        }
    };

    const handleFormFinished = () => {
        setShowForm(false);
        setEditingProduct(null);
        loadProductos();
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

            <div className="container mx-auto px-4 py-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <h1 className="text-3xl md:text-4xl flex items-center gap-3">
                        <Package className="w-8 h-8 text-primary" />
                        Gestión de Recompensas
                    </h1>
                    <Button onClick={handleAddNew} variant="investment">
                        <Plus className="w-4 h-4 mr-2" />
                        Añadir Recompensa
                    </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {productos.map((producto) => (
                         <div key={producto.id} className="bg-card rounded-2xl shadow-sm p-4 flex flex-col border">
                            <div className="flex-grow">
                                <div className="h-40 bg-muted rounded-lg flex items-center justify-center mb-4">
                                    {producto.imagen_url ? (
                                        <img src={producto.imagen_url} alt={producto.nombre} className="w-full h-full object-cover rounded-lg" />
                                    ) : (
                                        producto.tipo === 'servicio' ? <Wrench className="w-16 h-16 text-muted-foreground" /> : <ImageIcon className="w-16 h-16 text-muted-foreground" />
                                    )}
                                </div>
                                <h3 className="text-lg font-bold text-foreground">{producto.nombre}</h3>
                                <p className="text-sm text-muted-foreground mt-1 capitalize">{producto.tipo}</p>
                            </div>
                            <div className="mt-4">
                                <div className="flex items-center justify-between mb-2">
                                     <span className="font-bold text-lg text-primary">{producto.puntos_requeridos} pts</span>
                                     {producto.tipo === 'producto' && <span className="font-semibold text-sm px-3 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">Stock: {producto.stock}</span>}
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className={`font-semibold text-sm px-3 py-1 rounded-full ${producto.activo ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'}`}>{producto.activo ? 'Activo' : 'Pausado'}</span>
                                    <div className="flex gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => handleEdit(producto)}><Edit className="w-4 h-4" /></Button>
                                        <Button variant="destructive" size="icon" onClick={() => handleDelete(producto.id)}><Trash2 className="w-4 h-4" /></Button>
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
