
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Package, Edit, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const Productos = () => {
  const { toast } = useToast();
  const [productos, setProductos] = useState([]);

  useEffect(() => {
    loadProductos();
  }, []);

  const loadProductos = () => {
    setProductos(JSON.parse(localStorage.getItem('manny_productos') || '[]'));
  };

  const toggleActivo = (id) => {
    const updated = productos.map(p => 
      p.id === id ? { ...p, activo: !p.activo } : p
    );
    localStorage.setItem('manny_productos', JSON.stringify(updated));
    setProductos(updated);
    toast({
      title: "Estado actualizado",
      description: "El producto ha sido actualizado"
    });
  };

  const eliminarProducto = (id) => {
    const updated = productos.filter(p => p.id !== id);
    localStorage.setItem('manny_productos', JSON.stringify(updated));
    setProductos(updated);
    toast({
      title: "Producto eliminado",
      description: "El producto ha sido eliminado correctamente"
    });
  };

  return (
    <>
      <Helmet>
        <title>Gestión de Productos - Manny</title>
        <meta name="description" content="Administra los productos disponibles para canje" />
      </Helmet>

      <div className="min-h-screen flex flex-col">
        <Header />
        
        <main className="flex-1 container mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2 flex items-center gap-3">
              <Package className="w-8 h-8 text-orange-500" />
              Gestión de Productos
            </h1>
            <p className="text-gray-600">Administra los productos disponibles para canje</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {productos.map((producto) => (
              <motion.div
                key={producto.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-2xl shadow-lg overflow-hidden"
              >
                <div className="h-48 bg-gradient-to-br from-orange-100 to-pink-100 flex items-center justify-center">
                  <Package className="w-20 h-20 text-orange-500" />
                </div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-xl font-bold text-gray-800">{producto.nombre}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      producto.activo 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {producto.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm mb-4">{producto.descripcion}</p>
                  {producto.categoria && (
                    <p className="text-xs text-gray-500 mb-3">
                      Categoría: {producto.categoria}
                    </p>
                  )}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl font-bold text-orange-600">
                      {producto.puntos_requeridos} pts
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => toggleActivo(producto.id)}
                      variant="outline"
                      className="flex-1 rounded-xl"
                    >
                      {producto.activo ? (
                        <ToggleRight className="w-4 h-4 mr-2" />
                      ) : (
                        <ToggleLeft className="w-4 h-4 mr-2" />
                      )}
                      {producto.activo ? 'Desactivar' : 'Activar'}
                    </Button>
                    <Button
                      onClick={() => eliminarProducto(producto.id)}
                      variant="destructive"
                      className="rounded-xl"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
            {productos.length === 0 && (
              <div className="col-span-full text-center py-12">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">
                  No hay productos creados aún
                </p>
              </div>
            )}
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Productos;
