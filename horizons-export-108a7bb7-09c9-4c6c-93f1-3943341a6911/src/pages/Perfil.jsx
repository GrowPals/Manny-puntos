
import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { LogOut, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProductsList from '@/components/ProductsList';

const Perfil = () => {
  const { user, logout } = useAuth();
  const telefonoMasked = user?.telefono ? `${user.telefono.slice(0, 3)}***${user.telefono.slice(-4)}` : '';

  return (
    <>
      <Helmet>
        <title>Tienda - Manny</title>
        <meta name="description" content="Explora y compra productos increíbles en la tienda de Manny." />
      </Helmet>

      <div className="min-h-screen flex flex-col">
        <Header />
        
        <main className="flex-1 container mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
                    ¡Bienvenido a la tienda!
                  </h1>
                  <p className="text-gray-600">Usuario: {telefonoMasked}</p>
                </div>
                <Button
                  onClick={logout}
                  variant="outline"
                  className="rounded-xl"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Cerrar sesión
                </Button>
              </div>
            </div>
          </motion.div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mb-4">
              <Gift className="w-6 h-6 text-orange-500" />
              Nuestros Productos
            </h2>
            <ProductsList />
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Perfil;
