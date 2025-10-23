
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ShoppingBag, Check, X, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const Canjes = () => {
  const { toast } = useToast();
  const [canjes, setCanjes] = useState([]);

  useEffect(() => {
    loadCanjes();
  }, []);

  const loadCanjes = () => {
    setCanjes(JSON.parse(localStorage.getItem('manny_canjes') || '[]'));
  };

  const actualizarEstado = (id, nuevoEstado) => {
    const updated = canjes.map(c => 
      c.id === id ? { ...c, estado: nuevoEstado } : c
    );
    localStorage.setItem('manny_canjes', JSON.stringify(updated));
    setCanjes(updated);
    
    const mensajes = {
      'aprobado': 'Canje aprobado correctamente',
      'entregado': 'Canje marcado como entregado',
      'cancelado': 'Canje cancelado'
    };
    
    toast({
      title: "Estado actualizado",
      description: mensajes[nuevoEstado]
    });
  };

  const getEstadoBadge = (estado) => {
    const badges = {
      'pendiente': 'bg-yellow-100 text-yellow-700',
      'aprobado': 'bg-blue-100 text-blue-700',
      'entregado': 'bg-green-100 text-green-700',
      'cancelado': 'bg-red-100 text-red-700'
    };
    return badges[estado] || badges.pendiente;
  };

  return (
    <>
      <Helmet>
        <title>Canjes Pendientes - Manny</title>
        <meta name="description" content="Gestiona las solicitudes de canje de productos" />
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
              <ShoppingBag className="w-8 h-8 text-orange-500" />
              Canjes Pendientes
            </h1>
            <p className="text-gray-600">Gestiona las solicitudes de canje de productos</p>
          </motion.div>

          <div className="space-y-4">
            {canjes.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).map((canje) => (
              <motion.div
                key={canje.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-2xl shadow-lg p-6"
              >
                <div className="flex flex-col lg:flex-row justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-xl font-bold text-gray-800 mb-1">
                          {canje.producto_nombre}
                        </h3>
                        <p className="text-gray-600">Cliente: {canje.cliente_telefono}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getEstadoBadge(canje.estado)}`}>
                        {canje.estado.charAt(0).toUpperCase() + canje.estado.slice(1)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Puntos usados:</span>
                        <p className="font-semibold text-orange-600">{canje.puntos_usados} pts</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Fecha:</span>
                        <p className="font-semibold text-gray-800">
                          {new Date(canje.fecha).toLocaleDateString('es-MX')}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {canje.estado === 'pendiente' && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        onClick={() => actualizarEstado(canje.id, 'aprobado')}
                        className="rounded-xl bg-blue-600 hover:bg-blue-700"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Aprobar
                      </Button>
                      <Button
                        onClick={() => actualizarEstado(canje.id, 'cancelado')}
                        variant="destructive"
                        className="rounded-xl"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancelar
                      </Button>
                    </div>
                  )}
                  
                  {canje.estado === 'aprobado' && (
                    <Button
                      onClick={() => actualizarEstado(canje.id, 'entregado')}
                      className="rounded-xl bg-green-600 hover:bg-green-700"
                    >
                      <Package className="w-4 h-4 mr-2" />
                      Marcar entregado
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
            {canjes.length === 0 && (
              <div className="text-center py-12">
                <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">
                  No hay canjes registrados
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

export default Canjes;
