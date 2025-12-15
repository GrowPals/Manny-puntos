import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Lock, Check, Loader2, Coins, Gift, Sparkles,
  ChevronRight, PartyPopper, Star, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useProducts } from '@/hooks/useProducts';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';

const DISMISS_KEY = 'onboarding_dismissed_until';

const TOTAL_STEPS = 4;

// Animated progress bar
const ProgressBar = ({ currentStep, totalSteps }) => (
  <div className="flex items-center justify-center gap-2 mb-6">
    {Array.from({ length: totalSteps }).map((_, index) => (
      <motion.div
        key={index}
        className={`h-1.5 rounded-full transition-all duration-300 ${
          index < currentStep
            ? 'bg-primary w-8'
            : index === currentStep
              ? 'bg-primary/50 w-8'
              : 'bg-muted w-4'
        }`}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: index * 0.1 }}
      />
    ))}
  </div>
);

// Animated counter for points
const AnimatedCounter = ({ value, duration = 1500 }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime;
    const startValue = 0;
    const endValue = value;

    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);

      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue = Math.floor(startValue + (endValue - startValue) * easeOutQuart);

      setCount(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return <span>{count.toLocaleString('es-MX')}</span>;
};

// Floating particles animation
const FloatingParticles = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(6)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-2 h-2 rounded-full bg-primary/20"
        initial={{
          x: Math.random() * 100 - 50,
          y: 100,
          opacity: 0
        }}
        animate={{
          y: -100,
          opacity: [0, 1, 0],
          scale: [0.5, 1, 0.5]
        }}
        transition={{
          duration: 3,
          delay: i * 0.5,
          repeat: Infinity,
          ease: "easeOut"
        }}
        style={{ left: `${20 + i * 12}%` }}
      />
    ))}
  </div>
);

