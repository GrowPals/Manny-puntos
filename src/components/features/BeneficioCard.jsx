import { memo, useState } from 'react';
import { Gift, Sparkles, Wrench, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';

const BeneficioCard = memo(({ beneficio }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isActivating, setIsActivating] = useState(false);

  const isService = beneficio.tipo === 'servicio';
  const imagenUrl = beneficio.imagen_url || beneficio.campana_imagen;

  const activarMutation = useMutation({
    mutationFn: () => api.gifts.activarRecompensa('beneficio', beneficio.id, user?.id),
    onSuccess: () => {
      toast({
        title: 'Beneficio activado',
        description: 'Te contactaremos pronto para coordinar.',
      });
      queryClient.invalidateQueries({ queryKey: ['mis-beneficios'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo activar',
        variant: 'destructive',
      });
    },
    onSettled: () => setIsActivating(false),
  });

  const handleActivar = () => {
    setIsActivating(true);
    activarMutation.mutate();
  };

  return (
    <div className="bg-card rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden border border-border group cursor-pointer">
      {/* Image container */}
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        {imagenUrl ? (
          <img
            src={imagenUrl}
            alt={beneficio.nombre || beneficio.nombre_beneficio}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {isService ? (
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Wrench className="w-8 h-8 text-primary/60" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center">
                <Gift className="w-8 h-8 text-violet-500/60" />
              </div>
            )}
          </div>
        )}

        {/* Regalo badge */}
        <div className="absolute top-3 left-3">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg backdrop-blur-sm bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white">
            Regalo
          </span>
        </div>

        {/* Status badge - Listo para usar */}
        <div className="absolute top-3 right-3">
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg backdrop-blur-sm bg-emerald-500/90 text-white">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            Activo
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-base font-bold text-foreground line-clamp-2 min-h-[2.5rem] uppercase tracking-tight">
          {beneficio.nombre || beneficio.nombre_beneficio}
        </h3>

        {beneficio.descripcion && (
          <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
            {beneficio.descripcion}
          </p>
        )}

        {/* Sin precio - ya esta pagado */}
        <div className="flex items-center justify-between mt-3 mb-3">
          <span className="font-semibold text-sm text-emerald-600 dark:text-emerald-400">
            Listo para usar
          </span>
        </div>

        {/* Action button */}
        <Button
          onClick={handleActivar}
          disabled={isActivating}
          variant="investment"
          size="lg"
          className="w-full h-11 text-sm"
        >
          {isActivating ? (
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
    </div>
  );
});

BeneficioCard.displayName = 'BeneficioCard';

export default BeneficioCard;
