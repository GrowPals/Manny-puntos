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
      <div className="relative overflow-hidden rounded-3xl">
        {/* Fondo con gradiente más vibrante */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 via-fuchsia-500/15 to-pink-500/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-400/10 via-transparent to-transparent" />

        <div className="relative p-6">
          {/* Header mejorado */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-2xl blur-lg opacity-50" />
              <div className="relative p-3 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-2xl shadow-lg">
                <Gift className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <h3 className="font-bold text-xl text-foreground">Mis Beneficios</h3>
              <p className="text-sm text-muted-foreground">
                {beneficiosActivos.length} {beneficiosActivos.length === 1 ? 'regalo disponible' : 'regalos disponibles'}
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full blur-md opacity-50 animate-pulse" />
                <Loader2 className="relative w-8 h-8 animate-spin text-violet-500" />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {beneficiosActivos.map((beneficio, index) => {
                const daysRemaining = beneficio.dias_restantes ?? getDaysRemaining(beneficio.fecha_expiracion);
                const isExpiringSoon = daysRemaining !== null && daysRemaining <= alertaVencimientoDias && daysRemaining > 0;

                return (
                  <motion.div
                    key={beneficio.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="group relative"
                  >
                    {/* Glow effect on hover */}
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-2xl opacity-0 group-hover:opacity-20 blur transition-opacity duration-300" />

                    <div className="relative bg-card/90 backdrop-blur-xl rounded-2xl p-5 border border-white/10 shadow-xl">
                      {/* Status badge flotante */}
                      <div className="absolute -top-2 right-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg shadow-green-500/25">
                          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                          Activo
                        </span>
                      </div>

                      {/* Contenido principal */}
                      <div className="pt-2">
                        <h4 className="font-bold text-lg text-foreground mb-2 pr-16">
                          {beneficio.nombre || beneficio.nombre_beneficio}
                        </h4>

                        {beneficio.descripcion && (
                          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                            {beneficio.descripcion}
                          </p>
                        )}

                        {/* Fechas en pills */}
                        <div className="flex flex-wrap gap-2 mb-4">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400">
                            <Clock className="w-3.5 h-3.5" />
                            Canjeado: {formatDate(beneficio.fecha_canje)}
                          </span>

                          {daysRemaining !== null && (
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full ${
                              isExpiringSoon
                                ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                                : 'bg-slate-500/10 text-slate-600 dark:text-slate-400'
                            }`}>
                              {isExpiringSoon && <AlertTriangle className="w-3.5 h-3.5" />}
                              {isExpiringSoon ? `Expira en ${daysRemaining} días` : `Expira: ${formatDate(beneficio.fecha_expiracion)}`}
                            </span>
                          )}
                        </div>

                        {/* Instrucciones con mejor diseño */}
                        {(beneficio.instrucciones || beneficio.instrucciones_uso) && (
                          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-500/5 to-cyan-500/5 border border-blue-500/10 p-4 mb-4">
                            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-cyan-500" />
                            <p className="text-sm text-blue-700 dark:text-blue-300 pl-3">
                              <span className="font-semibold">Como usarlo:</span>{' '}
                              <span className="text-blue-600/80 dark:text-blue-400/80">
                                {beneficio.instrucciones || beneficio.instrucciones_uso}
                              </span>
                            </p>
                          </div>
                        )}

                        {/* Botón mejorado */}
                        {beneficio.notion_ticket_id && beneficio.tipo === 'servicio' && (
                          <Button
                            onClick={() => handleActivar(beneficio)}
                            disabled={activatingId === beneficio.id}
                            className="w-full h-12 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 hover:from-violet-700 hover:via-fuchsia-600 hover:to-pink-600 text-white font-semibold rounded-xl shadow-lg shadow-fuchsia-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-fuchsia-500/30 hover:scale-[1.02]"
                          >
                            {activatingId === beneficio.id ? (
                              <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                Activando...
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-5 h-5 mr-2" />
                                Usar Ahora
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Footer mejorado */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground/80">
              Presiona <span className="font-medium text-violet-500">"Usar Ahora"</span> cuando estes listo, o contactanos por WhatsApp
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default MisBeneficiosCard;
