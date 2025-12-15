import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Bell, BellOff, ChevronRight, Smartphone, HelpCircle, LogOut, User, Lock, Shield, Check, Loader2, Eye, EyeOff } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useToast } from '@/components/ui/use-toast';

const Configuracion = () => {
  const { user, logout, checkUserHasPin, registerPin, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const {
    isSupported,
    permission,
    isLoading,
    isSubscribed,
    requestPermission,
    unsubscribe,
    showLocalNotification
  } = usePushNotifications(user?.id);

  // Estado para PIN
  const [hasPin, setHasPin] = useState(user?.has_pin || false);
  const [checkingPin, setCheckingPin] = useState(true);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [savingPin, setSavingPin] = useState(false);
  const [pinStep, setPinStep] = useState(1); // 1: crear, 2: confirmar

  // Verificar si el usuario tiene PIN al cargar
  useEffect(() => {
    const checkPin = async () => {
      if (user?.telefono) {
        setCheckingPin(true);
        const result = await checkUserHasPin();
        setHasPin(result);
        setCheckingPin(false);
      }
    };
    checkPin();
  }, [user?.telefono, checkUserHasPin]);

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

  const handlePinChange = (e, setter) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
    setter(value);
  };

  const handleCreatePin = () => {
    if (pin.length !== 4) {
      toast({
        title: "PIN incompleto",
        description: "El PIN debe tener 4 dígitos",
        variant: "destructive"
      });
      return;
    }
    setPinStep(2);
  };

  const handleConfirmPin = async () => {
    if (confirmPin !== pin) {
      toast({
        title: "Los PIN no coinciden",
        description: "Verifica que ambos PIN sean iguales",
        variant: "destructive"
      });
      setConfirmPin('');
      return;
    }

    setSavingPin(true);
    try {
      await registerPin(pin);
      setHasPin(true);
      setShowPinSetup(false);
      setPin('');
      setConfirmPin('');
      setPinStep(1);
      toast({
        title: "¡PIN creado!",
        description: "Tu cuenta ahora está protegida con PIN"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "No pudimos crear tu PIN",
        variant: "destructive"
      });
    } finally {
      setSavingPin(false);
    }
  };

  const cancelPinSetup = () => {
    setShowPinSetup(false);
    setPin('');
    setConfirmPin('');
    setPinStep(1);
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

        {/* Seguridad - PIN */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card rounded-2xl border border-border overflow-hidden"
        >
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Seguridad
            </h2>
          </div>

          <div className="p-4">
            {checkingPin ? (
              <div className="flex items-center gap-3 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Verificando...</span>
              </div>
            ) : hasPin ? (
              // Ya tiene PIN
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <Check className="w-5 h-5 text-green-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">PIN de seguridad activo</p>
                  <p className="text-xs text-muted-foreground">Tu cuenta está protegida</p>
                </div>
              </div>
            ) : showPinSetup ? (
              // Formulario de creación de PIN
              <AnimatePresence mode="wait">
                {pinStep === 1 ? (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Lock className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Crea tu PIN</p>
                        <p className="text-xs text-muted-foreground">4 dígitos para proteger tu cuenta</p>
                      </div>
                    </div>

                    <div className="relative">
                      <input
                        type={showPin ? "text" : "password"}
                        inputMode="numeric"
                        placeholder="••••"
                        value={pin}
                        onChange={(e) => handlePinChange(e, setPin)}
                        className="w-full h-14 text-2xl font-bold rounded-xl bg-background border-2 border-border text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all text-center tracking-[0.75em] pr-12"
                        maxLength={4}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin(!showPin)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>

                    {/* PIN dots indicator */}
                    <div className="flex justify-center gap-3">
                      {[0, 1, 2, 3].map((index) => (
                        <div
                          key={index}
                          className={`w-2.5 h-2.5 rounded-full transition-all ${
                            index < pin.length ? 'bg-primary scale-100' : 'bg-muted scale-75'
                          }`}
                        />
                      ))}
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button
                        variant="outline"
                        onClick={cancelPinSetup}
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleCreatePin}
                        disabled={pin.length !== 4}
                        className="flex-1"
                      >
                        Continuar
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                        <Check className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Confirma tu PIN</p>
                        <p className="text-xs text-muted-foreground">Ingresa los 4 dígitos nuevamente</p>
                      </div>
                    </div>

                    <div className="relative">
                      <input
                        type={showPin ? "text" : "password"}
                        inputMode="numeric"
                        placeholder="••••"
                        value={confirmPin}
                        onChange={(e) => handlePinChange(e, setConfirmPin)}
                        className="w-full h-14 text-2xl font-bold rounded-xl bg-background border-2 border-border text-foreground focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none transition-all text-center tracking-[0.75em] pr-12"
                        maxLength={4}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin(!showPin)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>

                    {/* PIN dots indicator */}
                    <div className="flex justify-center gap-3">
                      {[0, 1, 2, 3].map((index) => (
                        <div
                          key={index}
                          className={`w-2.5 h-2.5 rounded-full transition-all ${
                            index < confirmPin.length ? 'bg-green-500 scale-100' : 'bg-muted scale-75'
                          }`}
                        />
                      ))}
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button
                        variant="outline"
                        onClick={() => { setPinStep(1); setConfirmPin(''); }}
                        disabled={savingPin}
                        className="flex-1"
                      >
                        Volver
                      </Button>
                      <Button
                        onClick={handleConfirmPin}
                        disabled={confirmPin.length !== 4 || savingPin}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        {savingPin ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Guardar PIN'
                        )}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            ) : (
              // Opción para crear PIN
              <button
                onClick={() => setShowPinSetup(true)}
                className="w-full flex items-center justify-between p-0 hover:opacity-80 transition-opacity"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Lock className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">Crear PIN de seguridad</p>
                    <p className="text-xs text-muted-foreground">Protege tu cuenta con 4 dígitos</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            )}
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
