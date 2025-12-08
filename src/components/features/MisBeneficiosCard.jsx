import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Gift, Clock, AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

const MisBeneficiosCard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activatingId, setActivatingId] = useState(null);

  const { data: beneficios = [], isLoading } = useQuery({
    queryKey: ['mis-beneficios', user?.id],
    queryFn: () => api.gifts.getMisBeneficios(user?.id),
    enabled: !!user?.id,
  });

  // Obtener configuración global para el umbral de alerta
  const { data: config } = useQuery({
    queryKey: ['config-global'],
    queryFn: api.config.getConfigGlobal,
    staleTime: 5 * 60 * 1000,
  });

  // Mutation para activar beneficio
  const activarMutation = useMutation({
    mutationFn: ({ tipo, id }) => api.gifts.activarRecompensa(tipo, id, user?.id),
    onSuccess: (data) => {
      toast({
        title: '¡Beneficio activado!',
        description: 'Te contactaremos pronto para coordinar tu servicio.',
      });
      // Refrescar la lista de beneficios
      queryClient.invalidateQueries({ queryKey: ['mis-beneficios'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo activar el beneficio',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setActivatingId(null);
    }
  });

  const handleActivar = (beneficio) => {
    setActivatingId(beneficio.id);
    activarMutation.mutate({ tipo: 'beneficio', id: beneficio.id });
  };

  const alertaVencimientoDias = config?.alerta_vencimiento_dias || 30;

  // Solo mostrar beneficios activos
  const beneficiosActivos = beneficios.filter(b => b.estado === 'activo');

  // No mostrar nada si no hay beneficios activos y no está cargando
  if (!isLoading && beneficiosActivos.length === 0) {
    return null;
  }

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
      <div className="bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-purple-500/10 rounded-2xl border border-purple-500/20 p-5">
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
              // Use dias_restantes from RPC if available, otherwise calculate
              const daysRemaining = beneficio.dias_restantes ?? getDaysRemaining(beneficio.fecha_expiracion);
              const isExpiringSoon = daysRemaining !== null && daysRemaining <= alertaVencimientoDias && daysRemaining > 0;

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
                          {beneficio.nombre || beneficio.nombre_beneficio}
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
                      {(beneficio.instrucciones || beneficio.instrucciones_uso) && (
                        <div className="mt-3 p-2 bg-blue-500/5 rounded-lg border border-blue-500/20">
                          <p className="text-xs text-blue-600">
                            <strong>Cómo usarlo:</strong> {beneficio.instrucciones || beneficio.instrucciones_uso}
                          </p>
                        </div>
                      )}

                      {/* Botón de activar - solo para beneficios de servicio con notion_ticket_id */}
                      {beneficio.notion_ticket_id && beneficio.tipo === 'servicio' && (
                        <div className="mt-3">
                          <Button
                            onClick={() => handleActivar(beneficio)}
                            disabled={activatingId === beneficio.id}
                            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                            size="sm"
                          >
                            {activatingId === beneficio.id ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Activando...
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-4 h-4 mr-2" />
                                Usar Ahora
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Mensaje informativo */}
        <p className="text-xs text-muted-foreground mt-4 text-center">
          Presiona "Usar Ahora" cuando estés listo para tu servicio, o contáctanos por WhatsApp.
        </p>
      </div>
    </motion.div>
  );
};

export default MisBeneficiosCard;
