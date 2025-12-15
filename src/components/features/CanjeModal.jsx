import { useState, useCallback } from 'react';
import { CheckCircle, Loader2, AlertTriangle, Wrench, Package, MessageCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { CONTACT_CONFIG } from '@/config';

/**
 * CanjeModal - Modal for confirming product redemption
 *
 * @param {Object} producto - Product to redeem
 * @param {boolean} open - Whether modal is open
 * @param {function} onOpenChange - Callback when open state changes
 */
const CanjeModal = ({ producto, open, onOpenChange }) => {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canjeExitoso, setCanjeExitoso] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Calculate validation state
  const canAfford = user?.puntos_actuales >= producto?.puntos_requeridos;
  const isService = producto?.tipo === 'servicio';
  const isAvailable = producto?.activo && (isService || producto?.stock > 0);
  const canRedeem = canAfford && isAvailable;

  const getValidationError = () => {
    if (!canAfford) {
      return 'No tienes puntos Manny suficientes para esta recompensa.';
    }
    if (!isAvailable) {
      return 'Esta recompensa no está disponible actualmente.';
    }
    return null;
  };

  const validationError = getValidationError();

  const handleConfirmarCanje = useCallback(async () => {
    if (!producto || validationError || !user?.id) return;

    setIsSubmitting(true);
    try {
      const { nuevoSaldo, mensaje } = await api.redemptions.registrarCanje({
        cliente_id: user.id,
        producto_id: producto.id,
        cliente_nombre: user.nombre,
        producto_nombre: producto.nombre,
        puntos_producto: producto.puntos_requeridos
      });
      updateUser({ puntos_actuales: nuevoSaldo });
      setSuccessMessage(mensaje);
      setCanjeExitoso(true);
      toast({
        title: "¡Canje exitoso!",
        description: mensaje,
      });
    } catch (err) {
      toast({
        title: "Error al canjear",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [producto, validationError, user, updateUser, toast]);

  const handleClose = () => {
    // Reset state when closing
    if (canjeExitoso) {
      setCanjeExitoso(false);
      setSuccessMessage('');
    }
    onOpenChange(false);
  };

  const handleVerMisCanjes = () => {
    handleClose();
    navigate('/mis-canjes');
  };

  if (!producto) return null;

  const saldoRestante = (user?.puntos_actuales || 0) - producto.puntos_requeridos;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border text-foreground sm:max-w-md">
        {canjeExitoso ? (
          // Success state - Explicación clara del siguiente paso
          <div className="text-center py-2">
            {/* Icono de éxito */}
            <div className="relative w-20 h-20 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping" />
              <div className="relative w-full h-full rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg">
                <CheckCircle className="w-10 h-10 text-white" aria-hidden="true" />
              </div>
            </div>

            <DialogTitle className="text-2xl font-bold mb-2">¡Canje Registrado!</DialogTitle>

            {/* Producto canjeado */}
            <div className="bg-muted/50 rounded-xl p-3 mb-4 inline-flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                {isService ? (
                  <Wrench className="w-5 h-5 text-primary" />
                ) : (
                  <Package className="w-5 h-5 text-primary" />
                )}
              </div>
              <span className="font-medium text-sm">{producto.nombre}</span>
            </div>

            {/* Explicación del siguiente paso */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-5">
              <div className="flex items-start gap-3 text-left">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MessageCircle className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-1">
                    {isService ? '¿Cómo agendar tu servicio?' : '¿Cómo recibir tu producto?'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isService
                      ? 'Contáctanos por WhatsApp para coordinar fecha y hora de tu servicio.'
                      : 'Contáctanos por WhatsApp para coordinar la entrega de tu producto.'
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex flex-col gap-3">
              <a
                href={`https://wa.me/${CONTACT_CONFIG.WHATSAPP_SERVICES}?text=${encodeURIComponent(
                  `Hola, acabo de canjear "${producto.nombre}" con mis puntos Manny y quiero coordinar ${isService ? 'el servicio' : 'la entrega'}. Mi nombre es ${user?.nombre || 'Cliente'}.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full"
              >
                <Button
                  className="w-full h-12 text-base font-semibold bg-[#25D366] hover:bg-[#20BD5A] text-white gap-2"
                >
                  <MessageCircle className="w-5 h-5" />
                  Contactar por WhatsApp
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </a>

              <Button
                variant="outline"
                onClick={handleVerMisCanjes}
                className="w-full"
              >
                Ver mis canjes
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-4">
              Tu canje queda guardado en "Mis Canjes"
            </p>
          </div>
        ) : (
          // Confirmation state
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">Confirmar Canje</DialogTitle>
            </DialogHeader>

            {/* Product info */}
            <div className="flex items-center gap-4 py-4">
              <div className="w-20 h-20 bg-muted rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                {producto.imagen_url ? (
                  <img
                    src={producto.imagen_url}
                    alt={producto.nombre}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : isService ? (
                  <Wrench className="w-8 h-8 text-primary" aria-hidden="true" />
                ) : (
                  <Package className="w-8 h-8 text-primary" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-lg line-clamp-2">{producto.nombre}</h3>
                {producto.descripcion && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {producto.descripcion}
                  </p>
                )}
              </div>
            </div>

            {/* Points summary */}
            <div className="bg-muted/50 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Costo:</span>
                <span className="font-bold text-lg text-primary">
                  {producto.puntos_requeridos.toLocaleString()} pts
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Tu saldo actual:</span>
                <span className="font-semibold">
                  {(user?.puntos_actuales || 0).toLocaleString()} pts
                </span>
              </div>
              <div className="border-t border-border pt-3 flex justify-between items-center">
                <span className="text-muted-foreground">Saldo después:</span>
                <span className={`font-bold text-lg ${saldoRestante >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {saldoRestante.toLocaleString()} pts
                </span>
              </div>
            </div>

            {/* Validation error */}
            {validationError && (
              <div className="flex items-center gap-3 bg-destructive/10 text-destructive p-3 rounded-xl" role="alert">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                <p className="text-sm font-medium">{validationError}</p>
              </div>
            )}

            <DialogFooter className="gap-2 mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                variant="investment"
                onClick={handleConfirmarCanje}
                disabled={isSubmitting || !!validationError}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                    Procesando...
                  </>
                ) : (
                  'Confirmar Canje'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CanjeModal;
