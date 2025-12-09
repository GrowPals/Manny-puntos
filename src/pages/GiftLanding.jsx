import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Phone, Loader2, Sparkles, PartyPopper, XCircle, Coins, Wrench, FileText, Info, CheckCircle2, AlertTriangle, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/services/api';
import confetti from 'canvas-confetti';
import MannyLogo from '@/assets/images/manny-logo-new.svg';
import { VALIDATION, UI_CONFIG, isValidPhone } from '@/config';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { logger } from '@/lib/logger';
import AppDownloadStep from '@/components/AppDownloadStep';
import FormattedText from '@/components/common/FormattedText';

// Pre-generate particle data to avoid re-renders with Math.random()
const FLOATING_PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  hue: Math.random() * 60 + 320,
  left: Math.random() * 100,
  top: Math.random() * 100,
  duration: 2 + Math.random() * 2,
  delay: Math.random() * 2,
}));

// Componente de partículas flotantes
const FloatingParticles = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {FLOATING_PARTICLES.map((particle) => (
      <motion.div
        key={particle.id}
        className="absolute w-2 h-2 rounded-full"
        style={{
          background: `hsl(${particle.hue}, 80%, 60%)`,
          left: `${particle.left}%`,
          top: `${particle.top}%`,
        }}
        animate={{
          y: [0, -30, 0],
          opacity: [0.3, 0.8, 0.3],
          scale: [1, 1.5, 1],
        }}
        transition={{
          duration: particle.duration,
          repeat: Infinity,
          delay: particle.delay,
        }}
      />
    ))}
  </div>
);

