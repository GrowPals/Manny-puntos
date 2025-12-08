import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HelpCircle,
  ChevronDown,
  Gift,
  Coins,
  Users,
  Bell,
  Smartphone,
  Clock,
  Package,
  Star
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import WhatsAppIcon from '@/assets/images/whatsapp-logo.svg';
import { CONTACT_CONFIG } from '@/config';

const FAQItem = ({ question, answer, icon: Icon, isOpen, onClick, index }) => (
  <motion.button
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.03 }}
    onClick={onClick}
    className="w-full text-left"
  >
    <div className={`flex items-start gap-3 py-4 ${index > 0 ? 'border-t border-border' : ''}`}>
      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${isOpen ? 'text-primary' : 'text-muted-foreground'} transition-colors`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className={`font-medium text-sm ${isOpen ? 'text-primary' : 'text-foreground'} transition-colors`}>
            {question}
          </h3>
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
        <AnimatePresence>
          {isOpen && (
            <motion.p
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="text-sm text-muted-foreground leading-relaxed mt-2 pr-6 overflow-hidden"
            >
              {answer}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  </motion.button>
);

const Ayuda = () => {
  const [openFAQ, setOpenFAQ] = useState(0);

  // Obtener configuración global para valores dinámicos
  const { data: config } = useQuery({
    queryKey: ['config-global'],
    queryFn: api.config.getConfigGlobal,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  const vigenciaPuntos = config?.vigencia_puntos_meses || 12;
  const vigenciaCanje = config?.vigencia_canje_dias || 30;

  const faqs = [
    {
      icon: Coins,
      question: '¿Cómo gano puntos Manny?',
      answer: 'Ganas puntos automáticamente cada vez que realizas un servicio en Manny. Dependiendo del tipo de servicio y tu nivel de membresía, acumulas diferentes cantidades de puntos. Los Partners y VIPs ganan bonificaciones adicionales.'
    },
    {
      icon: Gift,
      question: '¿Cómo puedo canjear mis puntos?',
      answer: 'Ve a la sección de Recompensas, selecciona el producto que deseas y presiona "Canjear". Tu canje quedará pendiente hasta que lo recojas en Manny. Recibirás una notificación cuando esté listo.'
    },
    {
      icon: Users,
      question: '¿Cómo funciona el programa de referidos?',
      answer: 'Comparte tu código de referido con amigos. Cuando un amigo se registre y realice su primer servicio usando tu código, ambos recibirán puntos de bonificación. Puedes ver tu código en la sección "Mis Referidos".'
    },
    {
      icon: Bell,
      question: '¿Por qué no recibo notificaciones?',
      answer: 'Asegúrate de tener las notificaciones activadas en Configuración. Si están bloqueadas, necesitarás habilitarlas desde la configuración de tu navegador. Para la mejor experiencia, instala la app en tu dispositivo.'
    },
    {
      icon: Smartphone,
      question: '¿Cómo instalo la app en mi teléfono?',
      answer: 'En iPhone: Abre Safari, toca el botón de compartir y selecciona "Agregar a pantalla de inicio". En Android: Abre Chrome, toca los 3 puntos y selecciona "Instalar app" o "Agregar a pantalla de inicio".'
    },
    {
      icon: Clock,
      question: '¿Mis puntos tienen fecha de vencimiento?',
      answer: `Los puntos acumulados tienen una vigencia de ${vigenciaPuntos} meses desde tu último servicio realizado. Mantén tu cuenta activa visitando Manny regularmente para no perder tus puntos.`
    },
    {
      icon: Package,
      question: '¿Qué pasa si mi canje está pendiente mucho tiempo?',
      answer: `Los canjes pendientes permanecen disponibles por ${vigenciaCanje} días. Si no los recoges en ese tiempo, los puntos serán devueltos a tu cuenta. Te enviaremos recordatorios antes de que expire.`
    },
    {
      icon: Star,
      question: '¿Cómo me vuelvo Partner o VIP?',
      answer: 'Los niveles Partner y VIP se otorgan por invitación especial basada en tu historial de servicios y lealtad. Sigue acumulando servicios y podrías recibir una invitación con beneficios exclusivos.'
    },
  ];

  const toggleFAQ = (index) => {
    setOpenFAQ(openFAQ === index ? null : index);
  };

  return (
    <>
      <Helmet>
        <title>Ayuda - Manny Rewards</title>
        <meta name="description" content="Centro de ayuda de Manny Rewards. Encuentra respuestas a tus preguntas." />
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
            <HelpCircle className="w-6 h-6 text-primary" />
            Centro de Ayuda
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Encuentra respuestas y contáctanos
          </p>
        </motion.div>

        {/* WhatsApp CTA */}
        <motion.a
          href={`https://api.whatsapp.com/send?phone=${CONTACT_CONFIG.WHATSAPP_MAIN}`}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="block bg-card rounded-xl border border-border p-4 hover:border-[#25D366]/50 hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-4">
            <img src={WhatsAppIcon} alt="" className="w-10 h-10 shrink-0 group-hover:scale-105 transition-transform" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">Escríbenos por WhatsApp</p>
              <p className="text-sm text-muted-foreground">Te respondemos en minutos</p>
            </div>
            <ChevronDown className="w-5 h-5 text-muted-foreground -rotate-90 group-hover:text-[#25D366] transition-colors" />
          </div>
        </motion.a>

        {/* FAQs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-xl border border-border p-4"
        >
          <h3 className="font-semibold text-sm text-muted-foreground mb-2">
            Preguntas frecuentes
          </h3>
          <div>
            {faqs.map((faq, index) => (
              <FAQItem
                key={index}
                index={index}
                icon={faq.icon}
                question={faq.question}
                answer={faq.answer}
                isOpen={openFAQ === index}
                onClick={() => toggleFAQ(index)}
              />
            ))}
          </div>
        </motion.div>

        {/* Contacto */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card rounded-xl border border-border p-4"
        >
          <h3 className="font-semibold text-sm text-muted-foreground mb-4">
            Otras formas de contacto
          </h3>

          <a
            href="mailto:team@manny.mx"
            className="flex items-center gap-3 py-3 group"
          >
            <Mail className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="font-medium text-sm group-hover:text-primary transition-colors">team@manny.mx</p>
              <p className="text-xs text-muted-foreground">Correo electrónico</p>
            </div>
          </a>

          <div className="flex items-center gap-3 py-3 border-t border-border">
            <Clock className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="font-medium text-sm">Lunes a Sábado</p>
              <p className="text-xs text-muted-foreground">9:00 AM - 7:00 PM</p>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default Ayuda;
