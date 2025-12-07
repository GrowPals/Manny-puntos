import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Gift, Copy, Share2, Users, ChevronRight, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

const ReferralCard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['referral-stats', user?.id],
    queryFn: () => api.referrals.getReferralStats(user.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  const { data: config } = useQuery({
    queryKey: ['referral-config'],
    queryFn: api.referrals.getReferralConfig,
    staleTime: 1000 * 60 * 30, // 30 minutos
  });

  // Si el programa no está activo, no mostrar
  if (config && !config.activo) {
    return null;
  }

  const referralLink = stats?.codigo
    ? `${window.location.origin}/r/${stats.codigo}`
    : null;

  const handleCopy = async () => {
    if (!referralLink) return;

    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast({ title: 'Link copiado', description: 'Compártelo con tus amigos' });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ title: 'Error', description: 'No se pudo copiar el link', variant: 'destructive' });
    }
  };

  const handleShare = async () => {
    if (!referralLink || !config) return;

    const shareData = {
      title: 'Manny Rewards',
      text: config.mensaje_compartir || '¡Únete a Manny Rewards!',
      url: referralLink,
    };

    // Intentar Web Share API (móvil)
    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if (err.name !== 'AbortError') {
          // Si falla, abrir WhatsApp
          openWhatsApp();
        }
      }
    } else {
      // Fallback a WhatsApp
      openWhatsApp();
    }
  };

  const openWhatsApp = () => {
    const message = encodeURIComponent(
      `${config?.mensaje_compartir || '¡Únete a Manny Rewards!'}\n\n${referralLink}`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const progressPercent = stats?.limite_mensual
    ? Math.min((stats.puntos_este_mes / stats.limite_mensual) * 100, 100)
    : 0;

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl p-6 border border-border mb-6">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-primary/10 via-card to-purple-500/10 rounded-2xl p-6 border border-primary/20 mb-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
            <Gift className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-foreground">Invita y Gana</h3>
            <p className="text-sm text-muted-foreground">
              Gana {config?.puntos_referidor || 100} pts por cada amigo
            </p>
          </div>
        </div>
        <Link to="/mis-referidos">
          <Button variant="ghost" size="sm" className="text-primary">
            Ver más <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </div>

      {/* Stats rápidas */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-card/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-primary">{stats.referidos_activos || 0}</p>
            <p className="text-xs text-muted-foreground">Referidos activos</p>
          </div>
          <div className="bg-card/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-500">{stats.puntos_ganados || 0}</p>
            <p className="text-xs text-muted-foreground">Puntos ganados</p>
          </div>
        </div>
      )}

      {/* Progreso mensual */}
      {stats?.limite_mensual && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Este mes</span>
            <span>{stats.puntos_este_mes || 0} / {stats.limite_mensual} pts</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full"
            />
          </div>
        </div>
      )}

      {/* Link y botones */}
      {referralLink && (
        <div className="space-y-3">
          {/* Link display */}
          <div className="flex items-center gap-2 bg-card rounded-lg p-3 border border-border">
            <code className="flex-1 text-sm text-foreground truncate">
              {referralLink.replace('https://', '')}
            </code>
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

          {/* Share buttons */}
          <div className="flex gap-2">
            <Button
              variant="default"
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={handleShare}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Compartir
            </Button>
            <Link to="/mis-referidos" className="flex-1">
              <Button variant="outline" className="w-full">
                <Users className="w-4 h-4 mr-2" />
                Mis referidos
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Pendientes */}
      {stats?.referidos_pendientes > 0 && (
        <div className="mt-4 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
          <p className="text-sm text-amber-600 dark:text-amber-400">
            <span className="font-semibold">{stats.referidos_pendientes}</span> amigo(s)
            pendiente(s) de usar los servicios de Manny
          </p>
        </div>
      )}
    </motion.div>
  );
};

export default ReferralCard;
