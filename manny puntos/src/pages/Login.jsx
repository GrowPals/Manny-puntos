import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Phone, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { ThemeToggle } from '@/components/ThemeToggle';

const Login = () => {
  const [telefono, setTelefono] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (telefono.length !== 10 || !/^\d+$/.test(telefono)) {
      toast({
        title: "Número inválido",
        description: "Ingresa un número de teléfono válido de 10 dígitos.",
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);
    try {
      await login(telefono);
      toast({
        title: "¡Bienvenido de vuelta!",
        description: "Accediendo a tu cuenta de recompensas Manny."
      });
    } catch (error) {
      toast({
        title: "Error de acceso",
        description: error.message || "Este número de teléfono no está registrado.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } }
  };

  return (
    <>
      <Helmet>
        <title>Accede a tus Recompensas - Manny</title>
        <meta name="description" content="Ingresa con tu número de teléfono para ver tus puntos Manny y canjear recompensas." />
      </Helmet>
      
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="min-h-screen relative overflow-hidden flex items-center justify-center p-4 bg-background transition-colors duration-500"
      >
        <div className="absolute inset-0 z-0">
          <div className="absolute h-full w-full bg-background bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(233,30,99,0.15),rgba(255,255,255,0))]"></div>
          <motion.div 
            className="absolute top-[-50px] left-[-50px] h-[200px] w-[200px] bg-primary/20 rounded-full animate-float"
            style={{ animationDelay: '0s' }}
          ></motion.div>
          <motion.div 
            className="absolute bottom-[-80px] right-[20px] h-[250px] w-[250px] bg-secondary/20 rounded-full animate-float"
            style={{ animationDelay: '2s' }}
          ></motion.div>
        </div>

        <div className="absolute top-4 right-4 z-20">
            <ThemeToggle />
        </div>
        
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full max-w-md z-10"
        >
          <div className="bg-card/60 backdrop-blur-xl rounded-3xl shadow-2xl p-8 md:p-12 border border-white/10">
            <div className="text-center mb-8">
              <motion.div variants={itemVariants} className="inline-block mb-4">
                 <img src="https://i.ibb.co/LDLWZhkj/Recurso-1.png" alt="Manny Logo" className="h-16 w-auto" />
              </motion.div>
              <motion.h1 variants={itemVariants} className="text-3xl font-black bg-gradient-to-r from-primary-vibrant to-primary bg-clip-text text-transparent mb-2">
                ¡Bienvenido a Manny!
              </motion.h1>
              <motion.p variants={itemVariants} className="text-muted-foreground">Tu partner en mantenimiento y recompensas.</motion.p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <motion.div variants={itemVariants}>
                <label htmlFor="phone-input" className="block text-sm font-medium text-muted-foreground mb-2">
                  Tu número de teléfono (10 dígitos)
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                  <Input
                    id="phone-input"
                    type="tel"
                    placeholder="Ej: 4621234567"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="pl-12 h-14 text-lg rounded-xl bg-input/70 border-2 border-transparent focus:border-primary focus:ring-primary-vibrant/50 transition-all"
                    maxLength={10}
                    disabled={loading}
                    aria-label="Número de teléfono"
                  />
                </div>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Button
                  type="submit"
                  variant="investment"
                  size="lg"
                  className="w-full h-14 text-base"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="animate-spin" /> : 'Consultar mis puntos Manny'}
                </Button>
              </motion.div>

              <motion.p variants={itemVariants} className="text-center text-sm text-muted-foreground/80 pt-4">
                Usa el número con el que registraste nuestros servicios para acceder.
              </motion.p>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </>
  );
};

export default Login;