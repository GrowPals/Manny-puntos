
import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from 'react-router-dom';
import WhatsAppIcon from '@/assets/images/whatsapp-logo.svg';
import { CONTACT_CONFIG } from '@/config';

const PHONE_NUMBER = CONTACT_CONFIG.WHATSAPP_MAIN;

const WhatsAppButton = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Detect mobile based on user agent and touch capability
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
      const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsMobile(mobileRegex.test(userAgent.toLowerCase()) || (hasTouchScreen && window.innerWidth < 1024));
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleClick = useCallback((e) => {
    e.preventDefault();
    // Mobile: use wa.me which opens the app directly
    // Desktop: use web.whatsapp.com for WhatsApp Web
    const url = isMobile
      ? `https://wa.me/${PHONE_NUMBER}`
      : `https://web.whatsapp.com/send?phone=${PHONE_NUMBER}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [isMobile]);

  // Don't show on login page
  if (location.pathname === '/login') {
    return null;
  }

  // Calculate bottom position: always above bottom nav on mobile when user is logged in
  const hasBottomNav = user && location.pathname !== '/login';

  return (
    <motion.a
      href={`https://wa.me/${PHONE_NUMBER}`}
      onClick={handleClick}
      className={`fixed right-4 z-30 hover:scale-110 transition-all cursor-pointer ${
        hasBottomNav ? 'bottom-[72px] lg:bottom-6' : 'bottom-6'
      }`}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 1 }}
      aria-label="Contactar por WhatsApp"
    >
      <img src={WhatsAppIcon} alt="WhatsApp" className="w-16 h-16" loading="lazy" decoding="async" />
    </motion.a>
  );
};

export default React.memo(WhatsAppButton);