const GiftLanding = () => {
  const { codigo } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isOnline } = useNetworkStatus();

  const [loading, setLoading] = useState(true);
  const [giftData, setGiftData] = useState(null);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('intro'); // 'intro' | 'reveal' | 'terms' | 'claim' | 'download'
  const [telefono, setTelefono] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [claimAttempted, setClaimAttempted] = useState(false); // Prevent double submission
  const [isExclusiveGift, setIsExclusiveGift] = useState(false); // For destinatario validation
  const [claimedClienteId, setClaimedClienteId] = useState(null); // Store cliente ID after claim
  const [isClienteNuevo, setIsClienteNuevo] = useState(false); // Track if new client

  // Cargar datos del regalo
  useEffect(() => {
    const loadGift = async () => {
      if (!codigo) {
        setError('Código no proporcionado');
        setLoading(false);
        return;
      }

      try {
        const data = await api.gifts.getGiftByCode(codigo);

        if (!data) {
          setError('Este link de regalo no existe');
        } else if (data.estado === 'canjeado' && !data.es_campana) {
          setError('Este regalo ya fue canjeado');
        } else if (data.estado === 'expirado') {
          setError('Este regalo ha expirado');
        } else if (data.estado === 'agotado') {
          setError('Esta promoción ha alcanzado el límite de participantes');
        } else {
          setGiftData(data);
          // Detectar si es regalo exclusivo para mostrar advertencia temprana
          if (data.destinatario_telefono) {
            setIsExclusiveGift(true);
          }
        }
      } catch (err) {
        logger.error('Error loading gift', { error: err.message, codigo });
        setError('Error al cargar el regalo');
      } finally {
        setLoading(false);
      }
    };

    loadGift();
  }, [codigo]);

  const handleReveal = () => {
    setStep('reveal');
    // Confetti al revelar with error handling
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: UI_CONFIG.CHART_COLORS
      });
    } catch {
      // Non-critical, ignore confetti errors
    }
  };

  const handleContinueToClaim = () => {
    // Si es campaña y tiene términos, mostrar pantalla de términos primero
    if (giftData.es_campana && (giftData.terminos_condiciones || giftData.instrucciones_uso)) {
      setStep('terms');
    } else {
      setStep('claim');
    }
  };

  const handleAcceptTerms = () => {
    setAcceptedTerms(true);
    setStep('claim');
  };

  const handlePhoneChange = (e) => {
    const formatted = e.target.value.replace(/\D/g, '').slice(0, VALIDATION.PHONE.LENGTH);
    setTelefono(formatted);
  };

  const handleClaim = async (e) => {
    e.preventDefault();

    // Prevent double submission
    if (claiming || claimAttempted) {
      return;
    }

    // Check network status first
    if (!isOnline) {
      toast({
        title: 'Sin conexión',
        description: 'Verifica tu conexión a internet e intenta nuevamente',
        variant: 'destructive'
      });
      return;
    }

    if (!isValidPhone(telefono)) {
      toast({
        title: 'Teléfono inválido',
        description: 'Por favor ingresa un número válido de 10 dígitos',
        variant: 'destructive'
      });
      return;
    }

    // Verificar destinatario específico
    if (giftData.destinatario_telefono && giftData.destinatario_telefono !== telefono) {
      toast({
        title: 'Regalo exclusivo',
        description: 'Este regalo es para otro número de teléfono',
        variant: 'destructive'
      });
      logger.warn('Gift claim rejected - wrong phone for exclusive gift', {
        codigo,
        expectedPhone: giftData.destinatario_telefono?.slice(-4),
        attemptedPhone: telefono.slice(-4),
      });
      return;
    }

    setClaiming(true);
    setClaimAttempted(true);

    try {
      const result = await api.gifts.claimGift(codigo, telefono);

      if (result.success) {
        // Log successful claim
        logger.giftClaimed(giftData.id, result.cliente_id, {
          codigo,
          tipo: giftData.tipo,
          esClienteNuevo: result.cliente_nuevo,
        });

        // Si es cliente nuevo, sincronizar a Notion (now with queue fallback)
        if (result.cliente_nuevo && result.cliente_id) {
          const syncResult = await api.clients.syncToNotion(result.cliente_id);
          if (syncResult?.queued) {
            logger.syncQueued(result.cliente_id, 'sync_cliente', { source: 'gift_claim' });
          }
        }

        // Crear ticket en Notion automáticamente para servicios (now with queue fallback)
        if (result.beneficio_id && giftData.tipo === 'servicio') {
          const ticketResult = await api.gifts.createBenefitTicket(result.beneficio_id);
          if (ticketResult?.queued) {
            logger.syncQueued(result.beneficio_id, 'create_benefit_ticket', { source: 'gift_claim' });
          }
        }

        // Store cliente info for download step
        setClaimedClienteId(result.cliente_id);
        setIsClienteNuevo(result.cliente_nuevo);
        setClaimed(true);

        // Mega confetti with error handling
        try {
          const duration = 2000;
          const end = Date.now() + duration;

          const frame = () => {
            confetti({
              particleCount: 7,
              angle: 60,
              spread: 55,
              origin: { x: 0 },
              colors: UI_CONFIG.CHART_COLORS.slice(0, 3)
            });
            confetti({
              particleCount: 7,
              angle: 120,
              spread: 55,
              origin: { x: 1 },
              colors: UI_CONFIG.CHART_COLORS.slice(0, 3)
            });

            if (Date.now() < end) {
              requestAnimationFrame(frame);
            }
          };
          frame();
        } catch (confettiError) {
          // Confetti is non-critical, don't block on errors
          logger.debug('Confetti animation failed', { error: confettiError.message });
        }

        // Ir al paso de descarga/notificaciones después del confetti
        setTimeout(() => {
          setStep('download');
        }, 2000);
      }
    } catch (err) {
      logger.error('Error claiming gift', { error: err.message, codigo });
      toast({
        title: 'Error',
        description: err.message || 'No pudimos canjear el regalo',
        variant: 'destructive'
      });
      // Reset claimAttempted to allow retry on error
      setClaimAttempted(false);
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <Gift className="w-16 h-16 text-primary" />
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card rounded-2xl p-8 max-w-md w-full text-center border border-border shadow-xl"
        >
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Oh no...</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => navigate('/login')} variant="outline">
            Ir al inicio
          </Button>
        </motion.div>
      </div>
    );
  }

  // Render download step separately (has its own full layout)
  if (step === 'download') {
    return (
      <AppDownloadStep
        clienteId={claimedClienteId}
        colorTema={giftData?.color_tema || '#E91E63'}
        benefitText={giftData?.tipo === 'puntos'
          ? `tus ${giftData?.puntos_regalo?.toLocaleString()} puntos`
          : giftData?.nombre_beneficio || 'tu regalo'
        }
        onComplete={() => {
          if (isClienteNuevo) {
            navigate('/login');
          } else {
            navigate('/dashboard');
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 relative overflow-hidden">
      <FloatingParticles />

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <AnimatePresence mode="wait">
          {/* STEP 1: Intro - Caja de regalo */}
          {step === 'intro' && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, y: -50 }}
              className="text-center max-w-md w-full"
            >
              {/* Logo */}
              <img src={MannyLogo} alt="Manny" className="h-10 mx-auto mb-8" />

              {/* Banner de campaña si existe */}
              {giftData?.imagen_banner && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 100 }}
                  className="mb-8 rounded-2xl overflow-hidden shadow-2xl relative"
                  style={{
                    boxShadow: `0 25px 50px -12px ${giftData.color_tema || '#E91E63'}40`
                  }}
                >
                  {/* Glow effect */}
                  <div
                    className="absolute inset-0 blur-3xl opacity-30"
                    style={{ backgroundColor: giftData.color_tema || '#E91E63' }}
                  />
                  <img
                    src={giftData.imagen_banner}
                    alt={giftData.nombre_campana || 'Promoción'}
                    className="w-full h-48 object-cover relative z-10"
                    loading="eager"
                    decoding="async"
                  />
                  {/* Overlay gradient */}
                  <div
                    className="absolute bottom-0 left-0 right-0 h-16 z-20"
                    style={{
                      background: `linear-gradient(to top, ${giftData.color_tema || '#E91E63'}30, transparent)`
                    }}
                  />
                </motion.div>
              )}

              {/* Caja de regalo animada */}
              {!giftData?.imagen_banner && (
                <motion.div
                  animate={{
                    y: [0, -10, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut'
                  }}
                  className="relative mx-auto w-48 h-48 mb-8"
                >
                  {/* Resplandor */}
                  <motion.div
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.5, 0.8, 0.5],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 rounded-3xl blur-2xl"
                    style={{
                      background: `linear-gradient(to right, ${giftData?.color_tema || '#E91E63'}40, #9C27B040)`
                    }}
                  />

                  {/* Caja */}
                  <div
                    className="relative w-full h-full rounded-3xl shadow-2xl flex items-center justify-center"
                    style={{
                      background: `linear-gradient(to bottom right, ${giftData?.color_tema || '#E91E63'}, #9C27B0)`
                    }}
                  >
                    <Gift className="w-24 h-24 text-white" />

                    {/* Sparkles */}
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                      className="absolute inset-0"
                    >
                      <Sparkles className="w-8 h-8 text-yellow-300 absolute -top-2 -right-2" />
                      <Sparkles className="w-6 h-6 text-yellow-300 absolute -bottom-1 -left-1" />
                    </motion.div>
                  </div>
                </motion.div>
              )}

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-3xl font-bold text-foreground mb-3"
              >
                {giftData?.es_campana && giftData?.nombre_campana
                  ? giftData.nombre_campana
                  : '¡Tienes un regalo!'
                }
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-muted-foreground mb-8"
              >
                {giftData?.mensaje_personalizado || 'Alguien especial te envió algo...'}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Button
                  size="lg"
                  onClick={handleReveal}
                  className="text-lg px-8 py-6"
                  style={{
                    background: `linear-gradient(to right, ${giftData?.color_tema || '#E91E63'}, #9C27B0)`
                  }}
                >
                  <Gift className="w-5 h-5 mr-2" />
                  {giftData?.es_campana ? 'Ver mi regalo' : 'Abrir regalo'}
                </Button>
              </motion.div>
            </motion.div>
          )}

          {/* STEP 2: Reveal - Mostrar qué es */}
          {step === 'reveal' && (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="bg-card/90 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full border border-border shadow-2xl text-center"
            >
              {/* Icono del tipo de regalo */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-6"
                style={{
                  background: `linear-gradient(to bottom right, ${giftData.color_tema || '#E91E63'}, #9C27B0)`
                }}
              >
                {giftData.tipo === 'puntos' ? (
                  <Coins className="w-10 h-10 text-white" />
                ) : (
                  <Wrench className="w-10 h-10 text-white" />
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <PartyPopper className="w-8 h-8 text-yellow-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  ¡Felicidades!
                </h2>
              </motion.div>

              {/* Contenido del regalo */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="rounded-xl p-6 mb-6 border"
                style={{
                  background: `linear-gradient(to right, ${giftData.color_tema || '#E91E63'}15, #9C27B015)`,
                  borderColor: `${giftData.color_tema || '#E91E63'}30`
                }}
              >
                {giftData.tipo === 'puntos' ? (
                  <>
                    <p className="text-5xl font-black mb-2" style={{ color: giftData.color_tema || '#E91E63' }}>
                      {giftData.puntos_regalo?.toLocaleString()}
                    </p>
                    <p className="text-lg text-foreground">Puntos Manny</p>
                  </>
                ) : (
                  <>
                    <p className="text-xl font-bold text-foreground mb-2">
                      {giftData.nombre_beneficio}
                    </p>
                    {giftData.descripcion_beneficio && (
                      <p className="text-sm text-muted-foreground">
                        {giftData.descripcion_beneficio}
                      </p>
                    )}
                  </>
                )}
              </motion.div>

              {/* Advertencia para regalos exclusivos */}
              {isExclusiveGift && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20"
                >
                  <p className="text-xs text-blue-600 flex items-center justify-center gap-1">
                    <Phone className="w-3 h-3" />
                    Este regalo es para un número específico: ***{giftData.destinatario_telefono?.slice(-4)}
                  </p>
                </motion.div>
              )}

              {/* Indicador de términos para campañas */}
              {giftData.es_campana && giftData.terminos_condiciones && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.55 }}
                  className="mb-4 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20"
                >
                  <p className="text-xs text-orange-600 flex items-center justify-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Este regalo incluye condiciones que deberás aceptar
                  </p>
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Button
                  size="lg"
                  onClick={handleContinueToClaim}
                  className="w-full text-lg py-6"
                  style={{
                    background: `linear-gradient(to right, ${giftData.color_tema || '#E91E63'}, #9C27B0)`
                  }}
                >
                  {giftData.es_campana && giftData.terminos_condiciones
                    ? 'Ver condiciones'
                    : 'Reclamar mi regalo'
                  }
                </Button>
              </motion.div>
            </motion.div>
          )}

          {/* STEP 3: Terms - Términos y condiciones (solo campañas) */}
          {step === 'terms' && (
            <motion.div
              key="terms"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="bg-card/90 backdrop-blur-xl rounded-3xl p-6 max-w-md w-full border border-border shadow-2xl max-h-[85vh] overflow-y-auto"
            >
              <div className="text-center mb-6">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: `${giftData.color_tema || '#E91E63'}20` }}
                >
                  <FileText className="w-8 h-8" style={{ color: giftData.color_tema || '#E91E63' }} />
                </div>
                <h2 className="text-xl font-bold text-foreground">
                  Antes de continuar
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Lee las condiciones de tu regalo
                </p>
              </div>

              {/* Qué incluye */}
              <div className="mb-4 p-4 rounded-xl border border-border bg-muted/20">
                <div className="flex items-center gap-2 mb-2">
                  <Gift className="w-4 h-4" style={{ color: giftData.color_tema || '#E91E63' }} />
                  <p className="font-medium text-sm">Tu regalo incluye:</p>
                </div>
                <p className="text-foreground font-medium">{giftData.nombre_beneficio}</p>
                {giftData.descripcion_beneficio && (
                  <p className="text-sm text-muted-foreground mt-1">{giftData.descripcion_beneficio}</p>
                )}
              </div>

              {/* Términos y Condiciones */}
              {giftData.terminos_condiciones && (
                <div className="mb-4 p-4 rounded-xl border border-orange-500/20 bg-orange-500/5">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                    <p className="font-medium text-sm text-orange-600 dark:text-orange-400">Condiciones importantes</p>
                  </div>
                  <FormattedText
                    text={giftData.terminos_condiciones}
                    className="text-foreground"
                  />
                </div>
              )}

              {/* Instrucciones de uso */}
              {giftData.instrucciones_uso && (
                <div className="mb-4 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
                  <div className="flex items-center gap-2 mb-3">
                    <Info className="w-4 h-4 text-blue-500" />
                    <p className="font-medium text-sm text-blue-600 dark:text-blue-400">¿Cómo usarlo?</p>
                  </div>
                  <FormattedText
                    text={giftData.instrucciones_uso}
                    className="text-foreground"
                  />
                </div>
              )}

              {/* Vigencia */}
              {giftData.vigencia_beneficio && (
                <div className="mb-6 p-3 rounded-xl bg-muted/30 border border-border">
                  <div className="flex items-center justify-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span className="text-muted-foreground">Vigencia:</span>
                      <span className="font-medium text-foreground">
                        {giftData.vigencia_beneficio === 365
                          ? '1 año'
                          : giftData.vigencia_beneficio === 30
                            ? '1 mes'
                            : `${giftData.vigencia_beneficio} días`
                        }
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-1">
                    A partir del momento en que lo reclames
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <Button
                  size="lg"
                  onClick={handleAcceptTerms}
                  className="w-full text-lg py-6"
                  style={{
                    background: `linear-gradient(to right, ${giftData.color_tema || '#E91E63'}, #9C27B0)`
                  }}
                >
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  Acepto las condiciones
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep('reveal')}
                  className="w-full"
                >
                  Volver
                </Button>
              </div>
            </motion.div>
          )}

          {/* STEP 4: Claim - Ingresar teléfono */}
          {step === 'claim' && !claimed && (
            <motion.div
              key="claim"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="bg-card/90 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full border border-border shadow-2xl"
            >
              <div className="text-center mb-6">
                <Gift className="w-12 h-12 text-primary mx-auto mb-4" />
                <h2 className="text-xl font-bold text-foreground">
                  Ingresa tu teléfono
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Para agregar el regalo a tu cuenta
                </p>
              </div>

              <form onSubmit={handleClaim} className="space-y-4">
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="tel"
                    placeholder="10 dígitos"
                    value={telefono}
                    onChange={handlePhoneChange}
                    className="pl-12 h-14 text-lg"
                    maxLength={10}
                    disabled={claiming}
                    autoFocus
                  />
                </div>

                <Button
                  type="submit"
                  variant="investment"
                  size="lg"
                  className="w-full h-14 text-lg"
                  disabled={claiming || !isValidPhone(telefono)}
                >
                  {claiming ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Reclamar'
                  )}
                </Button>
              </form>

              <p className="text-xs text-muted-foreground text-center mt-4">
                Exclusivo para clientes Partner de Manny
              </p>
            </motion.div>
          )}

          {/* STEP 4: Claimed - Éxito (transitorio) */}
          {claimed && step === 'claim' && (
            <motion.div
              key="claimed"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-6"
              >
                <PartyPopper className="w-12 h-12 text-white" />
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-3xl font-bold text-foreground mb-3"
              >
                ¡Listo!
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-lg text-muted-foreground mb-2"
              >
                Tu regalo ha sido agregado a tu cuenta
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default GiftLanding;
