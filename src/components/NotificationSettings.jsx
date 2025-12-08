import React from 'react';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, Loader2 } from 'lucide-react';
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
        if (isSubscribed) {
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

    // No mostrar nada si no está soportado
    if (!isSupported) {
        return null;
    }

    // No mostrar nada si ya están activadas (tiene permiso Y suscripción)
    if (permission === 'granted' && isSubscribed) {
        return null;
    }

    // Mostrar mensaje si están bloqueadas
    if (permission === 'denied') {
        return (
            <div className="flex items-center gap-2.5 p-3 bg-destructive/10 rounded-lg">
                <BellOff className="text-destructive shrink-0" size={18} />
                <div className="min-w-0">
                    <p className="text-xs font-medium text-destructive">Notificaciones bloqueadas</p>
                    <p className="text-xs text-destructive/80 truncate">Habilita en configuración del navegador</p>
                </div>
            </div>
        );
    }

    // Caso: tiene permiso pero no suscripción (pausadas) o nunca ha activado
    const isPaused = permission === 'granted' && !isSubscribed;

    return (
        <div className="flex items-center justify-between gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Bell className="text-primary" size={16} />
                </div>
                <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground">Notificaciones</p>
                    <p className="text-xs text-muted-foreground truncate">
                        {isPaused ? 'Reactiva para recibir alertas' : 'Activa para recibir alertas'}
                    </p>
                </div>
            </div>

            <Button
                onClick={handleToggle}
                disabled={isLoading}
                variant="investment"
                size="sm"
                className="shrink-0 h-8 text-xs px-3"
            >
                {isLoading ? (
                    <Loader2 className="animate-spin" size={14} />
                ) : (
                    isPaused ? 'Reactivar' : 'Activar'
                )}
            </Button>
        </div>
    );
};

export default NotificationSettings;
