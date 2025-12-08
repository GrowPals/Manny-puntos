import React, { useState, useRef, useEffect } from 'react';
import { Bell, BellOff, BellRing, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { motion, AnimatePresence } from 'framer-motion';

const NotificationBell = ({ clienteId, isAdmin = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
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

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close popover when clicking outside (desktop only)
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen && !isMobile) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, isMobile]);

  // Prevent body scroll when mobile modal is open
  useEffect(() => {
    if (isOpen && isMobile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen, isMobile]);

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

      {/* Mobile: Bottom Sheet with Backdrop */}
      <AnimatePresence>
        {isOpen && isMobile && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/50 z-40"
            />
            {/* Bottom Sheet */}
            <motion.div
              initial={{ opacity: 0, y: '100%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 bg-card rounded-t-2xl shadow-2xl overflow-hidden safe-area-inset-bottom"
            >
              {/* Drag Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pb-3 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <BellRing className="w-5 h-5 text-primary" />
                  </div>
                  <span className="font-semibold text-base">Notificaciones</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="h-9 w-9"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Content */}
              <div className="px-5 py-6 pb-8">
                {isDenied ? (
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full flex items-center justify-center mb-4">
                      <BellOff className="w-8 h-8 text-destructive/70" />
                    </div>
                    <p className="text-base font-semibold text-destructive">Notificaciones bloqueadas</p>
                    <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
                      Para activarlas, ve a la configuración de tu navegador y permite las notificaciones para este sitio.
                    </p>
                  </div>
                ) : isEnabled ? (
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto bg-green-500/10 rounded-full flex items-center justify-center mb-4">
                      <Bell className="w-8 h-8 text-green-500" />
                    </div>
                    <p className="text-base font-semibold text-foreground">Notificaciones activas</p>
                    <p className="text-sm text-muted-foreground mt-2 mb-6 max-w-xs mx-auto">
                      Recibirás alertas sobre tus puntos y recompensas
                    </p>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={handleToggleNotifications}
                      disabled={isLoading}
                      className="w-full h-12 text-base"
                    >
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        'Desactivar notificaciones'
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
                      <BellOff className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-base font-semibold text-foreground">
                      {permission === 'granted' ? 'Notificaciones pausadas' : 'Notificaciones desactivadas'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2 mb-6 max-w-xs mx-auto">
                      {permission === 'granted'
                        ? 'Reactívalas para seguir recibiendo alertas de tus puntos'
                        : 'Actívalas para recibir alertas importantes sobre tus puntos y recompensas'
                      }
                    </p>
                    <Button
                      variant="investment"
                      size="lg"
                      onClick={handleToggleNotifications}
                      disabled={isLoading}
                      className="w-full h-12 text-base"
                    >
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Bell className="w-5 h-5 mr-2" />
                          {permission === 'granted' ? 'Reactivar' : 'Activar notificaciones'}
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop: Popover */}
      <AnimatePresence>
        {isOpen && !isMobile && (
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
