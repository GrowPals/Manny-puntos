import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import {
  Users, Gift, Copy, Share2, Check, Loader2, Clock, CheckCircle,
  XCircle, Coins
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import StatCard from '@/components/common/StatCard';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { logger } from '@/lib/logger';

const MisReferidos = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: stats, isLoading: loadingStats, error: statsError } = useQuery({
    queryKey: ['referral-stats', user?.id],
    queryFn: () => api.referrals.getReferralStats(user.id),
    enabled: !!user?.id,
  });

  const { data: referidos, isLoading: loadingReferidos, error: referidosError } = useQuery({
    queryKey: ['mis-referidos', user?.id],
    queryFn: () => api.referrals.getMisReferidos(user.id),
    enabled: !!user?.id,
  });

  const { data: config } = useQuery({
    queryKey: ['referral-config'],
    queryFn: api.referrals.getReferralConfig,
  });

  // Handle errors
  useEffect(() => {
    const error = statsError || referidosError;
    if (error) {
      logger.error('Error loading referrals', { error: error.message });
      toast({
        title: 'Error',
        description: 'No pudimos cargar la información de referidos.',
        variant: 'destructive',
      });
    }
  }, [statsError, referidosError, toast]);

  const loading = loadingStats || loadingReferidos;

  const referralLink = stats?.codigo
    ? `${window.location.origin}/r/${stats.codigo}`
    : null;

  const handleCopy = async () => {
    if (!referralLink) return;

    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast({ title: 'Link copiado' });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ title: 'Error al copiar', variant: 'destructive' });
    }
  };

  const handleShare = async () => {
    if (!referralLink || !config) return;

    const shareData = {
      title: 'Manny Rewards',
      text: config.mensaje_compartir,
      url: referralLink,
    };

    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if (err.name !== 'AbortError') {
          openWhatsApp();
        }
      }
    } else {
      openWhatsApp();
    }
  };

  const openWhatsApp = () => {
    const message = encodeURIComponent(
      `${config?.mensaje_compartir || '¡Únete a Manny Rewards!'}\n\n${referralLink}`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const getEstadoBadge = (estado) => {
    switch (estado) {
      case 'activo':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-600">
            <CheckCircle className="w-3 h-3" /> Activo
          </span>
        );
      case 'pendiente':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600">
            <Clock className="w-3 h-3" /> Pendiente
          </span>
        );
      case 'expirado':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-600">
            <XCircle className="w-3 h-3" /> Expirado
          </span>
        );
      default:
        return null;
    }
  };

  const progressPercent = stats?.limite_mensual
    ? Math.min((stats.puntos_este_mes / stats.limite_mensual) * 100, 100)
    : 0;

  if (loading) {
    return <LoadingSpinner size="lg" />;
  }

  return (
    <>
      <Helmet>
        <title>Mis Referidos - Manny Rewards</title>
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Mis Referidos</h1>
              <p className="text-sm text-muted-foreground">
                Invita amigos y gana {config?.puntos_referidor || 100} pts por cada uno
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 gap-3 mb-6"
        >
          <StatCard
            icon={Users}
            label="Referidos activos"
            value={stats?.referidos_activos || 0}
          />
          <StatCard
            icon={Coins}
            label="Puntos ganados"
            value={stats?.puntos_ganados || 0}
            color="green-500"
          />
        </motion.div>

        {/* Progreso mensual */}
        {stats?.limite_mensual > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-card rounded-xl p-4 border border-border mb-6"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progreso este mes</span>
              <span className="text-sm text-muted-foreground">
                {stats.puntos_este_mes || 0} / {stats.limite_mensual} pts
              </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.5 }}
                className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Puedes ganar hasta {stats.limite_mensual} pts por mes con referidos
            </p>
          </motion.div>
        )}

        {/* Link de referido */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-primary/10 to-purple-500/10 rounded-xl p-5 border border-primary/20 mb-6"
        >
          <div className="flex items-center gap-2 mb-3">
            <Gift className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Tu link de referido</h3>
          </div>

          <div className="flex items-center gap-2 bg-card rounded-lg p-3 border border-border mb-3">
            <code className="flex-1 text-sm truncate">{referralLink}</code>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>

          <Button
            variant="default"
            className="w-full bg-green-600 hover:bg-green-700"
            onClick={handleShare}
          >
            <Share2 className="w-4 h-4 mr-2" />
            Compartir por WhatsApp
          </Button>
        </motion.div>

        {/* Cómo funciona */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-card rounded-xl p-5 border border-border mb-6"
        >
          <h3 className="font-semibold mb-4">¿Cómo funciona?</h3>
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">1</span>
              </div>
              <div>
                <p className="font-medium text-sm">Comparte tu link</p>
                <p className="text-xs text-muted-foreground">Envíalo por WhatsApp a tus amigos</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">2</span>
              </div>
              <div>
                <p className="font-medium text-sm">Tu amigo se registra</p>
                <p className="text-xs text-muted-foreground">Y contrata un servicio con Manny</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-green-500">3</span>
              </div>
              <div>
                <p className="font-medium text-sm">¡Ambos ganan puntos!</p>
                <p className="text-xs text-muted-foreground">
                  Tú ganas {config?.puntos_referidor || 100} pts, tu amigo gana {config?.puntos_referido || 50} pts
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Lista de referidos */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="font-semibold mb-4">Tus referidos ({referidos?.length || 0})</h3>

          {referidos && referidos.length > 0 ? (
            <div className="space-y-3">
              {referidos.map((ref) => (
                <div
                  key={ref.id}
                  className="bg-card rounded-xl p-4 border border-border"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        ref.estado === 'activo' ? 'bg-green-500/20 text-green-600' :
                        ref.estado === 'pendiente' ? 'bg-amber-500/20 text-amber-600' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        <span className="font-bold">
                          {ref.referido?.nombre?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">{ref.referido?.nombre || 'Usuario'}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(ref.created_at).toLocaleDateString('es-MX')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {getEstadoBadge(ref.estado)}
                      {ref.estado === 'activo' && ref.puntos_referidor > 0 && (
                        <p className="text-xs text-green-600 mt-1">
                          +{ref.puntos_referidor} pts
                        </p>
                      )}
                      {ref.estado === 'pendiente' && ref.fecha_expiracion && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Expira: {new Date(ref.fecha_expiracion).toLocaleDateString('es-MX')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-card rounded-xl p-8 border border-border text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">
                Aún no tienes referidos. ¡Comparte tu link!
              </p>
              <Button onClick={handleShare} className="bg-green-600 hover:bg-green-700">
                <Share2 className="w-4 h-4 mr-2" />
                Compartir ahora
              </Button>
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
};

export default MisReferidos;
