import { useState, useEffect } from 'react';

/**
 * Centralized hook for device detection
 * Consolidates mobile/iOS/standalone detection logic that was duplicated across:
 * - WhatsAppButton.jsx
 * - NotificationBell.jsx
 * - PWAInstallPrompt.jsx
 * - AppDownloadStep.jsx
 * - Header.jsx
 *
 * @param {Object} options
 * @param {number} options.mobileBreakpoint - Width threshold for mobile (default: 768)
 * @returns {Object} Device detection state
 */
export const useDeviceDetection = ({ mobileBreakpoint = 768 } = {}) => {
  const [deviceState, setDeviceState] = useState({
    isMobile: false,
    isIOS: false,
    isStandalone: false,
    isAndroid: false,
  });

  useEffect(() => {
    const checkDevice = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
      const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      // iOS detection
      const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;

      // Android detection
      const isAndroid = /android/i.test(userAgent);

      // Mobile detection (user agent OR touch + small screen)
      const isMobile = mobileRegex.test(userAgent.toLowerCase()) ||
        (hasTouchScreen && window.innerWidth < mobileBreakpoint);

      // Standalone (PWA installed) detection
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone ||
        document.referrer.includes('android-app://');

      setDeviceState({
        isMobile,
        isIOS,
        isStandalone,
        isAndroid,
      });
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, [mobileBreakpoint]);

  return deviceState;
};

export default useDeviceDetection;
