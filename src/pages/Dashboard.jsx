import { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Coins, Gift, History, LogOut, Loader2, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import ProductCard from '@/components/features/ProductCard';
import ServicesList from '@/components/features/ServicesList';
import NotificationSettings from '@/components/NotificationSettings';
import ReferralCard from '@/components/features/ReferralCard';
import MisBeneficiosCard from '@/components/features/MisBeneficiosCard';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/EmptyState';
import { useProducts } from '@/hooks/useProducts';
import { useToast } from '@/components/ui/use-toast';
import { logger } from '@/lib/logger';

const Dashboard = () => {
  const { user, logout, isPartner, isVIP } = useAuth();
  const { productos, loading, error } = useProducts();
  const { toast } = useToast();

  // Handle products loading error
  useEffect(() => {
    if (error) {
      logger.error('Error loading products', { error: error.message });
      toast({
        title: 'Error',
        description: 'No pudimos cargar el catálogo de recompensas.',
        variant: 'destructive',
      });
    }
  }, [error, toast]);

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

      <div className="space-y-4 pb-4">
        {/* Hero Section - Compact and impactful */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl shadow-lg border border-border overflow-hidden"
        >
          {/* User greeting + Points in one compact header */}
          <div className="p-4 pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight truncate">
                  ¡Hola, {firstName}!
                </h1>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-muted-foreground text-xs">Tel: {telefonoMasked}</p>
                  {(isPartner || isVIP) && (
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                      isVIP
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-500'
                        : 'border-primary/30 bg-primary/10 text-primary'
                    }`}>
                      {isVIP ? 'VIP' : 'Partner'}
                    </span>
                  )}
                </div>
              </div>
              {/* Desktop navigation */}
              <nav className="hidden lg:flex items-center gap-2" aria-label="Navegación principal">
                <Link to="/mis-servicios" aria-label="Ver historial de servicios">
                  <Button variant="outline" size="sm">
                    <Wrench className="w-4 h-4 mr-1.5" aria-hidden="true" />
                    Servicios
                  </Button>
                </Link>
                <Link to="/mis-canjes" aria-label="Ver historial de canjes">
                  <Button variant="outline" size="sm">
                    <History className="w-4 h-4 mr-1.5" aria-hidden="true" />
                    Canjes
                  </Button>
                </Link>
                <Button onClick={logout} variant="destructive" size="sm" aria-label="Cerrar sesión">
                  <LogOut className="w-4 h-4 mr-1.5" aria-hidden="true" />
                  Salir
                </Button>
              </nav>
            </div>
          </div>

          {/* Points display - Compact gradient card */}
          <div className="hero mx-4 mb-4 rounded-xl p-4 text-white" role="region" aria-label="Resumen de puntos">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 opacity-90" aria-hidden="true" />
                <span className="text-sm opacity-90">Tus puntos Manny</span>
              </div>
              {user?.ultimo_servicio && (
                <span className="text-[10px] opacity-70 hidden sm:block">
                  Última acumulación: {user.ultimo_servicio}
                </span>
              )}
            </div>
            <p className="text-4xl md:text-5xl font-black mt-1" aria-live="polite">
              {user?.puntos_actuales !== undefined ? user.puntos_actuales.toLocaleString('es-MX') : <Loader2 className="w-8 h-8 animate-spin" aria-label="Cargando puntos" />}
            </p>
          </div>

          {/* Notification settings */}
          <div className="px-4 pb-4">
            <NotificationSettings clienteId={user?.id} />
          </div>
        </motion.section>

        {/* Services for Partner/VIP */}
        {showServices && <ServicesList />}

        {/* Benefits from gifts (guardables - cliente activa cuando quiera) */}
        <MisBeneficiosCard />

        {/* Referral Card */}
        <ReferralCard />

        {/* Rewards Catalog */}
        <section aria-labelledby="catalog-heading">
          <div className="flex items-center gap-2 mb-3">
            <Gift className="w-5 h-5 text-primary" aria-hidden="true" />
            <h2 id="catalog-heading" className="text-lg font-bold">Catálogo de Recompensas</h2>
          </div>

          {loading ? (
            <LoadingSpinner size="sm" />
          ) : productos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {productos.map((producto) => (
                <ProductCard
                  key={producto.id}
                  producto={producto}
                  userPoints={user?.puntos_actuales || 0}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Gift}
              title="Sin recompensas disponibles"
              description="Pronto tendremos nuevas recompensas para ti."
            />
          )}
        </section>
      </div>
    </>
  );
};

export default Dashboard;
