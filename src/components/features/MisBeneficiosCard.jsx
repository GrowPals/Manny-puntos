import React from 'react';
import { motion } from 'framer-motion';
import { Gift, Clock, CheckCircle2, AlertTriangle, ChevronRight, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';

const MisBeneficiosCard = () => {
  const { user } = useAuth();

  const { data: beneficios = [], isLoading } = useQuery({
    queryKey: ['mis-beneficios', user?.id],
    queryFn: () => api.gifts.getMisBeneficios(user?.id),
    enabled: !!user?.id,
  });

  // Solo mostrar beneficios activos
  const beneficiosActivos = beneficios.filter(b => b.estado === 'activo');

  // No mostrar nada si no hay beneficios activos y no está cargando
  if (!isLoading && beneficiosActivos.length === 0) {
    return null;
  }

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getDaysRemaining = (expirationDate) => {
    if (!expirationDate) return null;
    const now = new Date();
    const expDate = new Date(expirationDate);
    const diffTime = expDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 px-4 md:px-0"
    >
      <div className="bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-purple-500/10 rounded-2xl border border-purple-500/20 p-5 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-purple-500/20 rounded-xl">
            <Gift className="w-6 h-6 text-purple-500" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-foreground">Mis Beneficios</h3>
            <p className="text-sm text-muted-foreground">Regalos que has recibido</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
          </div>
        ) : (
          <div className="space-y-3">
            {beneficiosActivos.map((beneficio) => {
              const daysRemaining = getDaysRemaining(beneficio.fecha_expiracion);
              const isExpiringSoon = daysRemaining !== null && daysRemaining <= 30;

              return (
                <motion.div
                  key={beneficio.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-card/80 backdrop-blur rounded-xl p-4 border border-border"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-foreground truncate">
                          {beneficio.nombre_beneficio}
                        </span>
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-500/10 text-green-500 border border-green-500/20 flex-shrink-0">
                          Activo
                        </span>
                      </div>

                      {beneficio.descripcion && (
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                          {beneficio.descripcion}
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Canjeado: {formatDate(beneficio.fecha_canje)}
                        </span>

                        {daysRemaining !== null && (
                          <span className={`flex items-center gap-1 ${
                            isExpiringSoon ? 'text-orange-500' : ''
                          }`}>
                            {isExpiringSoon && <AlertTriangle className="w-3 h-3" />}
                            Expira: {formatDate(beneficio.fecha_expiracion)}
                            {isExpiringSoon && ` (${daysRemaining} días)`}
                          </span>
                        )}
                      </div>

                      {/* Instrucciones de uso */}
                      {beneficio.instrucciones_uso && (
                        <div className="mt-3 p-2 bg-blue-500/5 rounded-lg border border-blue-500/20">
                          <p className="text-xs text-blue-600">
                            <strong>Cómo usarlo:</strong> {beneficio.instrucciones_uso}
                          </p>
                        </div>
                      )}
                    </div>

                    <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Mensaje informativo */}
        <p className="text-xs text-muted-foreground mt-4 text-center">
          Para usar un beneficio, simplemente envía un mensaje por WhatsApp mencionando que tienes este regalo.
        </p>
      </div>
    </motion.div>
  );
};

export default MisBeneficiosCard;
