import React from 'react';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, Check, Loader2 } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export const NotificationSettings = ({ clienteId }) => {
    const {
        isSupported,
        permission,
        isLoading,
        isSubscribed,
        requestPermission,
        unsubscribe,
        showLocalNotification
    } = usePushNotifications(clienteId);

    const handleToggle = async () => {
        if (isSubscribed || permission === 'granted') {
            await unsubscribe();
        } else {
            const result = await requestPermission();
            if (result.success) {
                // Mostrar notificación de prueba
                await showLocalNotification('¡Notificaciones activadas!', {
                    body: 'Recibirás alertas sobre tus puntos y recompensas',
                    tag: 'welcome-notification'
                });
            }
        }
    };

    if (!isSupported) {
        return (
            <div className="flex items-center gap-2.5 p-3 bg-muted/50 rounded-lg">
                <BellOff className="text-muted-foreground shrink-0" size={18} />
                <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground">Notificaciones no disponibles</p>
                    <p className="text-[10px] text-muted-foreground truncate">Tu navegador no las soporta</p>
                </div>
            </div>
        );
    }

    if (permission === 'denied') {
        return (
            <div className="flex items-center gap-2.5 p-3 bg-destructive/10 rounded-lg">
                <BellOff className="text-destructive shrink-0" size={18} />
                <div className="min-w-0">
                    <p className="text-xs font-medium text-destructive">Bloqueadas</p>
                    <p className="text-[10px] text-destructive/80 truncate">Habilita en configuración del navegador</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-between gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2.5 min-w-0">
                {permission === 'granted' ? (
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Bell className="text-emerald-500" size={16} />
                    </div>
                ) : (
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <BellOff className="text-muted-foreground" size={16} />
                    </div>
                )}
                <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground">Notificaciones</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                        {permission === 'granted' ? 'Alertas activas' : 'Activa para recibir alertas'}
                    </p>
                </div>
            </div>

            <Button
                onClick={handleToggle}
                disabled={isLoading}
                variant={permission === 'granted' ? 'outline' : 'investment'}
                size="sm"
                className={`shrink-0 h-8 text-xs px-3 ${permission === 'granted'
                    ? 'border-emerald-500 text-emerald-500 hover:bg-emerald-500/10'
                    : ''
                }`}
            >
                {isLoading ? (
                    <Loader2 className="animate-spin" size={14} />
                ) : permission === 'granted' ? (
                    <>
                        <Check size={14} className="mr-1" />
                        On
                    </>
                ) : (
                    'Activar'
                )}
            </Button>
        </div>
    );
};

export default NotificationSettings;
