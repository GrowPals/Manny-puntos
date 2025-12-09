/**
 * AppDownloadStep Component
 *
 * Paso post-regalo para instalar PWA y activar notificaciones
 * Diseñado para maximizar conversión sin frustrar al usuario
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Smartphone,
  Bell,
  Download,
  CheckCircle2,
  ChevronRight,
  Share,
  Plus,
  Gift,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/customSupabaseClient';
import { logger } from '@/lib/logger';
import {
  VAPID_PUBLIC_KEY,
  getDeviceInfo,
  getOrCreateSubscription,
  extractSubscriptionKeys
} from '@/lib/pushUtils';

const AppDownloadStep = ({
  onComplete,
  clienteId,
  colorTema = '#E91E63',
  benefitText = 'tu regalo'
}) => {
  const [appInstalled, setAppInstalled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isEnablingNotifs, setIsEnablingNotifs] = useState(false);
  const [showComplete, setShowComplete] = useState(false);

  const handleComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  // Forzar modo claro
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    const meta = document.querySelector('meta[name="color-scheme"]') || document.createElement('meta');
    meta.name = 'color-scheme';
    meta.content = 'light';
    if (!meta.parentNode) document.head.appendChild(meta);
    return () => { meta.content = 'light dark'; };
  }, []);

  // Detectar estado inicial
  useEffect(() => {
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone
      || document.referrer.includes('android-app://');

    if (standalone) {
      setAppInstalled(true);
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      setNotificationsEnabled(true);
    }

    // Si ya tiene ambos, completar
    if (standalone && Notification.permission === 'granted') {
      setShowComplete(true);
      setTimeout(handleComplete, 1500);
    }

    // Escuchar prompt de instalación
    const handlePrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handlePrompt);
    return () => window.removeEventListener('beforeinstallprompt', handlePrompt);
  }, [handleComplete]);

  // Instalar app
  const handleInstall = async () => {
    if (!deferredPrompt) {
      // En iOS o si no hay prompt, marcar como "hecho" para continuar
      setAppInstalled(true);
      return;
    }

    setIsInstalling(true);
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setAppInstalled(true);
        setDeferredPrompt(null);
      }
    } catch (err) {
      logger.error('Install error', { error: err.message });
    } finally {
      setIsInstalling(false);
    }
  };

  // Activar notificaciones
  const handleEnableNotifications = async () => {
    if (!('Notification' in window)) {
      setNotificationsEnabled(true);
      return;
    }

    setIsEnablingNotifs(true);
    try {
      const permission = await Notification.requestPermission();

      if (permission === 'granted') {
        setNotificationsEnabled(true);

        // Registrar push subscription
        if (clienteId && VAPID_PUBLIC_KEY) {
          try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await getOrCreateSubscription(registration);
            const keys = extractSubscriptionKeys(subscription);

            await supabase.from('push_subscriptions').upsert({
              cliente_id: clienteId,
              ...keys,
              is_admin: false,
              device_info: getDeviceInfo(),
              updated_at: new Date().toISOString()
            }, { onConflict: 'endpoint' });
          } catch (pushErr) {
            logger.warn('Push subscription failed', { error: pushErr.message });
          }
        }
      } else {
        // Si deniega, igual marcamos como "intentado" para poder continuar
        setNotificationsEnabled(true);
      }
    } catch (err) {
      logger.error('Notification error', { error: err.message });
      setNotificationsEnabled(true);
    } finally {
      setIsEnablingNotifs(false);
    }
  };

  // Continuar cuando ambos estén listos
  const handleContinue = () => {
    setShowComplete(true);
    setTimeout(handleComplete, 1500);
  };

  // Verificar si puede continuar
  const canContinue = appInstalled && notificationsEnabled;

  // Pantalla de completado
  if (showComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-pink-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.1 }}
            className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle2 className="w-12 h-12 text-white" />
          </motion.div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">¡Todo listo!</h2>
          <p className="text-gray-600">Entrando a tu cuenta...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-pink-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-gray-200 shadow-xl"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: `linear-gradient(135deg, ${colorTema}, #9C27B0)` }}
          >
            <Gift className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            ¡Ya tienes {benefitText}!
          </h2>
          <p className="text-gray-600 mt-1">
            Completa estos pasos para acceder
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-4 mb-6">
          {/* Step 1: Instalar App */}
          <div className={`p-4 rounded-xl border-2 transition-all ${
            appInstalled
              ? 'border-green-500 bg-green-50'
              : 'border-gray-200 bg-gray-50'
          }`}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                appInstalled ? 'bg-green-500' : 'bg-gray-200'
              }`}>
                {appInstalled ? (
                  <CheckCircle2 className="w-6 h-6 text-white" />
                ) : (
                  <Smartphone className="w-6 h-6 text-gray-500" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">Instalar App</p>
                <p className="text-sm text-gray-500">Acceso rápido desde tu pantalla</p>
              </div>

              {!appInstalled && (
                isIOS ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleInstall}
                    className="shrink-0"
                  >
                    <Share className="w-4 h-4 mr-1" />
                    Listo
                  </Button>
                ) : deferredPrompt ? (
                  <Button
                    size="sm"
                    onClick={handleInstall}
                    disabled={isInstalling}
                    style={{ background: colorTema }}
                    className="shrink-0"
                  >
                    {isInstalling ? '...' : (
                      <>
                        <Download className="w-4 h-4 mr-1" />
                        Instalar
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleInstall}
                    className="shrink-0"
                  >
                    Listo
                  </Button>
                )
              )}
            </div>

            {/* iOS Instructions */}
            {!appInstalled && isIOS && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-500 mb-2">En Safari:</p>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <div className="flex items-center gap-1 bg-white px-2 py-1 rounded border">
                    <Share className="w-3 h-3" />
                    <span>Compartir</span>
                  </div>
                  <ChevronRight className="w-3 h-3" />
                  <div className="flex items-center gap-1 bg-white px-2 py-1 rounded border">
                    <Plus className="w-3 h-3" />
                    <span>Agregar a inicio</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Notificaciones */}
          <div className={`p-4 rounded-xl border-2 transition-all ${
            notificationsEnabled
              ? 'border-green-500 bg-green-50'
              : 'border-gray-200 bg-gray-50'
          }`}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                notificationsEnabled ? 'bg-green-500' : 'bg-gray-200'
              }`}>
                {notificationsEnabled ? (
                  <CheckCircle2 className="w-6 h-6 text-white" />
                ) : (
                  <Bell className="w-6 h-6 text-gray-500" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">Notificaciones</p>
                <p className="text-sm text-gray-500">Entérate de puntos y promos</p>
              </div>

              {!notificationsEnabled && (
                <Button
                  size="sm"
                  onClick={handleEnableNotifications}
                  disabled={isEnablingNotifs}
                  style={{ background: colorTema }}
                  className="shrink-0"
                >
                  {isEnablingNotifs ? '...' : 'Activar'}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Continue Button */}
        <Button
          size="lg"
          className="w-full text-lg py-6"
          onClick={handleContinue}
          disabled={!canContinue}
          style={{
            background: canContinue
              ? `linear-gradient(to right, ${colorTema}, #9C27B0)`
              : undefined,
            opacity: canContinue ? 1 : 0.5
          }}
        >
          {canContinue ? (
            <>
              Continuar
              <ArrowRight className="w-5 h-5 ml-2" />
            </>
          ) : (
            'Completa los pasos'
          )}
        </Button>

        {/* Progress indicator */}
        <div className="flex justify-center gap-2 mt-4">
          <div className={`w-3 h-3 rounded-full ${appInstalled ? 'bg-green-500' : 'bg-gray-300'}`} />
          <div className={`w-3 h-3 rounded-full ${notificationsEnabled ? 'bg-green-500' : 'bg-gray-300'}`} />
        </div>
      </motion.div>
    </div>
  );
};

export default AppDownloadStep;
