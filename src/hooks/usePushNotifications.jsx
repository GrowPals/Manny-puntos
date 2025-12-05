import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export const usePushNotifications = (clienteId, isAdmin = false) => {
    const [isSupported, setIsSupported] = useState(false);
    const [permission, setPermission] = useState('default');
    const [subscription, setSubscription] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // Verificar soporte
        const supported = 'Notification' in window
            && 'serviceWorker' in navigator
            && 'PushManager' in window;
        setIsSupported(supported);

        if (supported) {
            setPermission(Notification.permission);
            // Check existing subscription (fire and forget, errors handled inside)
            const checkSubscription = async () => {
                try {
                    const registration = await navigator.serviceWorker.ready;
                    const existingSub = await registration.pushManager.getSubscription();
                    setSubscription(existingSub);
                } catch (error) {
                    console.error('Error checking subscription:', error);
                }
            };
            checkSubscription();
        }
    }, []);

    const urlBase64ToUint8Array = (base64String) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    };

    const requestPermission = useCallback(async () => {
        if (!isSupported) {
            return { success: false, error: 'Notificaciones no soportadas en este navegador' };
        }

        setIsLoading(true);

        try {
            const result = await Notification.requestPermission();
            setPermission(result);

            if (result !== 'granted') {
                setIsLoading(false);
                return { success: false, error: 'Permiso de notificaciones denegado' };
            }

            // Suscribirse a push
            const registration = await navigator.serviceWorker.ready;

            if (!VAPID_PUBLIC_KEY) {
                // Si no hay VAPID key, solo habilitar notificaciones locales
                setIsLoading(false);
                return { success: true, localOnly: true };
            }

            const newSubscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });

            setSubscription(newSubscription);

            // Guardar suscripción en Supabase
            if (clienteId) {
                await saveSubscriptionToServer(newSubscription, clienteId, isAdmin);

                // Enviar notificación de bienvenida
                try {
                    await supabase.functions.invoke('send-push-notification', {
                        body: {
                            tipo: 'bienvenida',
                            cliente_id: clienteId
                        }
                    });
                } catch (e) {
                    console.log('Welcome notification skipped:', e);
                }
            }

            setIsLoading(false);
            return { success: true };
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            setIsLoading(false);
            return { success: false, error: error.message };
        }
    }, [isSupported, clienteId, isAdmin]);

    const saveSubscriptionToServer = async (sub, clientId, adminFlag) => {
        try {
            // Obtener información del dispositivo
            const deviceInfo = {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language,
                standalone: window.matchMedia('(display-mode: standalone)').matches,
            };

            const p256dhKey = sub.getKey('p256dh');
            const authKey = sub.getKey('auth');

            if (!p256dhKey || !authKey) {
                throw new Error('Missing encryption keys');
            }

            const { error } = await supabase
                .from('push_subscriptions')
                .upsert({
                    cliente_id: clientId,
                    endpoint: sub.endpoint,
                    p256dh: btoa(String.fromCharCode(...new Uint8Array(p256dhKey))),
                    auth: btoa(String.fromCharCode(...new Uint8Array(authKey))),
                    is_admin: adminFlag,
                    device_info: deviceInfo,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'endpoint',
                    ignoreDuplicates: false
                });

            if (error) throw error;
            console.log('Push subscription saved successfully');
        } catch (error) {
            console.error('Error saving subscription:', error);
        }
    };

    const unsubscribe = useCallback(async () => {
        if (!subscription) return;

        try {
            await subscription.unsubscribe();
            setSubscription(null);

            // Eliminar de Supabase por endpoint
            if (subscription.endpoint) {
                await supabase
                    .from('push_subscriptions')
                    .delete()
                    .eq('endpoint', subscription.endpoint);
            }
        } catch (error) {
            console.error('Error unsubscribing:', error);
        }
    }, [subscription]);

    // Mostrar notificación local (no requiere servidor push)
    const showLocalNotification = useCallback(async (title, options = {}) => {
        if (permission !== 'granted') {
            return false;
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification(title, {
                icon: '/icons/isotipo.svg',
                badge: '/icons/isotipo.svg',
                vibrate: [200, 100, 200],
                tag: options.tag || 'manny-notification',
                renotify: true,
                requireInteraction: false,
                ...options
            });
            return true;
        } catch (error) {
            console.error('Error showing notification:', error);
            return false;
        }
    }, [permission]);

    return {
        isSupported,
        permission,
        subscription,
        isLoading,
        isSubscribed: !!subscription,
        requestPermission,
        unsubscribe,
        showLocalNotification
    };
};

export default usePushNotifications;
