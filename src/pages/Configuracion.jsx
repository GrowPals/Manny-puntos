import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Settings, Bell, BellOff, ChevronRight, Smartphone, HelpCircle, LogOut, User } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/context/AuthContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const Configuracion = () => {
  const { user, logout } = useAuth();
  const {
    isSupported,
    permission,
    isLoading,
    isSubscribed,
    requestPermission,
    unsubscribe,
    showLocalNotification
  } = usePushNotifications(user?.id);

  const handleNotificationToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      const result = await requestPermission();
      if (result.success) {
        await showLocalNotification('¡Notificaciones activadas!', {
          body: 'Recibirás alertas sobre tus puntos y recompensas',
          tag: 'welcome-notification'
        });
      }
    }
  };

  return (
    <>
      <Helmet>
        <title>Configuración - Manny Rewards</title>
        <meta name="description" content="Configura tus preferencias de la aplicación Manny Rewards." />
      </Helmet>

      <div className="space-y-6 pb-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Settings className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Configuración</h1>
            <p className="text-sm text-muted-foreground">Tu cuenta y preferencias</p>
          </div>
        </motion.div>

        {/* Info de la cuenta */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-2xl border border-border overflow-hidden"
        >
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              Tu cuenta
            </h2>
          </div>

          <div className="divide-y divide-border">
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Nombre</p>
                <p className="text-xs text-muted-foreground">{user?.nombre || 'No disponible'}</p>
              </div>
            </div>
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Teléfono</p>
                <p className="text-xs text-muted-foreground">{user?.telefono || 'No disponible'}</p>
              </div>
            </div>
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Nivel</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.nivel || 'Estándar'}</p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Notificaciones */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-2xl border border-border overflow-hidden"
        >
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              Notificaciones
            </h2>
          </div>

          <div className="p-4 space-y-4">
            {isSupported ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">Notificaciones push</p>
                    <p className="text-xs text-muted-foreground">
                      Recibe alertas sobre puntos, recompensas y promociones
                    </p>
                  </div>
                  {permission === 'denied' ? (
                    <div className="flex items-center gap-2 text-destructive">
                      <BellOff className="w-4 h-4" />
                      <span className="text-xs">Bloqueadas</span>
                    </div>
                  ) : (
                    <Switch
                      checked={isSubscribed}
                      onCheckedChange={handleNotificationToggle}
                      disabled={isLoading}
                    />
                  )}
                </div>

                {permission === 'denied' && (
                  <div className="p-3 bg-destructive/10 rounded-lg">
                    <p className="text-xs text-destructive">
                      Las notificaciones están bloqueadas. Para habilitarlas, ve a la configuración de tu navegador y permite notificaciones para este sitio.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Smartphone className="w-5 h-5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Tu navegador no soporta notificaciones push. Instala la app para recibir alertas.
                </p>
              </div>
            )}
          </div>
        </motion.section>

        {/* Acciones */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-2xl border border-border overflow-hidden"
        >
          <Link
            to="/ayuda"
            className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors border-b border-border"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <HelpCircle className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Centro de Ayuda</p>
                <p className="text-xs text-muted-foreground">Preguntas frecuentes y contacto</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </Link>

          <button
            onClick={logout}
            className="w-full flex items-center justify-between p-4 hover:bg-destructive/5 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <LogOut className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-medium text-destructive">Cerrar sesión</p>
                <p className="text-xs text-muted-foreground">Salir de tu cuenta</p>
              </div>
            </div>
          </button>
        </motion.section>

        {/* Versión */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center text-xs text-muted-foreground py-4"
        >
          <p>Manny Rewards v1.0.0</p>
        </motion.div>
      </div>
    </>
  );
};

export default Configuracion;
