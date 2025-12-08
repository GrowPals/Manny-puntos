/**
 * AppDownloadStep Component
 *
 * Paso obligatorio después de reclamar un regalo/referido
 * Guía al usuario a instalar la PWA y activar notificaciones
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Smartphone,
  Bell,
  Download,
  CheckCircle2,
  ChevronRight,
  Share,
  Plus,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/customSupabaseClient';
import { logger } from '@/lib/logger';
import {
  VAPID_PUBLIC_KEY,
  urlBase64ToUint8Array,
  getDeviceInfo,
  getOrCreateSubscription,
  extractSubscriptionKeys
} from '@/lib/pushUtils';

// Pre-generate particle positions to avoid re-renders
const PARTICLES = Array.from({ length: 15 }, (_, i) => ({
  id: i,
  hue: Math.random() * 60 + 320,
  left: Math.random() * 100,
  top: Math.random() * 100,
  duration: 3 + Math.random() * 2,
  delay: Math.random() * 2,
}));

const AppDownloadStep = ({
  onComplete,
  clienteId,
  colorTema = '#E91E63',
  benefitText = 'Tu regalo'
}) => {
  const [step, setStep] = useState('install'); // 'install' | 'notifications' | 'complete'
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState('default');
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  // Detectar plataforma y estado de instalación
  useEffect(() => {
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone
      || document.referrer.includes('android-app://');

    // Si ya está instalada, saltar a notificaciones
    if (standalone) {
      setStep('notifications');
    }

    // Check notification permission
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
      // Si ya tiene notificaciones, completar
      if (Notification.permission === 'granted' && standalone) {
        setTimeout(() => onComplete(), 500);
      }
    }

    // Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [onComplete]);

  // Instalar PWA (Android/Desktop)
  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      // Pequeño delay para que se sienta la transición
      setTimeout(() => setStep('notifications'), 500);
    }
  };

  // Continuar sin instalar (permite skip pero lo hace menos obvio)
  const handleSkipInstall = () => {
    setStep('notifications');
  };

  // Solicitar permisos de notificación
  const handleRequestNotifications = async () => {
    if (!('Notification' in window)) {
      setStep('complete');
      setTimeout(() => onComplete(), 1500);
      return;
    }

    setIsRequestingPermission(true);

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === 'granted' && clienteId) {
        // Registrar suscripción push usando utilidades compartidas
        try {
          if (VAPID_PUBLIC_KEY) {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await getOrCreateSubscription(registration);
            const keys = extractSubscriptionKeys(subscription);

            // Guardar en Supabase
            await supabase.from('push_subscriptions').upsert({
              cliente_id: clienteId,
              ...keys,
              is_admin: false, // Siempre false aquí - solo clientes llegan por gift/referral
              device_info: getDeviceInfo(),
              updated_at: new Date().toISOString()
            }, { onConflict: 'endpoint' });
          }
        } catch (pushError) {
          logger.warn('[AppDownloadStep] Push subscription failed', { error: pushError.message });
        }
      }

      setStep('complete');
      setTimeout(() => onComplete(), 1500);
    } catch (err) {
      logger.error('Error requesting notification permission', { error: err.message });
      setStep('complete');
      setTimeout(() => onComplete(), 1500);
    } finally {
      setIsRequestingPermission(false);
    }
  };

  // Continuar sin notificaciones
  const handleSkipNotifications = () => {
    setStep('complete');
    setTimeout(() => onComplete(), 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 relative overflow-hidden flex items-center justify-center p-4">
      {/* Background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {PARTICLES.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute w-2 h-2 rounded-full"
            style={{
              background: `hsl(${particle.hue}, 80%, 60%)`,
              left: `${particle.left}%`,
              top: `${particle.top}%`,
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [0.2, 0.6, 0.2],
            }}
            transition={{
              duration: particle.duration,
              repeat: Infinity,
              delay: particle.delay,
            }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* STEP: Install App */}
        {step === 'install' && (
          <motion.div
            key="install"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="bg-card/90 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full border border-border shadow-2xl text-center"
          >
            {/* Progress indicator */}
            <div className="flex justify-center gap-2 mb-6">
              <div className="w-8 h-1 rounded-full" style={{ backgroundColor: colorTema }} />
              <div className="w-8 h-1 rounded-full bg-muted" />
            </div>

            {/* Icon */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className="mx-auto w-24 h-24 rounded-full flex items-center justify-center mb-6"
              style={{ background: `linear-gradient(135deg, ${colorTema}, #9C27B0)` }}
            >
              <Smartphone className="w-12 h-12 text-white" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Instala la App
              </h2>
              <p className="text-muted-foreground mb-6">
                Accede a {benefitText} y tus puntos desde tu pantalla de inicio
              </p>
            </motion.div>

            {/* Benefits list */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-3 mb-8 text-left"
            >
              {[
                'Acceso rápido con un solo toque',
                'Funciona sin conexión',
                'Recibe alertas de tus puntos'
              ].map((benefit, i) => (
                <div key={i} className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                  <span className="text-sm text-foreground">{benefit}</span>
                </div>
              ))}
            </motion.div>

            {/* Install buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="space-y-3"
            >
              {isIOS ? (
                // iOS Instructions
                <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-medium text-foreground">
                    Para instalar en iPhone/iPad:
                  </p>
                  <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1 bg-background px-3 py-2 rounded-lg">
                      <Share className="w-4 h-4" />
                      <span>Compartir</span>
                    </div>
                    <ChevronRight className="w-4 h-4" />
                    <div className="flex items-center gap-1 bg-background px-3 py-2 rounded-lg">
                      <Plus className="w-4 h-4" />
                      <span>Agregar a inicio</span>
                    </div>
                  </div>
                  <Button
                    onClick={handleSkipInstall}
                    variant="outline"
                    className="w-full mt-4"
                  >
                    Ya lo instalé
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              ) : deferredPrompt ? (
                // Android/Desktop with prompt available
                <Button
                  onClick={handleInstall}
                  size="lg"
                  className="w-full text-lg py-6"
                  style={{ background: `linear-gradient(to right, ${colorTema}, #9C27B0)` }}
                >
                  <Download className="w-5 h-5 mr-2" />
                  Instalar App Gratis
                </Button>
              ) : (
                // Android without prompt (likely already installed or not supported)
                <Button
                  onClick={handleSkipInstall}
                  size="lg"
                  className="w-full text-lg py-6"
                  style={{ background: `linear-gradient(to right, ${colorTema}, #9C27B0)` }}
                >
                  Continuar
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}

              {!isIOS && deferredPrompt && (
                <button
                  onClick={handleSkipInstall}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Continuar en el navegador
                </button>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* STEP: Enable Notifications */}
        {step === 'notifications' && (
          <motion.div
            key="notifications"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="bg-card/90 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full border border-border shadow-2xl text-center"
          >
            {/* Progress indicator */}
            <div className="flex justify-center gap-2 mb-6">
              <div className="w-8 h-1 rounded-full bg-green-500" />
              <div className="w-8 h-1 rounded-full" style={{ backgroundColor: colorTema }} />
            </div>

            {/* Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className="mx-auto w-24 h-24 rounded-full flex items-center justify-center mb-6 relative"
              style={{ background: `linear-gradient(135deg, ${colorTema}, #9C27B0)` }}
            >
              <Bell className="w-12 h-12 text-white" />
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -top-1 -right-1"
              >
                <Sparkles className="w-6 h-6 text-yellow-400" />
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Activa las Notificaciones
              </h2>
              <p className="text-muted-foreground mb-6">
                Te avisamos cuando ganes puntos, tengas promociones o tu regalo esté listo
              </p>
            </motion.div>

            {/* Benefits */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-gradient-to-r from-primary/10 to-purple-500/10 rounded-xl p-4 mb-6 border border-primary/20"
            >
              <p className="text-sm text-foreground">
                <strong>No te pierdas nada:</strong> Te notificamos cuando recibas puntos,
                ofertas especiales o cuando tu servicio esté listo
              </p>
            </motion.div>

            {/* Notification buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="space-y-3"
            >
              {notificationPermission === 'granted' ? (
                <div className="flex items-center justify-center gap-2 text-green-500 py-4">
                  <CheckCircle2 className="w-6 h-6" />
                  <span className="font-medium">Notificaciones activadas</span>
                </div>
              ) : notificationPermission === 'denied' ? (
                <div className="text-sm text-muted-foreground py-4">
                  <p>Las notificaciones están bloqueadas.</p>
                  <p className="mt-1">Puedes habilitarlas desde la configuración de tu navegador.</p>
                </div>
              ) : (
                <Button
                  onClick={handleRequestNotifications}
                  size="lg"
                  className="w-full text-lg py-6"
                  style={{ background: `linear-gradient(to right, ${colorTema}, #9C27B0)` }}
                  disabled={isRequestingPermission}
                >
                  {isRequestingPermission ? (
                    <span className="animate-pulse">Activando...</span>
                  ) : (
                    <>
                      <Bell className="w-5 h-5 mr-2" />
                      Activar Notificaciones
                    </>
                  )}
                </Button>
              )}

              {notificationPermission !== 'granted' && (
                <button
                  onClick={handleSkipNotifications}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Ahora no
                </button>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* STEP: Complete */}
        {step === 'complete' && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-6"
            >
              <CheckCircle2 className="w-12 h-12 text-white" />
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-3xl font-bold text-foreground mb-3"
            >
              ¡Todo listo!
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-lg text-muted-foreground"
            >
              Entrando a tu cuenta...
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AppDownloadStep;
