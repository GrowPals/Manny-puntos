
import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const Success = () => {
  const { clearCart } = useCart();

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  return (
    <>
      <Helmet>
        <title>¡Compra Exitosa! - Manny</title>
        <meta name="description" content="Tu compra se ha completado con éxito." />
      </Helmet>
      
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center container mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, type: 'spring' }}
            className="bg-white rounded-3xl shadow-2xl p-8 md:p-16 text-center max-w-2xl"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="w-24 h-24 bg-gradient-to-br from-green-400 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <CheckCircle className="w-16 h-16 text-white" />
            </motion.div>
            
            <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
              ¡Compra Exitosa!
            </h1>
            
            <p className="text-gray-600 text-lg mb-8">
              Gracias por tu compra. Hemos recibido tu pedido y lo estamos procesando. Recibirás una confirmación por correo electrónico en breve.
            </p>
            
            <Link to="/perfil">
              <Button
                size="lg"
                className="bg-gradient-to-r from-orange-500 to-pink-500 text-white font-semibold py-3 text-lg rounded-xl"
              >
                Seguir comprando <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </motion.div>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Success;
