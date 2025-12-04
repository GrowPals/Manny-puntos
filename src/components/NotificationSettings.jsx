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
            <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <BellOff className="text-gray-400" size={24} />
                <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Notificaciones no disponibles
                    </p>
                    <p className="text-xs text-gray-500">
                        Tu navegador no soporta notificaciones push
                    </p>
                </div>
            </div>
        );
    }

    if (permission === 'denied') {
        return (
            <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <BellOff className="text-red-500" size={24} />
                <div>
                    <p className="text-sm font-medium text-red-700 dark:text-red-400">
                        Notificaciones bloqueadas
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-500">
                        Habilítalas desde la configuración de tu navegador
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center gap-3">
                {permission === 'granted' ? (
                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <Bell className="text-green-600 dark:text-green-400" size={20} />
                    </div>
                ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                        <BellOff className="text-gray-500" size={20} />
                    </div>
                )}
                <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Notificaciones push
                    </p>
                    <p className="text-xs text-gray-500">
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
                variant={permission === 'granted' ? 'outline' : 'default'}
                size="sm"
                className={permission === 'granted'
                    ? 'border-green-500 text-green-600 hover:bg-green-50'
                    : 'bg-gradient-to-r from-pink-500 to-orange-400 text-white'
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
