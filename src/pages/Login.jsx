import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Loader2, Lock, ArrowLeft, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import SEOHelmet from '@/components/common/SEOHelmet';
import MannyLogo from '@/assets/images/manny-logo-v2.svg';

const Login = () => {
  const [telefono, setTelefono] = useState('');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' | 'pin' | 'forgot'
  const [clienteInfo, setClienteInfo] = useState(null);
  const { checkCliente, loginWithPin, loginFirstTime, loading } = useAuth();
  const { toast } = useToast();

  const handlePhoneChange = (e) => {
    const formatted = e.target.value.replace(/\D/g, '').slice(0, 10);
    setTelefono(formatted);
  };

  const handlePinChange = (e) => {
    const formatted = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(formatted);
  };

  // Paso 1: Verificar teléfono
  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    if (telefono.length !== 10) {
      toast({
        title: "Teléfono inválido",
        description: "Por favor, ingresa un número de 10 dígitos.",
        variant: "destructive"
      });
      return;
    }

    try {
      const result = await checkCliente(telefono);

      if (!result.exists) {
        toast({
          title: "Número no registrado",
          description: "No encontramos una cuenta con este número. Contacta a Manny para registrarte.",
          variant: "destructive"
        });
        return;
      }

      setClienteInfo(result.cliente);

      if (result.has_pin) {
        // Usuario ya tiene PIN, pedir que lo ingrese
        setStep('pin');
      } else {
        // Primera vez, entrar directo y mostrar onboarding
        await loginFirstTime(telefono);
        toast({
          title: `¡Bienvenido, ${result.cliente.nombre?.split(' ')[0]}!`,
          description: "Es tu primera vez, vamos a configurar tu cuenta."
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "No pudimos verificar tu número.",
        variant: "destructive"
      });
    }
  };

  // Paso 2: Verificar PIN
  const handlePinSubmit = async (e) => {
    e.preventDefault();
    if (pin.length !== 4) {
      toast({
        title: "PIN incompleto",
        description: "El PIN debe tener 4 dígitos.",
        variant: "destructive"
      });
      return;
    }

    try {
      await loginWithPin(telefono, pin);
      toast({
        title: "¡Bienvenido de vuelta!",
        description: "Accediendo a tu cuenta de recompensas Manny."
      });
    } catch (error) {
      setPin('');
      toast({
        title: "PIN incorrecto",
        description: "Verifica tu PIN e inténtalo de nuevo.",
        variant: "destructive"
      });
    }
  };

  const handleBack = () => {
    setStep('phone');
    setPin('');
  };

  const handleForgotPin = () => {
    setStep('forgot');
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 100
      }
    }
  };

  const slideVariants = {
    enter: { x: 50, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -50, opacity: 0 }
  };

  return (
    <>
      <SEOHelmet
        title="Accede a tus Recompensas"
        description="Ingresa con tu número de teléfono para ver tus puntos Manny y canjear recompensas."
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="min-h-screen relative overflow-hidden flex items-center justify-center p-4 bg-background transition-colors duration-500"
      >
        {/* Animated Background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute h-full w-full bg-background bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(233,30,99,0.15),rgba(255,255,255,0))]"></div>
          <motion.div
            className="absolute top-[-50px] left-[-50px] h-[200px] w-[200px] bg-primary/20 rounded-full animate-float"
            style={{ animationDelay: '0s' }}
          />
          <motion.div
            className="absolute bottom-[-80px] right-[20px] h-[250px] w-[250px] bg-secondary/20 rounded-full animate-float"
            style={{ animationDelay: '2s' }}
          />
        </div>

        {/* Theme Toggle */}
        <div className="absolute top-4 right-4 z-20">
          <ThemeToggle />
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full max-w-md z-10"
        >
          <div className="bg-card/60 backdrop-blur-xl rounded-3xl shadow-2xl p-10 border border-white/10">

            {/* Logo */}
            <div className="flex justify-center mb-6">
              <img
                alt="Manny Logo"
                className="h-auto w-48 object-contain"
                src={MannyLogo}
              />
            </div>

            {/* Title */}
            <div className="text-center mb-8">
              <h1 className="text-sm font-bold tracking-wider uppercase text-muted-foreground mb-2">
                Programa de Recompensas
              </h1>
              <p className="text-sm md:text-base text-muted-foreground/70 font-light">
                Canjea puntos por increíbles beneficios
              </p>
            </div>

            <AnimatePresence mode="wait">
              {step === 'phone' && (
                <motion.form
                  key="phone-form"
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.2 }}
                  onSubmit={handlePhoneSubmit}
                  className="space-y-5"
                >
                  <motion.div variants={itemVariants}>
                    <label htmlFor="phone-input" className="block text-sm font-medium text-muted-foreground mb-2">
                      Tu número de teléfono
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5 z-10" />
                      <input
                        id="phone-input"
                        type="tel"
                        placeholder="10 dígitos"
                        value={telefono}
                        onChange={handlePhoneChange}
                        className="w-full h-14 pl-12 pr-4 text-lg font-light tracking-wide rounded-xl bg-background border border-border text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-300 placeholder:text-muted-foreground/40 disabled:opacity-50"
                        maxLength={10}
                        disabled={loading}
                        autoFocus
                      />
                    </div>
                  </motion.div>

                  <motion.div variants={itemVariants}>
                    <Button
                      type="submit"
                      variant="investment"
                      size="lg"
                      className="w-full h-14 text-base"
                      disabled={loading || telefono.length !== 10}
                    >
                      {loading ? <Loader2 className="animate-spin" /> : 'Continuar'}
                    </Button>
                  </motion.div>

                  <motion.p variants={itemVariants} className="text-center text-sm text-muted-foreground/80 pt-2">
                    ¡Gracias por tu preferencia!
                  </motion.p>
                </motion.form>
              )}

              {step === 'pin' && (
                <motion.form
                  key="pin-form"
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.2 }}
                  onSubmit={handlePinSubmit}
                  className="space-y-5"
                >
                  <motion.div variants={itemVariants}>
                    <button
                      type="button"
                      onClick={handleBack}
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Cambiar número
                    </button>

                    {clienteInfo && (
                      <p className="text-center text-foreground mb-4">
                        Hola, <span className="font-semibold">{clienteInfo.nombre?.split(' ')[0]}</span>
                      </p>
                    )}

                    <label htmlFor="pin-input" className="block text-sm font-medium text-muted-foreground mb-2">
                      Ingresa tu PIN
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5 z-10" />
                      <input
                        id="pin-input"
                        type="password"
                        inputMode="numeric"
                        placeholder="••••"
                        value={pin}
                        onChange={handlePinChange}
                        className="w-full h-14 pl-12 pr-4 text-2xl font-light rounded-xl bg-background border border-border text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-300 placeholder:text-muted-foreground/40 disabled:opacity-50 text-center tracking-[0.5em]"
                        maxLength={4}
                        disabled={loading}
                        autoFocus
                      />
                    </div>
                  </motion.div>

                  <motion.div variants={itemVariants}>
                    <Button
                      type="submit"
                      variant="investment"
                      size="lg"
                      className="w-full h-14 text-base"
                      disabled={loading || pin.length !== 4}
                    >
                      {loading ? <Loader2 className="animate-spin" /> : 'Entrar'}
                    </Button>
                  </motion.div>

                  <motion.div variants={itemVariants} className="text-center">
                    <button
                      type="button"
                      onClick={handleForgotPin}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      ¿Olvidaste tu PIN?
                    </button>
                  </motion.div>
                </motion.form>
              )}

              {step === 'forgot' && (
                <motion.div
                  key="forgot-form"
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  <motion.div variants={itemVariants}>
                    <button
                      type="button"
                      onClick={handleBack}
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Volver
                    </button>

                    <div className="text-center py-4">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                        <MessageCircle className="w-8 h-8 text-primary" />
                      </div>
                      <h2 className="text-lg font-semibold text-foreground mb-2">
                        Recuperar acceso
                      </h2>
                      <p className="text-sm text-muted-foreground mb-6">
                        Contacta a Manny por WhatsApp y solicita un reseteo de tu PIN. Te ayudaremos a recuperar el acceso a tu cuenta.
                      </p>

                      <a
                        href="https://wa.me/524621234567?text=Hola,%20necesito%20recuperar%20el%20PIN%20de%20mi%20cuenta%20de%20recompensas.%20Mi%20número%20es%20"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block"
                      >
                        <Button variant="investment" size="lg" className="gap-2">
                          <MessageCircle className="w-5 h-5" />
                          Contactar por WhatsApp
                        </Button>
                      </a>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </>
  );
};

export default Login;
