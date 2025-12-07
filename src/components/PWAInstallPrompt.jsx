import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X, Smartphone } from 'lucide-react';
import { safeStorage } from '@/lib/utils';

export const PWAInstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // Detectar si ya está instalada como PWA
        const standalone = window.matchMedia('(display-mode: standalone)').matches
            || window.navigator.standalone
            || document.referrer.includes('android-app://');
        setIsStandalone(standalone);

        // Detectar iOS
        const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        setIsIOS(iOS);

        // Detectar si es dispositivo móvil (no mostrar en desktop)
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
            || window.innerWidth <= 768;

        // No mostrar en desktop
        if (!isMobile) return;

        // Verificar si ya se descartó el prompt recientemente
        const dismissed = safeStorage.getString('pwa-prompt-dismissed');
        if (dismissed) {
            const dismissedDate = new Date(dismissed);
            const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceDismissed < 7) return; // No mostrar por 7 días
        }

        // Escuchar el evento beforeinstallprompt
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            // Mostrar después de 30 segundos de uso
            setTimeout(() => setShowPrompt(true), 30000);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Para iOS, mostrar instrucciones después de un tiempo
        if (iOS && !standalone) {
            setTimeout(() => setShowPrompt(true), 60000);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            setShowPrompt(false);
        }
        setDeferredPrompt(null);
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        safeStorage.setString('pwa-prompt-dismissed', new Date().toISOString());
    };

    // No mostrar si ya está instalada
    if (isStandalone || !showPrompt) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-card rounded-xl shadow-2xl border border-border p-4 z-50 animate-slide-up">
            <button
                onClick={handleDismiss}
                className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground"
            >
                <X size={18} />
            </button>

            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-12 h-12 bg-manny-gradient rounded-xl flex items-center justify-center">
                    <Smartphone className="text-white" size={24} />
                </div>

                <div className="flex-1">
                    <h3 className="font-semibold text-foreground text-sm">
                        Instala Manny Rewards
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                        {isIOS
                            ? 'Toca el botón compartir y selecciona "Agregar a pantalla de inicio"'
                            : 'Accede más rápido y recibe notificaciones de tus puntos'
                        }
                    </p>

                    {!isIOS && deferredPrompt && (
                        <Button
                            onClick={handleInstall}
                            size="sm"
                            variant="investment"
                            className="mt-3"
                        >
                            <Download size={16} className="mr-2" />
                            Instalar App
                        </Button>
                    )}

                    {isIOS && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="bg-muted px-2 py-1 rounded">
                                Compartir
                            </span>
                            <span>→</span>
                            <span className="bg-muted px-2 py-1 rounded">
                                Agregar a inicio
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PWAInstallPrompt;
