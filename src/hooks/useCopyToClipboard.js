import { useState, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';

/**
 * Centralized hook for clipboard operations
 * Consolidates copy-to-clipboard logic that was duplicated across:
 * - MisReferidos.jsx
 * - AdminRegalos.jsx
 *
 * @param {Object} options
 * @param {number} options.resetDelay - Time in ms before resetting copied state (default: 2000)
 * @returns {Object} Clipboard utilities
 */
export const useCopyToClipboard = ({ resetDelay = 2000 } = {}) => {
  const [copiedValue, setCopiedValue] = useState(null);
  const { toast } = useToast();

  const copy = useCallback(async (text, {
    successMessage = 'Copiado al portapapeles',
    errorMessage = 'Error al copiar',
  } = {}) => {
    if (!text) return false;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedValue(text);

      toast({
        title: successMessage,
      });

      setTimeout(() => setCopiedValue(null), resetDelay);
      return true;
    } catch (err) {
      console.error('Failed to copy:', err);
      toast({
        title: errorMessage,
        variant: 'destructive',
      });
      return false;
    }
  }, [toast, resetDelay]);

  const isCopied = useCallback((value) => {
    return copiedValue === value;
  }, [copiedValue]);

  return {
    copy,
    copiedValue,
    isCopied,
  };
};

export default useCopyToClipboard;
