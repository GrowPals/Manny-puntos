import React, { useState, useRef, useEffect } from 'react';
import { Bell, BellOff, BellRing, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { motion, AnimatePresence } from 'framer-motion';

const NotificationBell = ({ clienteId, isAdmin = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef(null);

  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    requestPermission,
    unsubscribe,
    showLocalNotification
  } = usePushNotifications(clienteId, isAdmin);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleToggleNotifications = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      const result = await requestPermission();
      if (result.success) {
        await showLocalNotification('Notificaciones activadas', {
          body: 'Recibirás alertas sobre tus puntos y recompensas',
          tag: 'welcome-notification'
        });
        setIsOpen(false);
      }
    }
  };

  // Don't render if not supported
  if (!isSupported) {
    return null;
  }

  // isEnabled = tiene permiso Y tiene suscripción activa
  const isEnabled = permission === 'granted' && isSubscribed;
  const isDenied = permission === 'denied';
  // Puede activar si tiene permiso pero no suscripción, o si aún no ha pedido permiso
  const canActivate = permission !== 'denied' && !isSubscribed;

  return (
    <div className="relative" ref={popoverRef}>
      {/* Bell Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="h-9 w-9 relative"
        aria-label="Notificaciones"
      >
        {isEnabled ? (
          <Bell className="w-5 h-5 text-primary" />
        ) : (
          <BellOff className="w-5 h-5 text-muted-foreground" />
        )}
        {/* Indicator dot - show when can activate */}
        {canActivate && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
        )}
      </Button>

      {/* Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-72 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">Notificaciones</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-7 w-7"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="p-4">
              {isDenied ? (
                <div className="text-center py-2">
                  <BellOff className="w-10 h-10 mx-auto text-destructive/50 mb-2" />
                  <p className="text-sm font-medium text-destructive">Bloqueadas</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Para activarlas, ve a la configuración de tu navegador
                  </p>
                </div>
              ) : isEnabled ? (
                <div className="text-center py-2">
                  <div className="w-12 h-12 mx-auto bg-green-500/10 rounded-full flex items-center justify-center mb-3">
                    <Bell className="w-6 h-6 text-green-500" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Notificaciones activas</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">
                    Recibirás alertas sobre puntos y recompensas
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleToggleNotifications}
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Desactivar'
                    )}
                  </Button>
                </div>
              ) : (
                <div className="text-center py-2">
                  <div className="w-12 h-12 mx-auto bg-muted rounded-full flex items-center justify-center mb-3">
                    <BellOff className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {permission === 'granted' ? 'Notificaciones pausadas' : 'Notificaciones desactivadas'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">
                    {permission === 'granted'
                      ? 'Reactívalas para seguir recibiendo alertas'
                      : 'Actívalas para recibir alertas importantes'
                    }
                  </p>
                  <Button
                    variant="investment"
                    size="sm"
                    onClick={handleToggleNotifications}
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Bell className="w-4 h-4 mr-2" />
                        {permission === 'granted' ? 'Reactivar' : 'Activar notificaciones'}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;
