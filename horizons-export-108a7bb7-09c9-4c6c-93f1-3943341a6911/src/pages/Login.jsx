
import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Phone, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';

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

  return (
    <>
      <Helmet>
        <title>Accede a tus Recompensas - Manny</title>
        <meta name="description" content="Ingresa con tu número de teléfono para ver tus puntos Manny y canjear recompensas." />
      </Helmet>
      
      <div className="min-h-screen flex items-center justify-center p-4 bg-secondary-dark">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="bg-secondary rounded-3xl shadow-2xl p-8 md:p-12 border border-secondary-light">
            <div className="text-center mb-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="inline-block mb-4"
              >
                 <img src="https://i.ibb.co/LDLWZhkj/Recurso-1.png" alt="Manny Logo" className="h-16 w-auto" />
              </motion.div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-vibrant to-primary bg-clip-text text-transparent mb-2">
                ¡Bienvenido a Manny!
              </h1>
              <p className="text-gray-400">Tu partner en mantenimiento y recompensas.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tu número de teléfono (10 dígitos)
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    type="tel"
                    placeholder="Ej: 4771234567"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="pl-12 h-14 text-lg rounded-xl border-2 border-secondary-light bg-secondary-dark focus:border-primary focus:ring-primary"
                    maxLength={10}
                    disabled={loading}
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="investment"
                size="lg"
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Verificando...' : 'Consultar mis puntos Manny'}
              </Button>

              <p className="text-center text-sm text-gray-500">
                Usa el número con el que registraste nuestros servicios para acceder.
              </p>
            </form>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default Login;
