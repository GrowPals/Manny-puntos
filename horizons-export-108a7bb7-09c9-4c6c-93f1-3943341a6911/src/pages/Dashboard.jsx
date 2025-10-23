
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Coins, Gift, History, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useNotionAPI } from '@/context/NotionAPIContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const { getProductosCanje } = useNotionAPI();
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProductos = async () => {
      try {
        setLoading(true);
        const prods = await getProductosCanje();
        setProductos(prods);
      } catch (error) {
        console.error("Error fetching productos", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProductos();
  }, [getProductosCanje]);

  const telefonoMasked = user?.telefono ? `${user.telefono.slice(0, 3)}***${user.telefono.slice(-4)}` : '';

  return (
    <>
      <Helmet>
        <title>Dashboard - Mis Recompensas Manny</title>
        <meta name="description" content="Consulta tus puntos Manny y canjea productos y servicios exclusivos." />
      </Helmet>

      <div className="min-h-screen flex flex-col">
        <Header />
        
        <main className="flex-1 container mx-auto px-4 py-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="bg-secondary rounded-3xl shadow-xl p-6 md:p-8">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                  <h1 className="text-2xl md:text-3xl mb-2">
                    ¡Hola, {user?.nombre?.split(' ')[0]}! 👋
                  </h1>
                  <p className="text-gray-400">Tel: {telefonoMasked}</p>
                </div>
                 <div className="flex items-center gap-4">
                  <Link to="/mis-canjes">
                    <Button variant="outline" className="rounded-xl">
                      <History className="w-4 h-4 mr-2" />
                      Mis Canjes
                    </Button>
                  </Link>
                  <Button onClick={logout} variant="destructive" className="rounded-xl">
                    <LogOut className="w-4 h-4 mr-2" />
                    Salir
                  </Button>
                </div>
              </div>

              <div className="hero rounded-2xl p-6 text-white">
                <div className="flex items-center gap-3 mb-2">
                  <Coins className="w-8 h-8" />
                  <span className="text-lg opacity-90">Tus puntos Manny disponibles</span>
                </div>
                <p className="text-5xl md:text-6xl font-black">
                  {user?.puntos_actuales || 0}
                </p>
                {user?.ultimo_servicio && (
                   <p className="text-sm opacity-80 mt-2">Última acumulación por: {user.ultimo_servicio}</p>
                )}
              </div>
            </div>
          </motion.div>

          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-2xl flex items-center gap-2">
              <Gift className="w-6 h-6 text-primary" />
              Catálogo de Recompensas
            </h2>
          </div>

          {loading ? (
             <p className="text-center py-12 text-gray-500">Cargando recompensas...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {productos.map((producto) => (
                <ProductCard
                  key={producto.id}
                  producto={producto}
                  userPoints={user?.puntos_actuales || 0}
                />
              ))}
              {productos.length === 0 && (
                <div className="col-span-full text-center py-12 bg-secondary rounded-2xl shadow-md">
                    <Gift className="w-16 h-16 mx-auto text-gray-600 mb-4" />
                    <p className="text-gray-500 text-lg">Pronto tendremos nuevas recompensas para ti.</p>
                </div>
              )}
            </div>
          )}
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Dashboard;
