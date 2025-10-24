import React from 'react';
import { motion } from 'framer-motion';
import { Gift, Lock, XCircle, Hammer, Image as ImageIcon, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

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
        return { text: `Te faltan ${producto.puntos_requeridos - userPoints} pts`, icon: <Lock className="w-4 h-4 mr-2" />, disabled: true, variant: "secondary" };
    }
    return { text: 'Canjear ahora', icon: <Gift className="w-4 h-4 mr-2" />, disabled: false, variant: "investment" };
  };

  const buttonState = getButtonState();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={canRedeem ? { y: -8, boxShadow: '0 8px 24px rgba(233, 30, 99, 0.25)' } : {}}
      onClick={handleClick}
      className={`card bg-card rounded-2xl overflow-hidden transition-all flex flex-col ${canRedeem ? 'cursor-pointer' : 'cursor-not-allowed'}`}
    >
        <div className="relative">
            <div className="h-48 bg-muted flex items-center justify-center">
                {producto.imagen_url ? (
                    <img src={producto.imagen_url} alt={producto.nombre} className="w-full h-full object-cover" />
                ) : (
                    isService ? <Wrench className="w-20 h-20 text-primary opacity-70" /> : <Hammer className="w-20 h-20 text-primary opacity-70" />
                )}
            </div>
            {!isAvailable && (
                 <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center">
                    <div className="text-center text-white">
                        <XCircle className="w-12 h-12 mx-auto" />
                        <p className="font-bold mt-2">No disponible</p>
                    </div>
                </div>
            )}
        </div>
      <div className="p-6 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-2">
            <h3 className="text-xl font-bold text-foreground uppercase tracking-tight flex-1 pr-2">{producto.nombre}</h3>
            <span className={`text-xs font-bold px-2 py-1 rounded-full uppercase ${isService ? 'bg-green-500/20 text-green-300' : 'bg-blue-500/20 text-blue-300'}`}>{producto.tipo}</span>
        </div>
        <p className="text-muted-foreground text-sm mb-4 flex-grow">{producto.descripcion}</p>
        
        <div className="flex items-center justify-between mb-4">
            <span className="text-2xl font-black text-primary font-mono">
                {producto.puntos_requeridos} pts Manny
            </span>
             {!isService && isAvailable && producto.stock < 10 && (
                <span className="text-xs font-semibold text-yellow-300 bg-yellow-900/50 px-2 py-1 rounded-full">¡Pocos!</span>
            )}
        </div>

        <Button
            disabled={buttonState.disabled}
            variant={buttonState.variant}
            className="w-full mt-auto"
        >
            {buttonState.icon}
            {buttonState.text}
        </Button>
      </div>
    </motion.div>
  );
};

export default ProductCard;