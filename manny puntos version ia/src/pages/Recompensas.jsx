
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Gift, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNotionAPI } from '@/context/NotionAPIContext';
import ProductCard from '@/components/ProductCard';

const Recompensas = () => {
  const { user } = useAuth();
  const api = useNotionAPI();
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProductos = async () => {
      try {
        setLoading(true);
        const prods = await api.getProductosCanje();
        setProductos(prods.filter(p => p.activo));
      } catch (error) {
        console.error("Error fetching productos", error);
      } finally {
        setLoading(false);
      }
    };
    if (api) {
        fetchProductos();
    }
  }, [api]);

  return (
    <>
      <Helmet>
        <title>Recompensas - Catálogo Manny</title>
        <meta name="description" content="Canjea tus puntos Manny por productos y servicios exclusivos." />
      </Helmet>

      <div className="container mx-auto px-4 md:px-4 py-4 md:py-8">
         <div className="mb-6">
          <h1 className="text-3xl md:text-4xl flex items-center gap-2">
            <Gift className="w-8 h-8 text-primary" />
            Catálogo de Recompensas
          </h1>
        </div>

        {loading ? (
           <div className="text-center py-12"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary" /></div>
        ) : (
          productos.length > 0 ? (
            <div className="space-y-4 mb-12 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:gap-6 md:space-y-0">
              {productos.map((producto) => (
                <ProductCard
                  key={producto.id}
                  producto={producto}
                  userPoints={user?.puntos_actuales || 0}
                />
              ))}
            </div>
          ) : (
            <div className="col-span-full text-center py-12 bg-card rounded-2xl shadow-md border border-border">
                <Gift className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-lg">Pronto tendremos nuevas recompensas para ti.</p>
            </div>
          )
        )}
      </div>
    </>
  );
};

export default Recompensas;
