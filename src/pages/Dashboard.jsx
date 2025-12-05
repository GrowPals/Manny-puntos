
import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Coins, Gift, History, LogOut, Loader2, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import ProductCard from '@/components/features/ProductCard';
import ServicesList from '@/components/features/ServicesList';
import NotificationSettings from '@/components/NotificationSettings';
import { useProducts } from '@/hooks/useProducts';

const Dashboard = () => {
  const { user, logout, isPartner, isVIP } = useAuth();
  const { productos, loading } = useProducts();

  const telefonoMasked = user?.telefono ? `${user.telefono.slice(0, 3)}***${user.telefono.slice(-4)}` : 'No disponible';
  const firstName = user?.nombre?.trim()?.split(' ')[0] || 'Usuario';

  // Mostrar servicios para usuarios Partner o VIP
  const showServices = isPartner || isVIP;


  return (
    <>
      <Helmet>
        <title>Dashboard - Mis Recompensas Manny</title>
        <meta name="description" content="Consulta tus puntos Manny y canjea productos y servicios exclusivos." />
      </Helmet>

      <div className="container mx-auto px-4 md:px-4 py-4 md:py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="bg-card rounded-b-3xl md:rounded-3xl shadow-xl p-6 md:p-8 border-b md:border border-border">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h1 className="text-2xl md:text-3xl mb-1">
                  ¡Hola, {firstName}!
                </h1>
                <p className="text-muted-foreground text-sm">Tel: {telefonoMasked}</p>
                {(isPartner || isVIP) && (
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 mt-2 ${
                    isVIP
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-500'
                      : 'border-purple-500/30 bg-purple-500/10 text-purple-500'
                  }`}>
                    {isVIP ? 'Cliente VIP' : 'Socio Partner'}
                  </span>
                )}
              </div>
               <div className="flex items-center gap-2 sm:gap-4 self-end md:self-center flex-wrap justify-end">
                <Link to="/mis-servicios">
                  <Button variant="outline" size="sm" className="hover:bg-secondary hover:text-foreground">
                    <Wrench className="w-4 h-4 mr-2" />
                    Mis Servicios
                  </Button>
                </Link>
                <Link to="/mis-canjes">
                  <Button variant="outline" size="sm" className="hover:bg-secondary hover:text-foreground">
                    <History className="w-4 h-4 mr-2" />
                    Mis Canjes
                  </Button>
                </Link>
                <Button onClick={logout} variant="destructive" size="sm">
                  <LogOut className="w-4 h-4 mr-2" />
                  Salir
                </Button>
              </div>
            </div>

            <div className="hero rounded-2xl p-6 text-white">
              <div className="flex items-center gap-3 mb-2">
                <Coins className="w-6 md:w-8 h-6 md:h-8" />
                <span className="text-base md:text-lg opacity-90">Tus puntos Manny</span>
              </div>
              <p className="text-5xl md:text-6xl font-black">
                {user?.puntos_actuales !== undefined ? user.puntos_actuales.toLocaleString('es-MX') : <Loader2 className="w-12 h-12 animate-spin" />}
              </p>
              {user?.ultimo_servicio && (
                 <p className="text-xs md:text-sm opacity-80 mt-2">Última acumulación: {user.ultimo_servicio}</p>
              )}
            </div>

            <div className="mt-6">
              <NotificationSettings clienteId={user?.id} />
            </div>
          </div>
        </motion.div>

        {showServices && <ServicesList />}

        <div className="mb-6 px-4 md:px-0 flex justify-between items-center">
          <h2 className="text-2xl flex items-center gap-2">
            <Gift className="w-6 h-6 text-primary" />
            Catálogo de Recompensas
          </h2>
        </div>

        {loading ? (
           <div className="text-center py-12"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary" /></div>
        ) : (
          productos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12 px-4 md:px-0">
              {productos.map((producto) => (
                <ProductCard
                  key={producto.id}
                  producto={producto}
                  userPoints={user?.puntos_actuales || 0}
                />
              ))}
            </div>
          ) : (
            <div className="col-span-full text-center py-12 bg-card rounded-2xl shadow-md border border-border mx-4 md:mx-0">
                <Gift className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-lg">Pronto tendremos nuevas recompensas para ti.</p>
            </div>
          )
        )}
      </div>
    </>
  );
};

export default Dashboard;
