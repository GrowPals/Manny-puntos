
import React from 'react';
import { motion } from 'framer-motion';
import { Gift, Lock, XCircle, Hammer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const ProductCard = ({ producto, userPoints }) => {
  const navigate = useNavigate();
  const canAfford = userPoints >= producto.puntos_requeridos;
  const isAvailable = producto.activo && producto.stock > 0;
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
      whileHover={{ y: -8, boxShadow: '0 8px 24px rgba(233, 30, 99, 0.25)' }}
      onClick={handleClick}
      className={`card bg-secondary-light rounded-2xl overflow-hidden transition-all flex flex-col ${canRedeem ? 'cursor-pointer' : 'cursor-not-allowed'}`}
    >
        <div className="relative">
            <div className="h-48 bg-secondary flex items-center justify-center">
                <Hammer className="w-20 h-20 text-primary opacity-70" />
            </div>
            {!isAvailable && (
                 <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center">
                    <div className="text-center text-white">
                        <XCircle className="w-12 h-12 mx-auto" />
                        <p className="font-bold mt-2">Agotado</p>
                    </div>
                </div>
            )}
        </div>
      <div className="p-6 flex flex-col flex-grow">
        <h3 className="text-xl font-bold text-white uppercase tracking-tight mb-2">{producto.nombre}</h3>
        <p className="text-gray-400 text-sm mb-4 flex-grow">{producto.descripcion}</p>
        
        <div className="flex items-center justify-between mb-4">
            <span className="text-2xl font-black text-primary-vibrant font-mono">
                {producto.puntos_requeridos} pts Manny
            </span>
             {isAvailable && producto.stock < 10 && (
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
