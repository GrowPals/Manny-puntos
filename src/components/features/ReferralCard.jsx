import React, { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Users, Share2, ChevronRight, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { CACHE_CONFIG } from '@/config';

const ReferralCard = memo(() => {
  const { user } = useAuth();

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

  const openWhatsApp = useCallback(() => {
    const message = encodeURIComponent(
      `${config?.mensaje_compartir || '¡Únete a Manny Rewards!'}\n\n${referralLink}`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  }, [config?.mensaje_compartir, referralLink]);

  const handleShare = useCallback(async (e) => {
    e.stopPropagation();
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

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border h-[60px] flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl border border-border overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 pb-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="font-bold text-sm uppercase tracking-tight">Invita y Gana</span>
          <span className="text-[10px] text-muted-foreground">+{config?.puntos_referidor || 100} pts por amigo</span>
        </div>
        <Link to="/mis-referidos" className="text-xs text-primary font-medium flex items-center gap-0.5 hover:underline">
          Ver <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-2 px-3 pb-2">
        <div className="bg-muted/50 rounded-lg p-2 text-center">
          <p className="text-lg font-bold text-foreground">{stats?.referidos_activos || 0}</p>
          <p className="text-[10px] text-muted-foreground">Referidos</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-2 text-center">
          <p className="text-lg font-bold text-primary">{stats?.puntos_ganados || 0}</p>
          <p className="text-[10px] text-muted-foreground">Pts ganados</p>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2 p-3 pt-0">
        <button
          onClick={handleShare}
          className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-lg py-2 text-sm font-medium transition-colors"
        >
          <Share2 className="w-4 h-4" />
          Compartir
        </button>
        <Link
          to="/mis-referidos"
          className="flex items-center justify-center gap-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg py-2 text-sm font-medium transition-colors"
        >
          <Users className="w-4 h-4" />
          Mis referidos
        </Link>
      </div>
    </motion.section>
  );
});

ReferralCard.displayName = 'ReferralCard';

export default ReferralCard;
