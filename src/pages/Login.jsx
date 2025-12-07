import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Phone, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import SEOHelmet from '@/components/common/SEOHelmet';
import MannyLogo from '@/assets/images/manny-logo-v2.svg';

const Login = () => {
  const [telefono, setTelefono] = useState('');
  const [pin, setPin] = useState('');
  const { login, loading } = useAuth();
  const { toast } = useToast();

  const handlePhoneChange = (e) => {
    const formatted = e.target.value.replace(/\D/g, '').slice(0, 10);
    setTelefono(formatted);
  };

  const handlePinChange = (e) => {
    const formatted = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(formatted);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (telefono.length !== 10) {
      toast({
        title: "Teléfono inválido",
        description: "Por favor, ingresa un número de 10 dígitos.",
        variant: "destructive"
      });
      return;
    }
    if (pin.length !== 4) {
        toast({
          title: "PIN incompleto",
          description: "El PIN debe tener 4 dígitos.",
          variant: "destructive"
        });
        return;
      }
    try {
      await login(telefono, pin);
      toast({
        title: "¡Bienvenido de vuelta!",
        description: "Accediendo a tu cuenta de recompensas Manny."
      });
    } catch (error) {
      toast({
        title: "Error de acceso",
        description: error.message || "Número no registrado o error de conexión.",
        variant: "destructive"
      });
    }
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

            <form onSubmit={handleSubmit} className="space-y-5">
              <motion.div variants={itemVariants}>
                <label htmlFor="phone-input" className="block text-sm font-medium text-muted-foreground mb-2">
                  Tu número de teléfono (10 dígitos)
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5 z-10" />
                  <input 
                    id="phone-input" 
                    type="tel" 
                    placeholder="Ej: 4621234567" 
                    value={telefono} 
                    onChange={handlePhoneChange} 
                    className="w-full h-14 pl-12 pr-4 text-lg font-light tracking-wide rounded-xl bg-background border border-border text-muted-foreground focus:text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-300 placeholder:text-muted-foreground/40 disabled:opacity-50" 
                    maxLength={10} 
                    disabled={loading} 
                    aria-label="Número de teléfono" 
                    pattern="\d{10}" 
                    title="El número debe tener 10 dígitos" 
                  />
                </div>
              </motion.div>

              <motion.div variants={itemVariants}>
                <label htmlFor="phone-input" className="block text-sm font-medium text-muted-foreground mb-2">
                  Tu número de teléfono (10 dígitos)
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5 z-10" />
                  <input 
                    id="phone-input" 
                    type="tel" 
                    placeholder="Ej: 4621234567" 
                    value={telefono} 
                    onChange={handlePhoneChange} 
                    className="w-full h-14 pl-12 pr-4 text-lg font-light tracking-wide rounded-xl bg-background border border-border text-muted-foreground focus:text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-300 placeholder:text-muted-foreground/40 disabled:opacity-50" 
                    maxLength={10} 
                    disabled={loading} 
                    aria-label="Número de teléfono" 
                    pattern="\d{10}" 
                    title="El número debe tener 10 dígitos" 
                  />
                </div>
              </motion.div>

              <motion.div variants={itemVariants}>
                <label htmlFor="pin-input" className="block text-sm font-medium text-muted-foreground mb-2">
                  PIN de seguridad (4 dígitos)
                </label>
                <div className="relative">
                  <input 
                    id="pin-input" 
                    type="password" 
                    placeholder="****" 
                    value={pin} 
                    onChange={handlePinChange} 
                    className="w-full h-14 pl-4 pr-4 text-lg font-light tracking-wide rounded-xl bg-background border border-border text-muted-foreground focus:text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-300 placeholder:text-muted-foreground/40 disabled:opacity-50 text-center tracking-[0.5em]" 
                    maxLength={4} 
                    disabled={loading} 
                    aria-label="PIN de seguridad" 
                    pattern="\d{4}" 
                    title="El PIN debe tener 4 dígitos" 
                  />
                </div>
                <p className="text-xs text-muted-foreground/60 mt-2 text-center">
                  Por defecto son los últimos 4 dígitos de tu teléfono
                </p>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Button 
                  type="submit" 
                  variant="investment" 
                  size="lg" 
                  className="w-full h-14 text-base" 
                  disabled={loading || telefono.length !== 10 || pin.length !== 4}
                >
                  {loading ? <Loader2 className="animate-spin" /> : 'Consultar mis puntos'}
                </Button>
              </motion.div>

              <motion.p variants={itemVariants} className="text-center text-sm text-muted-foreground/80 pt-2">
                ¡Gracias por tu preferencia!
              </motion.p>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </>
  );
};

export default Login;
