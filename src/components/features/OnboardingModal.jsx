import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const OnboardingModal = () => {
  const { user, needsOnboarding, registerPin, loading } = useAuth();
  const { toast } = useToast();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState(1); // 1: welcome, 2: create pin, 3: confirm pin

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
        title: "¡PIN creado!",
        description: "Tu cuenta está protegida. La próxima vez que entres, usa este PIN."
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

  if (!needsOnboarding) return null;

  return (
    <Dialog open={needsOnboarding} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md bg-card border-border"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-4"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="w-10 h-10 text-primary" />
            </div>

            <DialogHeader className="text-center">
              <DialogTitle className="text-2xl mb-2">
                ¡Bienvenido, {firstName}!
              </DialogTitle>
              <DialogDescription className="text-base">
                Es tu primera vez en Manny Rewards. Para proteger tu cuenta, vamos a crear un PIN de seguridad.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-8 space-y-3">
              <div className="flex items-start gap-3 text-left p-3 rounded-lg bg-muted/50">
                <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Solo 4 dígitos</p>
                  <p className="text-xs text-muted-foreground">Fácil de recordar</p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-left p-3 rounded-lg bg-muted/50">
                <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Sesión permanente</p>
                  <p className="text-xs text-muted-foreground">No tendrás que ingresar tu PIN cada vez</p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-left p-3 rounded-lg bg-muted/50">
                <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Cuenta protegida</p>
                  <p className="text-xs text-muted-foreground">Solo tú podrás acceder a tus puntos</p>
                </div>
              </div>
            </div>

            <Button
              onClick={() => setStep(2)}
              variant="investment"
              size="lg"
              className="w-full mt-8"
            >
              Crear mi PIN
            </Button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-center py-4"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="w-8 h-8 text-primary" />
            </div>

            <DialogHeader className="text-center mb-6">
              <DialogTitle className="text-xl">
                Crea tu PIN
              </DialogTitle>
              <DialogDescription>
                Elige 4 dígitos que puedas recordar fácilmente
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <input
                type="password"
                inputMode="numeric"
                placeholder="••••"
                value={pin}
                onChange={(e) => handlePinChange(e, setPin)}
                className="w-full h-16 text-3xl font-light rounded-xl bg-background border border-border text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all text-center tracking-[0.75em]"
                maxLength={4}
                autoFocus
              />

              <Button
                onClick={handleCreatePin}
                variant="investment"
                size="lg"
                className="w-full"
                disabled={pin.length !== 4}
              >
                Continuar
              </Button>

              <button
                type="button"
                onClick={() => { setStep(1); setPin(''); }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Volver
              </button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-center py-4"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="w-8 h-8 text-primary" />
            </div>

            <DialogHeader className="text-center mb-6">
              <DialogTitle className="text-xl">
                Confirma tu PIN
              </DialogTitle>
              <DialogDescription>
                Ingresa de nuevo los 4 dígitos para confirmar
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <input
                type="password"
                inputMode="numeric"
                placeholder="••••"
                value={confirmPin}
                onChange={(e) => handlePinChange(e, setConfirmPin)}
                className="w-full h-16 text-3xl font-light rounded-xl bg-background border border-border text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all text-center tracking-[0.75em]"
                maxLength={4}
                autoFocus
              />

              <Button
                onClick={handleConfirmPin}
                variant="investment"
                size="lg"
                className="w-full"
                disabled={loading || confirmPin.length !== 4}
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Crear PIN'}
              </Button>

              <button
                type="button"
                onClick={() => { setStep(2); setConfirmPin(''); }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Volver
              </button>
            </div>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingModal;
