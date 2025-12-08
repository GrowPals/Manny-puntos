import React, { useState, memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Gift, Copy, Share2, Users, ChevronRight, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { CACHE_CONFIG } from '@/config';

const ReferralCard = memo(() => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['referral-stats', user?.id],
    queryFn: () => api.referrals.getReferralStats(user.id),
    enabled: !!user?.id,
    staleTime: CACHE_CONFIG.REFERRALS_STALE_TIME,
  });

  const { data: config } = useQuery({
    queryKey: ['referral-config'],
    queryFn: api.referrals.getReferralConfig,
    staleTime: CACHE_CONFIG.STALE_TIME,
  });

  if (config && !config.activo) {
    return null;
  }

  const referralLink = stats?.codigo
    ? `${window.location.origin}/r/${stats.codigo}`
    : null;

  const handleCopy = useCallback(async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast({ title: 'Link copiado', description: 'Compártelo con tus amigos' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Error', description: 'No se pudo copiar el link', variant: 'destructive' });
    }
  }, [referralLink, toast]);

  const openWhatsApp = useCallback(() => {
    const message = encodeURIComponent(
      `${config?.mensaje_compartir || '¡Únete a Manny Rewards!'}\n\n${referralLink}`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  }, [config?.mensaje_compartir, referralLink]);

  const handleShare = useCallback(async () => {
    if (!referralLink || !config) return;
    const shareData = {
      title: 'Manny Rewards',
      text: config.mensaje_compartir || '¡Únete a Manny Rewards!',
      url: referralLink,
    };
    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if (err.name !== 'AbortError') openWhatsApp();
      }
    } else {
      openWhatsApp();
    }
  }, [referralLink, config, openWhatsApp]);

  const progressPercent = stats?.limite_mensual
    ? Math.min((stats.puntos_este_mes / stats.limite_mensual) * 100, 100)
    : 0;

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="flex items-center justify-center py-3">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl border border-border overflow-hidden"
    >
      {/* Compact Header */}
      <div className="p-3 bg-gradient-to-r from-primary/10 to-purple-500/10 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center">
              <Gift className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">Invita y Gana</h3>
              <p className="text-xs text-muted-foreground">
                +{config?.puntos_referidor || 100} pts por amigo
              </p>
            </div>
          </div>
          <Link to="/mis-referidos">
            <Button variant="ghost" size="sm" className="text-primary h-8 px-2 text-xs">
              Ver <ChevronRight className="w-3 h-3 ml-0.5" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* Stats - Compact horizontal layout */}
        {stats && (
          <div className="flex gap-2">
            <div className="flex-1 bg-muted/50 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-foreground">{stats.referidos_activos || 0}</p>
              <p className="text-xs text-muted-foreground">Referidos</p>
            </div>
            <div className="flex-1 bg-muted/50 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-green-600 dark:text-green-400">{stats.puntos_ganados || 0}</p>
              <p className="text-xs text-muted-foreground">Pts ganados</p>
            </div>
          </div>
        )}

        {/* Monthly progress - More compact */}
        {stats?.limite_mensual && (
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Este mes</span>
              <span>{stats.puntos_este_mes || 0} / {stats.limite_mensual} pts</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.5 }}
                className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full"
              />
            </div>
          </div>
        )}

        {/* Link and actions - Compact */}
        {referralLink && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg p-2 border border-border">
              <code className="flex-1 text-xs text-foreground truncate">
                {referralLink.replace('https://', '')}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 h-9 bg-green-600 hover:bg-green-700 text-xs"
                onClick={handleShare}
              >
                <Share2 className="w-3.5 h-3.5 mr-1.5" />
                Compartir
              </Button>
              <Link to="/mis-referidos" className="flex-1">
                <Button variant="outline" size="sm" className="w-full h-9 text-xs">
                  <Users className="w-3.5 h-3.5 mr-1.5" />
                  Mis referidos
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Pending referrals */}
        {stats?.referidos_pendientes > 0 && (
          <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <p className="text-xs text-amber-600 dark:text-amber-400">
              <span className="font-semibold">{stats.referidos_pendientes}</span> amigo(s)
              pendiente(s) de usar los servicios
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
});

ReferralCard.displayName = 'ReferralCard';

export default ReferralCard;
