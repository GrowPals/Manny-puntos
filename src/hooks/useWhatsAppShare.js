import { useCallback } from 'react';

/**
 * Hook for sharing content via WhatsApp with optional Web Share API fallback
 *
 * @returns {Object} Share utilities
 * @returns {Function} shareViaWhatsApp - Direct WhatsApp share
 * @returns {Function} shareWithFallback - Web Share API with WhatsApp fallback
 * @returns {Function} buildWhatsAppUrl - Build WhatsApp URL for custom use
 */
const useWhatsAppShare = () => {
  /**
   * Build a WhatsApp share URL
   * @param {string} message - Message to share (will be encoded)
   * @param {string} [phone] - Optional phone number to send to (without + or country code formatting)
   * @returns {string} WhatsApp URL
   */
  const buildWhatsAppUrl = useCallback((message, phone = null) => {
    const encodedMessage = encodeURIComponent(message);
    if (phone) {
      return `https://wa.me/${phone}?text=${encodedMessage}`;
    }
    return `https://wa.me/?text=${encodedMessage}`;
  }, []);

  /**
   * Open WhatsApp with a message
   * @param {string} message - Message to share
   * @param {string} [phone] - Optional phone number
   */
  const shareViaWhatsApp = useCallback((message, phone = null) => {
    const url = buildWhatsAppUrl(message, phone);
    window.open(url, '_blank');
  }, [buildWhatsAppUrl]);

  /**
   * Try Web Share API first, fallback to WhatsApp
   * @param {Object} options - Share options
   * @param {string} options.title - Share title (for Web Share API)
   * @param {string} options.text - Share text/message
   * @param {string} [options.url] - URL to share (for Web Share API, will be appended to text for WhatsApp)
   * @param {string} [options.whatsappMessage] - Custom message for WhatsApp fallback (defaults to text + url)
   * @returns {Promise<'shared'|'whatsapp'|'cancelled'>} Result of share attempt
   */
  const shareWithFallback = useCallback(async ({ title, text, url, whatsappMessage }) => {
    const shareData = { title, text, url };

    // Build WhatsApp message
    const waMessage = whatsappMessage || (url ? `${text}\n\n${url}` : text);

    // Try native share first
    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
        return 'shared';
      } catch (err) {
        if (err.name === 'AbortError') {
          return 'cancelled';
        }
        // Fall through to WhatsApp
      }
    }

    // Fallback to WhatsApp
    shareViaWhatsApp(waMessage);
    return 'whatsapp';
  }, [shareViaWhatsApp]);

  /**
   * Build a formatted gift/campaign message for WhatsApp
   * @param {Object} link - Gift link data
   * @param {string} baseUrl - Base URL for the gift link
   * @returns {string} Formatted message
   */
  const buildGiftMessage = useCallback((link, baseUrl) => {
    const url = `${baseUrl}/g/${link.codigo}`;

    if (link.mensaje_personalizado) {
      return `${link.mensaje_personalizado}\n\n\u{1F449} ${url}`;
    }

    if (link.es_campana) {
      const beneficio = link.tipo === 'puntos'
        ? `${link.puntos_regalo?.toLocaleString()} puntos`
        : link.nombre_beneficio;

      return `\u{1F381} *${link.nombre_campana || 'Regalo especial'}*\n\n` +
        `Te comparto: ${beneficio}\n\n` +
        `Reclámalo aquí:\n\u{1F449} ${url}`;
    }

    return `\u{1F381} Tienes un regalo de Manny Rewards\n\n` +
      `Reclámalo aquí:\n\u{1F449} ${url}`;
  }, []);

  return {
    shareViaWhatsApp,
    shareWithFallback,
    buildWhatsAppUrl,
    buildGiftMessage,
  };
};

export default useWhatsAppShare;