const OnboardingModal = () => {
  const { user, needsOnboarding, registerPin, loading, isAdmin } = useAuth();
  const { toast } = useToast();
  const { productos } = useProducts();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState(0); // 0: welcome, 1: points reveal, 2: create pin, 3: confirm pin
  const [isDismissed, setIsDismissed] = useState(false);

  // Check if user has temporarily dismissed the modal
  // Nota: Los admins NO pueden posponer - el PIN es obligatorio
  useEffect(() => {
    if (isAdmin) {
      // Admins no pueden posponer, siempre muestran modal
      setIsDismissed(false);
      return;
    }
    const dismissedUntil = localStorage.getItem(DISMISS_KEY);
    if (dismissedUntil) {
      const dismissTime = parseInt(dismissedUntil, 10);
      if (Date.now() < dismissTime) {
        setIsDismissed(true);
      } else {
        localStorage.removeItem(DISMISS_KEY);
      }
    }
  }, [isAdmin]);

  const handleDismiss = () => {
    // Admins no pueden posponer
    if (isAdmin) {
      toast({
        title: "PIN requerido",
        description: "Como administrador, necesitas crear un PIN de seguridad.",
        variant: "destructive"
      });
      return;
    }
    // Dismiss for 24 hours (solo usuarios normales, aunque ya no deberían ver este modal)
    const dismissUntil = Date.now() + 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, dismissUntil.toString());
    setIsDismissed(true);
    toast({
      title: "Te recordaremos después",
      description: "Recuerda crear tu PIN para proteger tu cuenta."
    });
  };

  const handlePinChange = (e, setter) => {
    const formatted = e.target.value.replace(/\D/g, '').slice(0, 4);
    setter(formatted);
  };

  const handleCreatePin = () => {
    if (pin.length !== 4) {
      toast({
        title: "PIN incompleto",
        description: "El PIN debe tener 4 dígitos.",
        variant: "destructive"
      });
      return;
    }
    setStep(3);
  };

  const handleConfirmPin = async () => {
    if (confirmPin !== pin) {
      toast({
        title: "Los PIN no coinciden",
        description: "Verifica que ambos PIN sean iguales.",
        variant: "destructive"
      });
      setConfirmPin('');
      return;
    }

    try {
      await registerPin(pin);
      toast({
        title: "¡Listo!",
        description: "Tu cuenta está protegida. ¡A canjear recompensas!"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "No pudimos guardar tu PIN. Inténtalo de nuevo.",
        variant: "destructive"
      });
    }
  };

  const firstName = user?.nombre?.split(' ')[0] || 'Usuario';
  const userPoints = user?.puntos_actuales || 0;

  // Find a product they can redeem or the cheapest one
  const affordableProduct = productos?.find(p => p.puntos_requeridos <= userPoints);
  const cheapestProduct = productos?.reduce((min, p) =>
    !min || p.puntos_requeridos < min.puntos_requeridos ? p : min, null
  );
  const featuredProduct = affordableProduct || cheapestProduct;

  // Don't show if user doesn't need onboarding or has dismissed temporarily
  if (!needsOnboarding || isDismissed) return null;

  const slideVariants = {
    enter: (direction) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (direction) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0
    })
  };

  return (
    <Dialog open={needsOnboarding && !isDismissed} onOpenChange={(open) => !open && handleDismiss()}>
      <DialogContent
        className="sm:max-w-md bg-card border-border overflow-hidden p-0"
      >
        <DialogTitle className="sr-only">Configuración inicial de cuenta</DialogTitle>

        {/* Close button - only show on steps 0 and 1, and NOT for admins */}
        {step < 2 && !isAdmin && (
          <button
            onClick={handleDismiss}
            className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-muted transition-colors z-10"
            aria-label="Cerrar y recordar después"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}

        <div className="p-6 pb-8">
          <ProgressBar currentStep={step} totalSteps={TOTAL_STEPS} />

          <AnimatePresence mode="wait" custom={step}>
            {/* Step 0: Welcome */}
            {step === 0 && (
              <motion.div
                key="welcome"
                custom={1}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="text-center"
              >
                <motion.div
                  className="relative w-24 h-24 mx-auto mb-6"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.2 }}
                >
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 animate-pulse" />
                  <div className="absolute inset-2 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25">
                    <PartyPopper className="w-10 h-10 text-white" />
                  </div>
                  <motion.div
                    className="absolute -top-1 -right-1"
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.5, type: "spring" }}
                  >
                    <Sparkles className="w-6 h-6 text-yellow-500" />
                  </motion.div>
                </motion.div>

                <motion.h2
                  className="text-2xl font-bold mb-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  ¡Bienvenido, {firstName}!
                </motion.h2>

                <motion.p
                  className="text-muted-foreground mb-8"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  Es tu primera vez en Manny Rewards.
                  <br />
                  <span className="text-foreground font-medium">Descubre lo que te espera.</span>
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="space-y-3 mb-8"
                >
                  {[
                    { icon: Coins, text: "Acumula puntos con cada servicio" },
                    { icon: Gift, text: "Canjea recompensas exclusivas" },
                    { icon: Star, text: "Accede a beneficios especiales" }
                  ].map((item, index) => (
                    <motion.div
                      key={index}
                      className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/50"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + index * 0.1 }}
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <item.icon className="w-5 h-5 text-primary" />
                      </div>
                      <span className="text-sm font-medium">{item.text}</span>
                    </motion.div>
                  ))}
                </motion.div>

                <Button
                  onClick={() => setStep(1)}
                  variant="investment"
                  size="lg"
                  className="w-full group"
                >
                  Descubrir mis puntos
                  <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>

                {/* Solo mostrar opción de posponer para no-admins */}
                {!isAdmin && (
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Recordarme después
                  </button>
                )}
              </motion.div>
            )}

            {/* Step 1: Points Reveal (Aha Moment) */}
            {step === 1 && (
              <motion.div
                key="points"
                custom={1}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="text-center relative"
              >
                <FloatingParticles />

                <motion.div
                  className="mb-6"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", delay: 0.2 }}
                >
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                    <Sparkles className="w-4 h-4" />
                    Tus puntos actuales
                  </div>

                  <motion.div
                    className="hero rounded-2xl p-6 text-white relative overflow-hidden"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
                    <div className="relative">
                      <div className="flex items-center justify-center gap-3 mb-2">
                        <Coins className="w-8 h-8" />
                      </div>
                      <p className="text-5xl font-black">
                        <AnimatedCounter value={userPoints} />
                      </p>
                      <p className="text-white/80 text-sm mt-2">puntos disponibles</p>
                    </div>
                  </motion.div>
                </motion.div>

                {featuredProduct && (
                  <motion.div
                    className="mb-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                  >
                    <p className="text-sm text-muted-foreground mb-3">
                      {affordableProduct ? "¡Ya puedes canjear!" : "Próxima recompensa:"}
                    </p>
                    <div className={`p-4 rounded-xl border ${
                      affordableProduct
                        ? 'border-green-500/30 bg-green-500/5'
                        : 'border-border bg-muted/30'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Gift className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-semibold text-sm">{featuredProduct.nombre}</p>
                          <p className={`text-xs ${affordableProduct ? 'text-green-600' : 'text-muted-foreground'}`}>
                            {featuredProduct.puntos_requeridos.toLocaleString()} puntos
                          </p>
                        </div>
                        {affordableProduct && (
                          <Check className="w-5 h-5 text-green-500" />
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                >
                  <Button
                    onClick={() => setStep(2)}
                    variant="investment"
                    size="lg"
                    className="w-full group"
                  >
                    Proteger mi cuenta
                    <Shield className="w-4 h-4 ml-2" />
                  </Button>
                  <p className="text-xs text-muted-foreground mt-3">
                    Solo te tomará 30 segundos
                  </p>
                </motion.div>
              </motion.div>
            )}

            {/* Step 2: Create PIN */}
            {step === 2 && (
              <motion.div
                key="create-pin"
                custom={1}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="text-center"
              >
                <motion.div
                  className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring" }}
                >
                  <Lock className="w-9 h-9 text-white" />
                </motion.div>

                <h2 className="text-xl font-bold mb-2">Crea tu PIN de seguridad</h2>
                <p className="text-muted-foreground text-sm mb-6">
                  4 dígitos para proteger tu cuenta
                </p>

                <div className="space-y-4">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <input
                      type="password"
                      inputMode="numeric"
                      placeholder="••••"
                      value={pin}
                      onChange={(e) => handlePinChange(e, setPin)}
                      className="w-full h-16 text-3xl font-bold rounded-xl bg-background border-2 border-border text-foreground focus:border-primary focus:ring-4 focus:ring-primary/20 focus:outline-none transition-all text-center tracking-[0.75em]"
                      maxLength={4}
                      autoFocus
                    />

                    {/* PIN dots indicator */}
                    <div className="flex justify-center gap-3 mt-4">
                      {[0, 1, 2, 3].map((index) => (
                        <motion.div
                          key={index}
                          className={`w-3 h-3 rounded-full transition-all ${
                            index < pin.length
                              ? 'bg-primary scale-100'
                              : 'bg-muted scale-75'
                          }`}
                          animate={{
                            scale: index < pin.length ? [1, 1.2, 1] : 0.75
                          }}
                          transition={{ duration: 0.2 }}
                        />
                      ))}
                    </div>
                  </motion.div>

                  <div className="pt-2 space-y-3">
                    <Button
                      onClick={handleCreatePin}
                      variant="investment"
                      size="lg"
                      className="w-full"
                      disabled={pin.length !== 4}
                    >
                      Continuar
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>

                    <button
                      type="button"
                      onClick={() => { setStep(1); setPin(''); }}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Volver
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3: Confirm PIN */}
            {step === 3 && (
              <motion.div
                key="confirm-pin"
                custom={1}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="text-center"
              >
                <motion.div
                  className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/25"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring" }}
                >
                  <Check className="w-9 h-9 text-white" />
                </motion.div>

                <h2 className="text-xl font-bold mb-2">Confirma tu PIN</h2>
                <p className="text-muted-foreground text-sm mb-6">
                  Ingresa los 4 dígitos nuevamente
                </p>

                <div className="space-y-4">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <input
                      type="password"
                      inputMode="numeric"
                      placeholder="••••"
                      value={confirmPin}
                      onChange={(e) => handlePinChange(e, setConfirmPin)}
                      className="w-full h-16 text-3xl font-bold rounded-xl bg-background border-2 border-border text-foreground focus:border-green-500 focus:ring-4 focus:ring-green-500/20 focus:outline-none transition-all text-center tracking-[0.75em]"
                      maxLength={4}
                      autoFocus
                    />

                    {/* PIN dots indicator */}
                    <div className="flex justify-center gap-3 mt-4">
                      {[0, 1, 2, 3].map((index) => (
                        <motion.div
                          key={index}
                          className={`w-3 h-3 rounded-full transition-all ${
                            index < confirmPin.length
                              ? 'bg-green-500 scale-100'
                              : 'bg-muted scale-75'
                          }`}
                          animate={{
                            scale: index < confirmPin.length ? [1, 1.2, 1] : 0.75
                          }}
                          transition={{ duration: 0.2 }}
                        />
                      ))}
                    </div>
                  </motion.div>

                  <div className="pt-2 space-y-3">
                    <Button
                      onClick={handleConfirmPin}
                      variant="investment"
                      size="lg"
                      className="w-full bg-green-600 hover:bg-green-700"
                      disabled={loading || confirmPin.length !== 4}
                    >
                      {loading ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <>
                          ¡Listo, comenzar!
                          <Sparkles className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>

                    <button
                      type="button"
                      onClick={() => { setStep(2); setConfirmPin(''); }}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Volver
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingModal;
