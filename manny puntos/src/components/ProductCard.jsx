
import React from 'react';
import { motion } from 'framer-motion';
import { Gift, Lock, XCircle, Hammer, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

const ProductCard = ({ producto, userPoints }) => {
  const navigate = useNavigate();
  const isService = producto.tipo === 'servicio';
  const canAfford = userPoints >= producto.puntos_requeridos;
  const isAvailable = producto.activo && (isService || producto.stock > 0);
  const canRedeem = canAfford && isAvailable;

  const handleClick = () => {
    if (canRedeem) {
        navigate(`/canjear/${producto.id}`);
    }
  };

  const getButtonState = () => {
    if (!isAvailable) {
        return { text: 'No disponible', icon: <XCircle className="w-4 h-4 mr-2" />, disabled: true, variant: "secondary" };
    }
    if (!canAfford) {
        return { text: `Te faltan ${producto.puntos_requeridos - userPoints}`, icon: <Lock className="w-4 h-4 mr-2" />, disabled: true, variant: "secondary" };
    }
    return { text: 'Canjear ahora', icon: <Gift className="w-4 h-4 mr-2" />, disabled: false, variant: "investment" };
  };

  const buttonState = getButtonState();

  const tagStyles = isService
    ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
    : "bg-sky-500/10 text-sky-500 border border-sky-500/20";
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={canRedeem ? { y: -5, boxShadow: '0 8px 24px hsla(var(--primary-raw), 0.15)' } : {}}
      onClick={handleClick}
      className={cn(
        `card bg-card rounded-2xl overflow-hidden transition-all flex flex-col h-full border`,
        canRedeem ? 'cursor-pointer' : 'cursor-not-allowed',
        !isAvailable && 'opacity-60'
      )}
    >
        <div className="relative aspect-[4/3]">
            <div className="absolute inset-0 bg-muted flex items-center justify-center">
                {producto.imagen_url ? (
                    <img src={producto.imagen_url} alt={producto.nombre} className="w-full h-full object-cover" />
                ) : (
                    isService ? <Wrench className="w-16 h-16 sm:w-20 sm:h-20 text-muted-foreground opacity-50" /> : <Hammer className="w-16 h-16 sm:w-20 sm:h-20 text-muted-foreground opacity-50" />
                )}
            </div>
            {!isAvailable && (
                 <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <div className="text-center text-white p-4">
                        <XCircle className="w-10 h-10 sm:w-12 sm:h-12 mx-auto" />
                        <p className="font-bold mt-2 text-base sm:text-lg">No disponible</p>
                    </div>
                </div>
            )}
        </div>
      <div className="p-4 sm:p-6 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-2 gap-2">
            <h3 className="text-base sm:text-lg font-bold text-foreground uppercase tracking-tight flex-1">{producto.nombre}</h3>
            <span className={cn(`text-xs font-bold px-2 py-1 rounded-full uppercase self-start`, tagStyles)}>{producto.tipo}</span>
        </div>
        <p className="text-muted-foreground text-sm mb-4 flex-grow">{producto.descripcion}</p>
        
        <div className="flex items-center justify-between my-2">
            <span className="text-xl sm:text-2xl font-black text-primary font-mono">
                {producto.puntos_requeridos} pts
            </span>
             {!isService && isAvailable && producto.stock > 0 && producto.stock <= 10 && (
                <span className="text-xs font-semibold text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded-full">¡Pocos!</span>
            )}
        </div>

        <Button
            disabled={buttonState.disabled}
            variant={buttonState.variant}
            size="lg"
            className="w-full mt-auto h-12 text-base"
        >
            {buttonState.icon}
            {buttonState.text}
        </Button>
      </div>
    </motion.div>
  );
};

export default ProductCard;
