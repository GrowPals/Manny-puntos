
import React from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from 'react-router-dom';
import WhatsAppIcon from '@/assets/images/whatsapp-logo.svg';

const WhatsAppButton = () => {
  const { user } = useAuth();
  const location = useLocation();

  // Don't show on login page
  if (location.pathname === '/login') {
    return null;
  }

  // Calculate bottom position: always above bottom nav on mobile when user is logged in
  const hasBottomNav = user && location.pathname !== '/login';

  return (
    <motion.a
      href="https://wa.me/5214625905222?text=%C2%A1Hola%21+manny+necesito+ayuda+con+mi+sistema+de+puntos+vip"
      target="_blank"
      rel="noopener noreferrer"
      className={`fixed right-3 z-30 rounded-full shadow-lg hover:scale-110 transition-all ${
        hasBottomNav ? 'bottom-[84px] lg:bottom-6' : 'bottom-6'
      }`}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 1 }}
      aria-label="Contactar por WhatsApp"
    >
      <img src={WhatsAppIcon} alt="WhatsApp" className="w-12 h-12" />
    </motion.a>
  );
};

export default React.memo(WhatsAppButton);
