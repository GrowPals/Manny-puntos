
import React from 'react';
import { MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from 'react-router-dom';

const WhatsAppButton = () => {
  const { user, isAdmin } = useAuth();
  const location = useLocation();

  const handleClick = () => {
    const whatsappUrl = 'https://wa.me/5214625905222?text=%C2%A1Hola%21+manny+necesito+ayuda+con+mi+sistema+de+puntos+vip';
    window.open(whatsappUrl, '_blank');
  };

  // Calculate bottom position: higher on mobile for clients (above bottom nav)
  const isClientMobile = user && !isAdmin && location.pathname !== '/login';

  return (
    <motion.button
      onClick={handleClick}
      className={`fixed right-4 z-50 btn-whatsapp rounded-full p-3.5 shadow-lg hover:scale-110 transition-all ${isClientMobile ? 'bottom-24 md:bottom-6' : 'bottom-6'}`}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 1 }}
      aria-label="Contactar por WhatsApp"
    >
      <MessageCircle className="w-5 h-5" />
    </motion.button>
  );
};

export default React.memo(WhatsAppButton);
