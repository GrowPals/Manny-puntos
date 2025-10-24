
import React from 'react';
import { MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const WhatsAppButton = () => {
  const handleClick = () => {
    // Usando el formato de URL proporcionado por el usuario
    const whatsappUrl = 'https://wa.me/5214625905222?text=%C2%A1Hola%21+manny+necesito+ayuda+con+mi+sistema+de+puntos+vip';
    window.open(whatsappUrl, '_blank');
  };

  return (
    <motion.button
      onClick={handleClick}
      className="fixed bottom-6 right-6 z-50 btn-whatsapp rounded-full p-4 shadow-lg hover:scale-110 transition-all"
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 1 }}
      aria-label="Contactar por WhatsApp"
    >
      <MessageCircle className="w-6 h-6" />
    </motion.button>
  );
};

export default React.memo(WhatsAppButton);
