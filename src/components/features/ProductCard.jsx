import { memo, useCallback } from 'react';
import { Gift, Lock, XCircle, Wrench, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const ProductCard = memo(({ producto, userPoints = 0 }) => {
  const navigate = useNavigate();

  if (!producto || typeof userPoints !== 'number') {
    console.error('ProductCard: Invalid props received.', { producto, userPoints });
    return null;
  }

  const isService = producto.tipo === 'servicio';
  const canAfford = userPoints >= producto.puntos_requeridos;
  const isAvailable = producto.activo && (isService || producto.stock > 0);
  const canRedeem = canAfford && isAvailable;

  const handleClick = useCallback(() => {
    if (canRedeem) {
      navigate(`/canjear/${producto.id}`);
    }
  }, [canRedeem, navigate, producto.id]);

  const getButtonState = () => {
    if (!isAvailable) {
      return { text: 'No disponible', icon: <XCircle className="w-4 h-4 mr-2" />, disabled: true };
    }
    if (!canAfford) {
      const faltan = producto.puntos_requeridos - userPoints;
      return { text: `Te faltan ${faltan} pts`, icon: <Lock className="w-4 h-4 mr-2" />, disabled: true };
    }
    return { text: 'Canjear ahora', icon: <Gift className="w-4 h-4 mr-2" />, disabled: false };
  };

  const buttonState = getButtonState();

  return (
    <div
      onClick={handleClick}
      className={`bg-card rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden border border-border group ${
        canRedeem ? 'cursor-pointer' : 'cursor-not-allowed'
      } ${!isAvailable ? 'opacity-60' : ''}`}
    >
      {/* Image container with fixed aspect ratio */}
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        {producto.imagen_url ? (
          <img
            src={producto.imagen_url}
            alt={producto.nombre}
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
              <div className="w-16 h-16 rounded-2xl bg-muted-foreground/10 flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-muted-foreground/60" />
              </div>
            )}
          </div>
        )}

        {/* Type badge overlay */}
        <div className="absolute top-3 left-3">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg backdrop-blur-sm capitalize ${
            isService
              ? 'bg-blue-500/90 text-white'
              : 'bg-rose-500/90 text-white'
          }`}>
            {producto.tipo}
          </span>
        </div>

        {/* Unavailable overlay */}
        {!isAvailable && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="text-center text-white">
              <XCircle className="w-10 h-10 mx-auto" />
              <p className="font-semibold mt-2">No disponible</p>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-base font-bold text-foreground line-clamp-2 min-h-[2.5rem] uppercase tracking-tight">
          {producto.nombre}
        </h3>

        {producto.descripcion && (
          <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
            {producto.descripcion}
          </p>
        )}

        {/* Price and Stock row */}
        <div className="flex items-center justify-between mt-3 mb-3">
          <span className="font-bold text-xl text-primary">{producto.puntos_requeridos.toLocaleString()} pts</span>
          {!isService && isAvailable && producto.stock > 0 && producto.stock <= 10 && (
            <span className="font-semibold text-xs px-2 py-1 rounded-lg bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
              ¡Pocos!
            </span>
          )}
        </div>

        {/* Action button */}
        <Button
          disabled={buttonState.disabled}
          variant={buttonState.disabled ? "outline" : "investment"}
          size="lg"
          className={`w-full h-11 text-sm ${buttonState.disabled ? 'text-muted-foreground border-dashed' : ''}`}
        >
          {buttonState.icon}
          {buttonState.text}
        </Button>
      </div>
    </div>
  );
});

ProductCard.displayName = 'ProductCard';

export default ProductCard;
