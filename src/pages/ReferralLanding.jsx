import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Gift, Phone, Loader2, CheckCircle, XCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import MannyLogo from '@/assets/images/manny-logo-new.svg';
import { VALIDATION, STORAGE_CONFIG, isValidPhone } from '@/config';
import { safeStorage } from '@/lib/utils';
import AppDownloadStep from '@/components/AppDownloadStep';

const ReferralLanding = () => {
  const { codigo } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, checkCliente, loginFirstTime } = useAuth();

  const [loading, setLoading] = useState(true);
  const [referralData, setReferralData] = useState(null);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);

  const [telefono, setTelefono] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false); // Prevent double submission
  const [showDownloadStep, setShowDownloadStep] = useState(false);
  const [registeredClienteId, setRegisteredClienteId] = useState(null);

  // Si ya está logueado, redirigir
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Validar código
  useEffect(() => {
    const validateCode = async () => {
      if (!codigo) {
        setError('Código no proporcionado');
        setLoading(false);
        return;
      }

      try {
        const [codeData, configData] = await Promise.all([
          api.referrals.validateReferralCode(codigo),
          api.referrals.getReferralConfig()
        ]);

        if (!codeData) {
          setError('Este código de referido no es válido o ha expirado');
        } else if (!configData?.activo) {
          setError('El programa de referidos no está disponible en este momento');
        } else {
          setReferralData(codeData);
          setConfig(configData);
        }
      } catch (err) {
        console.error('Error validating code:', err);
        setError('Error al validar el código');
      } finally {
        setLoading(false);
      }
    };

    validateCode();
  }, [codigo]);

  const handlePhoneChange = (e) => {
    const formatted = e.target.value.replace(/\D/g, '').slice(0, VALIDATION.PHONE.LENGTH);
    setTelefono(formatted);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Prevent double submission
    if (submitting || submitAttempted) {
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

    setSubmitting(true);
    setSubmitAttempted(true);

    try {
      // Verificar si el cliente existe
      const result = await checkCliente(telefono);

      if (result.exists) {
        // Cliente existente - guardar código en localStorage para aplicar después
        safeStorage.setString(STORAGE_CONFIG.LOCAL_STORAGE_KEYS.PENDING_REFERRAL_CODE, codigo);
        toast({
          title: 'Ya tienes cuenta',
          description: 'Inicia sesión para aplicar el código de referido'
        });
        navigate('/login');
        return;
      }

      // Cliente nuevo - crear cuenta y aplicar código
      // skipNavigation para mostrar primero el paso de descarga de app
      const clienteData = await loginFirstTime(telefono, { skipNavigation: true });

      if (clienteData?.id) {
        // Aplicar código de referido
        const applyResult = await api.referrals.applyReferralCode(clienteData.id, codigo);

        if (applyResult.success) {
          toast({
            title: '¡Bienvenido!',
            description: `Te registraste con el código de ${referralData.cliente?.nombre?.split(' ')[0]}. ¡Recibirás ${config.puntos_referido} puntos con tu primer servicio!`
          });
        }

        // Guardar clienteId y mostrar paso de descarga
        setRegisteredClienteId(clienteData.id);
        setShowDownloadStep(true);
        return;
      }

      // Fallback si no hay clienteData (no debería pasar)
      navigate('/dashboard');
    } catch (err) {
      console.error('Error en registro:', err);
      toast({
        title: 'Error',
        description: err.message || 'No pudimos completar el registro',
        variant: 'destructive'
      });
      // Reset submitAttempted to allow retry on error
      setSubmitAttempted(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
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
          <h1 className="text-2xl font-bold text-foreground mb-2">Link no válido</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => navigate('/login')} variant="outline">
            Ir al inicio
          </Button>
        </motion.div>
      </div>
    );
  }

  const referrerName = referralData?.cliente?.nombre?.split(' ')[0] || 'Tu amigo';

  // Mostrar paso de descarga después del registro exitoso
  if (showDownloadStep) {
    return (
      <AppDownloadStep
        clienteId={registeredClienteId}
        colorTema="#E91E63"
        benefitText={`tus ${config?.puntos_referido || 50} puntos de bienvenida`}
        onComplete={() => navigate('/dashboard')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 z-0">
        <div className="absolute h-full w-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(233,30,99,0.15),rgba(255,255,255,0))]" />
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 4, repeat: Infinity }}
          className="absolute top-20 left-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 5, repeat: Infinity, delay: 1 }}
          className="absolute bottom-20 right-10 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl"
        />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-card/80 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full border border-border shadow-2xl"
        >
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img src={MannyLogo} alt="Manny" className="h-12" />
          </div>

          {/* Gift icon with animation */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="flex justify-center mb-6"
          >
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
                <Gift className="w-10 h-10 text-white" />
              </div>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0"
              >
                <Sparkles className="w-6 h-6 text-yellow-400 absolute -top-1 -right-1" />
              </motion.div>
            </div>
          </motion.div>

          {/* Title */}
          <div className="text-center mb-8">
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-2xl font-bold text-foreground mb-2"
            >
              {config?.titulo_landing || `¡${referrerName} te invitó!`}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-muted-foreground"
            >
              {config?.subtitulo_landing || 'Únete a Manny Rewards y gana puntos'}
            </motion.p>
          </div>

          {/* Benefit highlight */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="bg-gradient-to-r from-primary/10 to-purple-500/10 rounded-xl p-4 mb-6 border border-primary/20"
          >
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-500 shrink-0" />
              <div>
                <p className="font-semibold text-foreground">
                  Recibe {config?.puntos_referido || 50} puntos de bienvenida
                </p>
                <p className="text-sm text-muted-foreground">
                  Cuando contrates tu primer servicio con Manny
                </p>
              </div>
            </div>
          </motion.div>

          {/* Form */}
          <motion.form
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Tu número de teléfono
              </label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="tel"
                  placeholder="10 dígitos"
                  value={telefono}
                  onChange={handlePhoneChange}
                  className="pl-12 h-14 text-lg"
                  maxLength={10}
                  disabled={submitting}
                  autoFocus
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="investment"
              size="lg"
              className="w-full h-14 text-lg"
              disabled={submitting || !isValidPhone(telefono)}
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Unirme a Manny Rewards'
              )}
            </Button>
          </motion.form>

          {/* Footer */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-center text-xs text-muted-foreground mt-6"
          >
            Al registrarte aceptas los términos del programa de recompensas
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
};

export default ReferralLanding;
