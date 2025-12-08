import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Dominios permitidos para CORS
const ALLOWED_ORIGINS = [
  'https://recompensas.manny.mx',
  'http://localhost:5173',
  'http://localhost:4173',
];

function getCorsHeaders(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cliente-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

// Tipos de notificación y sus mensajes predefinidos
const NOTIFICATION_TEMPLATES = {
  // Para clientes
  bienvenida: {
    title: '¡Bienvenido a Manny Rewards!',
    body: 'Ya puedes acumular puntos y canjear recompensas exclusivas.',
    icon: '/icon.png',
  },
  puntos_recibidos: {
    title: '¡Ganaste {puntos} puntos!',
    body: 'Tu servicio "{concepto}" ha sido registrado. Saldo actual: {saldo} puntos.',
    icon: '/icon.png',
  },
  canje_listo: {
    title: '¡Tu {producto} está listo!',
    body: 'Pasa a recoger tu recompensa. ¡Te esperamos!',
    icon: '/icon.png',
  },
  canje_completado: {
    title: 'Canje entregado',
    body: '¡Gracias por ser parte de Manny Rewards! Sigue acumulando puntos.',
    icon: '/icon.png',
  },
  recordatorio_puntos: {
    title: '¡Tienes {puntos} puntos esperándote!',
    body: 'No olvides canjear tus recompensas. ¡Hay productos increíbles!',
    icon: '/icon.png',
  },
  beneficio_reclamado: {
    title: '¡Beneficio activado!',
    body: 'Tu beneficio "{nombre}" está listo para usar. ¡Disfrútalo!',
    icon: '/icon.png',
  },
  beneficio_usado: {
    title: 'Beneficio utilizado',
    body: 'Tu beneficio ha sido marcado como usado. ¡Gracias por confiar en Manny!',
    icon: '/icon.png',
  },
  nivel_cambiado: {
    title: '¡Felicidades! Subiste a nivel {nivel}',
    body: 'Ahora tienes acceso a beneficios exclusivos. ¡Gracias por ser parte de Manny!',
    icon: '/icon.png',
  },
  referido_activado: {
    title: '¡Tu referido fue activado!',
    body: '{referido} ya es cliente Manny. Ganaste {puntos} puntos de bonificación.',
    icon: '/icon.png',
  },

  // Para admins
  nuevo_canje: {
    title: 'Nuevo canje: {producto}',
    body: '{cliente} canjeó {puntos} puntos. Preparar para entrega.',
    icon: '/icon.png',
  },
  nuevo_beneficio: {
    title: 'Nuevo beneficio reclamado',
    body: '{cliente} reclamó: {beneficio}',
    icon: '/icon.png',
  },
  resumen_diario: {
    title: 'Resumen del día',
    body: '{canjes} canjes pendientes de entrega.',
    icon: '/icon.png',
  },
};

type NotificationType = keyof typeof NOTIFICATION_TEMPLATES;

interface PushPayload {
  tipo: NotificationType;
  cliente_id?: string;      // Para notificar a un cliente específico
  to_admins?: boolean;      // Para notificar a todos los admins
  data?: Record<string, string | number>;  // Variables para el template
  url?: string;             // URL a abrir al hacer clic
}

function replacePlaceholders(template: string, data: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; icon: string; url?: string; data?: Record<string, unknown> },
  vapidKeys: { publicKey: string; privateKey: string; subject: string }
): Promise<boolean> {
  try {
    // Construir el payload de la notificación
    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon,
      badge: '/icon.png',
      vibrate: [200, 100, 200],
      tag: 'manny-notification',
      renotify: true,
      data: {
        url: payload.url || '/',
        ...payload.data,
      },
    });

    // Crear JWT para autenticación VAPID
    const vapidHeader = {
      typ: 'JWT',
      alg: 'ES256',
    };

    const now = Math.floor(Date.now() / 1000);
    const vapidClaims = {
      aud: new URL(subscription.endpoint).origin,
      exp: now + 86400, // 24 horas
      sub: vapidKeys.subject,
    };

    // Usar la API de Web Push nativa de Deno
    const encoder = new TextEncoder();

    // Importar clave privada
    const privateKeyBuffer = Uint8Array.from(atob(vapidKeys.privateKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      privateKeyBuffer,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );

    // Base64URL encode
    const base64url = (data: Uint8Array | string): string => {
      const str = typeof data === 'string' ? data : String.fromCharCode(...data);
      return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    };

    const headerB64 = base64url(encoder.encode(JSON.stringify(vapidHeader)));
    const claimsB64 = base64url(encoder.encode(JSON.stringify(vapidClaims)));
    const unsignedToken = `${headerB64}.${claimsB64}`;

    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      cryptoKey,
      encoder.encode(unsignedToken)
    );

    const jwt = `${unsignedToken}.${base64url(new Uint8Array(signature))}`;

    // Enviar la notificación
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `vapid t=${jwt}, k=${vapidKeys.publicKey}`,
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400',
      },
      body: notificationPayload,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Push failed: ${response.status} - ${errorText}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending push:', error);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error('VAPID keys not configured');
      return new Response(JSON.stringify({ error: 'Push notifications not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // =====================================================
    // VALIDACIÓN DE CALLER - Debe ser un cliente autenticado
    // =====================================================
    const callerClienteId = req.headers.get('x-cliente-id');

    if (!callerClienteId) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing client ID' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar que el caller existe en la base de datos
    const { data: caller, error: callerError } = await supabase
      .from('clientes')
      .select('id, es_admin')
      .eq('id', callerClienteId)
      .single();

    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid client' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // =====================================================

    const payload: PushPayload = await req.json();

    console.log('Push notification request:', { tipo: payload.tipo, to_admins: payload.to_admins });

    const { tipo, cliente_id, to_admins, data = {}, url } = payload;

    if (!tipo || !NOTIFICATION_TEMPLATES[tipo]) {
      return new Response(JSON.stringify({ error: 'Invalid notification type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const template = NOTIFICATION_TEMPLATES[tipo];
    const title = replacePlaceholders(template.title, data);
    const body = replacePlaceholders(template.body, data);

    // Obtener suscripciones según el destino
    let subscriptions: Array<{
      id: string;
      cliente_id: string;
      endpoint: string;
      p256dh: string;
      auth: string;
    }> = [];

    if (to_admins) {
      // Notificar a todos los admins
      const { data: adminSubs, error } = await supabase
        .from('push_subscriptions')
        .select('id, cliente_id, endpoint, p256dh, auth')
        .eq('is_admin', true);

      if (!error && adminSubs) {
        subscriptions = adminSubs;
      }
    } else if (cliente_id) {
      // Notificar a un cliente específico
      const { data: clientSubs, error } = await supabase
        .from('push_subscriptions')
        .select('id, cliente_id, endpoint, p256dh, auth')
        .eq('cliente_id', cliente_id);

      if (!error && clientSubs) {
        subscriptions = clientSubs;
      }
    }

    if (subscriptions.length === 0) {
      console.log('No subscriptions found for target');
      return new Response(JSON.stringify({
        success: true,
        sent: 0,
        message: 'No subscriptions found'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Enviar notificaciones
    const results = await Promise.all(
      subscriptions.map(async (sub) => {
        const success = await sendWebPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          { title, body, icon: template.icon, url, data },
          {
            publicKey: vapidPublicKey,
            privateKey: vapidPrivateKey,
            subject: 'mailto:notificaciones@mannysoytupartner.com'
          }
        );

        // Registrar en historial
        await supabase.from('notification_history').insert({
          cliente_id: sub.cliente_id,
          tipo,
          titulo: title,
          mensaje: body,
          data: { ...data, url },
          success,
          error_message: success ? null : 'Push delivery failed',
        });

        // Si falla, eliminar suscripción inválida
        if (!success) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id);
        }

        return { subscription_id: sub.id, success };
      })
    );

    const successCount = results.filter(r => r.success).length;
    console.log(`Sent ${successCount}/${subscriptions.length} notifications`);

    return new Response(JSON.stringify({
      success: true,
      sent: successCount,
      total: subscriptions.length,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in send-push-notification:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
