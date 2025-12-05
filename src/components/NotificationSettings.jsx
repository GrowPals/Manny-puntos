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
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-xl">
                <BellOff className="text-muted-foreground" size={24} />
                <div>
                    <p className="text-sm font-medium text-foreground">
                        Notificaciones no disponibles
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Tu navegador no soporta notificaciones push
                    </p>
                </div>
            </div>
        );
    }

    if (permission === 'denied') {
        return (
            <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-xl">
                <BellOff className="text-destructive" size={24} />
                <div>
                    <p className="text-sm font-medium text-destructive">
                        Notificaciones bloqueadas
                    </p>
                    <p className="text-xs text-destructive/80">
                        Habilítalas desde la configuración de tu navegador
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
            <div className="flex items-center gap-3">
                {permission === 'granted' ? (
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <Bell className="text-emerald-500" size={20} />
                    </div>
                ) : (
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <BellOff className="text-muted-foreground" size={20} />
                    </div>
                )}
                <div>
                    <p className="text-sm font-medium text-foreground">
                        Notificaciones push
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {permission === 'granted'
                            ? 'Recibirás alertas de puntos y canjes'
                            : 'Activa para recibir alertas'
                        }
                    </p>
                </div>
            </div>

            <Button
                onClick={handleToggle}
                disabled={isLoading}
                variant={permission === 'granted' ? 'outline' : 'investment'}
                size="sm"
                className={permission === 'granted'
                    ? 'border-emerald-500 text-emerald-500 hover:bg-emerald-500/10'
                    : ''
                }
            >
                {isLoading ? (
                    <Loader2 className="animate-spin" size={16} />
                ) : permission === 'granted' ? (
                    <>
                        <Check size={16} className="mr-1" />
                        Activas
                    </>
                ) : (
                    'Activar'
                )}
            </Button>
        </div>
    );
};

export default NotificationSettings;
