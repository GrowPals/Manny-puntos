
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Package, Plus, Edit, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { useNotionAPI } from '@/context/NotionAPIContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const AdminProductos = () => {
    const { toast } = useToast();
    const { getProductosCanje, crearOActualizarProducto, eliminarProducto } = useNotionAPI();
    const [productos, setProductos] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);

    const loadProductos = async () => {
        const prods = await getProductosCanje();
        setProductos(prods);
    };

    useEffect(() => {
        loadProductos();
    }, []);

    const handleEdit = (producto) => {
        setEditingProduct(producto);
        setShowForm(true);
    };
    
    const handleAddNew = () => {
        setEditingProduct(null);
        setShowForm(true);
    };

    const handleDelete = async (productoId) => {
        if (window.confirm('¿Estás seguro de que quieres eliminar este producto?')) {
            try {
                await eliminarProducto(productoId);
                toast({ title: 'Producto eliminado' });
                loadProductos();
            } catch (error) {
                toast({ title: 'Error al eliminar', variant: 'destructive' });
            }
        }
    };
    
    const ProductForm = ({ product, onFinished }) => {
        const [formData, setFormData] = useState(product || { nombre: '', descripcion: '', puntos_requeridos: '', stock: '', categoria: '', activo: true });

        const handleChange = (e) => {
            const { name, value, type, checked } = e.target;
            setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        };

        const handleSubmit = async (e) => {
            e.preventDefault();
            try {
                await crearOActualizarProducto(formData);
                toast({ title: product ? 'Producto actualizado' : 'Producto creado' });
                onFinished();
            } catch(error) {
                toast({ title: 'Error al guardar', variant: 'destructive' });
            }
        };

        return (
             <motion.div initial={{opacity: 0}} animate={{opacity: 1}} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
                <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold">{product ? 'Editar' : 'Nuevo'} Producto</h2>
                        <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}><X /></Button>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input name="nombre" value={formData.nombre} onChange={handleChange} placeholder="Nombre del producto" required />
                        <Input name="descripcion" value={formData.descripcion} onChange={handleChange} placeholder="Descripción" />
                        <Input name="puntos_requeridos" type="number" value={formData.puntos_requeridos} onChange={handleChange} placeholder="Puntos requeridos" required />
                        <Input name="stock" type="number" value={formData.stock} onChange={handleChange} placeholder="Stock disponible" required />
                        <Input name="categoria" value={formData.categoria} onChange={handleChange} placeholder="Categoría" />
                        <div className="flex items-center gap-2">
                           <input type="checkbox" id="activo" name="activo" checked={formData.activo} onChange={handleChange} />
                           <label htmlFor="activo">Producto Activo</label>
                        </div>
                        <Button type="submit" className="w-full bg-gradient-to-r from-orange-500 to-pink-500">{product ? 'Actualizar' : 'Crear'} Producto</Button>
                    </form>
                </div>
            </motion.div>
        );
    };

    return (
        <>
            <Helmet>
                <title>Gestión de Productos - Admin Manny</title>
            </Helmet>

            {showForm && <ProductForm product={editingProduct} onFinished={() => { setShowForm(false); loadProductos(); }} />}

            <div className="min-h-screen flex flex-col">
                <Header />
                <main className="flex-1 container mx-auto px-4 py-8">
                    <div className="flex justify-between items-center mb-8">
                        <h1 className="text-3xl md:text-4xl font-bold text-gray-800 flex items-center gap-3">
                            <Package className="w-8 h-8 text-orange-500" />
                            Gestión de Productos
                        </h1>
                        <Button onClick={handleAddNew} className="bg-gradient-to-r from-orange-500 to-pink-500 rounded-xl">
                            <Plus className="w-4 h-4 mr-2" />
                            Añadir Producto
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {productos.map((producto) => (
                             <div key={producto.id} className="bg-white rounded-2xl shadow-lg p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800">{producto.nombre}</h3>
                                    <p className="text-sm text-gray-500 mt-1">{producto.categoria}</p>
                                </div>
                                <div className="flex items-center gap-4">
                                     <span className="font-bold text-lg text-orange-600">{producto.puntos_requeridos} pts</span>
                                     <span className={`font-semibold text-sm px-3 py-1 rounded-full ${producto.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{producto.activo ? 'Activo' : 'Pausado'}</span>
                                      <span className={`font-semibold text-sm px-3 py-1 rounded-full ${producto.stock > 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-600'}`}>Stock: {producto.stock}</span>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="icon" onClick={() => handleEdit(producto)}><Edit className="w-4 h-4" /></Button>
                                    <Button variant="destructive" size="icon" onClick={() => handleDelete(producto.id)}><Trash2 className="w-4 h-4" /></Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </main>
                <Footer />
            </div>
        </>
    );
};

export default AdminProductos;
