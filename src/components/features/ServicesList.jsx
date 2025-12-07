import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Gift, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

const ServicesList = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [confirmDialog, setConfirmDialog] = useState({ open: false, service: null });
  const queryClient = useQueryClient();

  const { data: services = [], isLoading: loading } = useQuery({
    queryKey: ['services', user?.id],
    queryFn: () => api.services.getServiciosCliente(user.id),
    enabled: !!user?.id,
  });

  const redeemMutation = useMutation({
    mutationFn: api.services.canjearServicioAsignado,
    onSuccess: async (data, variables) => {
      toast({
        title: "¡Servicio canjeado!",
        description: `Has canjeado: ${variables.nombre}. Te contactaremos pronto.`,
      });

      // Abrir WhatsApp con mensaje pre-llenado
      const message = `Hola, soy ${user.nombre} (Tel: ${user.telefono}). Acabo de canjear mi beneficio Partner: ${variables.nombre}`;
      const whatsappUrl = `https://wa.me/5214624844148?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');

      await queryClient.invalidateQueries(['services', user.id]);
      setConfirmDialog({ open: false, service: null });
    },
    onError: (error) => {
      toast({
        title: "Error al canjear",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleRedeem = (service) => {
    redeemMutation.mutate(service);
  };

  const redeeming = redeemMutation.isPending;

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  }

  if (services.length === 0) {
    return null;
  }

  return (
    <div className="mb-8 px-4 md:px-0">
      <div className="flex items-center gap-2 mb-4">
        <Gift className="w-6 h-6 text-purple-500" />
        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-pink-500">
          Mis Beneficios Exclusivos
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((service) => (
          <motion.div
            key={service.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-pink-500/5 overflow-hidden relative">
              <div className="absolute top-0 right-0 p-2">
                <Badge
                  variant={service.estado === 'canjeado' ? 'secondary' : 'default'}
                  className={service.estado === 'canjeado' ? 'bg-muted text-muted-foreground' : 'bg-purple-500 hover:bg-purple-600'}
                >
                  {service.estado === 'canjeado' ? 'Canjeado' : 'Disponible'}
                </Badge>
              </div>
              <CardHeader>
                <CardTitle className="text-lg">{service.nombre}</CardTitle>
                <CardDescription>{service.descripcion || 'Beneficio exclusivo para socios'}</CardDescription>
              </CardHeader>
              <CardFooter>
                {service.estado !== 'canjeado' ? (
                  <Button
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg shadow-purple-500/25"
                    onClick={() => setConfirmDialog({ open: true, service })}
                  >
                    <Gift className="w-4 h-4 mr-2" />
                    Canjear Ahora
                  </Button>
                ) : (
                  <Button variant="outline" disabled className="w-full">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Canjeado el {new Date(service.fecha_canje).toLocaleDateString('es-MX')}
                  </Button>
                )}
              </CardFooter>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Diálogo de confirmación */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ open, service: null })}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-xl">Confirmar Canje</DialogTitle>
            <DialogDescription>
              ¿Deseas canjear tu beneficio <strong>{confirmDialog.service?.nombre}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Al confirmar, se abrirá WhatsApp para coordinar la entrega de tu beneficio.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline" disabled={redeeming}>Cancelar</Button>
            </DialogClose>
            <Button
              variant="investment"
              onClick={() => handleRedeem(confirmDialog.service)}
              disabled={redeeming}
            >
              {redeeming ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Canjeando...
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Confirmar y Contactar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServicesList;
