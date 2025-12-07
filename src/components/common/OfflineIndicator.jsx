import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { WifiOff, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Indicador global de estado offline
 * Muestra una barra en la parte superior cuando no hay conexión
 */
export const OfflineIndicator = () => {
  const { isOnline, isSlowConnection } = useNetworkStatus();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-50 bg-red-500 text-white py-2 px-4 flex items-center justify-center gap-2 text-sm font-medium shadow-lg"
        >
          <WifiOff className="w-4 h-4" />
          <span>Sin conexión a internet</span>
        </motion.div>
      )}

      {isOnline && isSlowConnection && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-white py-2 px-4 flex items-center justify-center gap-2 text-sm font-medium shadow-lg"
        >
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Conexión lenta - algunas funciones pueden tardar</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * HOC para agregar validación de conexión antes de operaciones
 */
export const withNetworkCheck = (WrappedComponent) => {
  return function NetworkCheckedComponent(props) {
    const { isOnline } = useNetworkStatus();

    return <WrappedComponent {...props} isOnline={isOnline} />;
  };
};

export default OfflineIndicator;
