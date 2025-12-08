import { createClient } from '@supabase/supabase-js';

// Lista de user agents de crawlers que necesitan meta tags
const CRAWLER_USER_AGENTS = [
  'facebookexternalhit',
  'Facebot',
  'WhatsApp',
  'Twitterbot',
  'LinkedInBot',
  'Slackbot',
  'TelegramBot',
  'Discordbot',
  'Pinterest',
  'Googlebot',
  'bingbot',
];

// Detectar si es un crawler
function isCrawler(userAgent) {
  if (!userAgent) return false;
  return CRAWLER_USER_AGENTS.some(bot =>
    userAgent.toLowerCase().includes(bot.toLowerCase())
  );
}

// Escapar HTML para prevenir XSS
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Truncar texto para meta descriptions
function truncate(text, maxLength = 160) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  // Path puede ser /api/gift/CODIGO o /g/CODIGO
  const codigo = pathParts[pathParts.length - 1];
  const userAgent = request.headers.get('user-agent') || '';

  // Si no es un crawler, servir el index.html directamente (SPA takeover)
  if (!isCrawler(userAgent)) {
    // Fetch el index.html y servirlo (la SPA manejará el routing)
    try {
      const indexResponse = await fetch(new URL('/index.html', url.origin));
      const indexHtml = await indexResponse.text();
      return new Response(indexHtml, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    } catch {
      // Fallback: redirigir al home si no podemos servir el index
      return new Response(null, {
        status: 302,
        headers: { 'Location': '/' },
      });
    }
  }

  // Es un crawler - obtener datos del regalo y servir HTML con meta tags
  try {
    // En Vercel Edge Functions, las variables VITE_* no están disponibles
    // Usar SUPABASE_URL y SUPABASE_ANON_KEY configuradas en Vercel Dashboard
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase environment variables');
      return serveGenericHtml(codigo);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: gift, error } = await supabase
      .from('links_regalo')
      .select(`
        codigo,
        tipo,
        nombre_beneficio,
        descripcion_beneficio,
        puntos_regalo,
        mensaje_personalizado,
        imagen_banner,
        color_tema,
        es_campana,
        nombre_campana,
        estado
      `)
      .eq('codigo', codigo.toUpperCase())
      .maybeSingle();

    if (error || !gift) {
      // Regalo no encontrado - servir meta tags genéricos
      return serveGenericHtml(codigo);
    }

    // Construir meta tags dinámicos
    const title = gift.es_campana && gift.nombre_campana
      ? escapeHtml(gift.nombre_campana)
      : gift.tipo === 'puntos'
        ? `${gift.puntos_regalo?.toLocaleString()} Puntos Manny`
        : escapeHtml(gift.nombre_beneficio) || 'Regalo Manny';

    const description = gift.mensaje_personalizado
      ? escapeHtml(truncate(gift.mensaje_personalizado, 200))
      : gift.descripcion_beneficio
        ? escapeHtml(truncate(gift.descripcion_beneficio, 200))
        : gift.es_campana
          ? `${escapeHtml(gift.nombre_beneficio)} - Reclama tu regalo de Manny`
          : 'Tienes un regalo especial de Manny Rewards. Reclámalo ahora.';

    // Usar banner de campaña o imagen por defecto
    const image = gift.imagen_banner || 'https://i.ibb.co/jZrZCyNs/solo-haz-que-mi-personaje-en-lugar-de-estar-en-el-centro-este-en-la-izquierda-y-que-a-la-derecha-di.png';

    const canonicalUrl = `https://mannysoytupartner.com/g/${codigo}`;
    const themeColor = gift.color_tema || '#e91e63';

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- SEO -->
  <title>${title} | Manny Rewards</title>
  <meta name="description" content="${description}">
  <meta name="robots" content="noindex, nofollow">

  <!-- Open Graph / Facebook / WhatsApp -->
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Manny Rewards">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${image}">
  <meta property="og:image:secure_url" content="${image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${title}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:locale" content="es_MX">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${image}">
  <meta name="twitter:image:alt" content="${title}">

  <!-- WhatsApp específico -->
  <meta property="whatsapp:title" content="${title}">
  <meta property="whatsapp:description" content="${description}">
  <meta property="whatsapp:image" content="${image}">

  <!-- Theme -->
  <meta name="theme-color" content="${themeColor}">

  <!-- Canonical -->
  <link rel="canonical" href="${canonicalUrl}">

  <!-- Redirect for browsers -->
  <meta http-equiv="refresh" content="0;url=${canonicalUrl}">
</head>
<body>
  <h1>${title}</h1>
  <p>${description}</p>
  <p><a href="${canonicalUrl}">Reclama tu regalo</a></p>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });

  } catch (error) {
    console.error('Error fetching gift:', error);
    return serveGenericHtml(codigo);
  }
}

function serveGenericHtml(codigo) {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Regalo Manny</title>
  <meta name="description" content="Tienes un regalo especial de Manny Rewards">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Manny Rewards">
  <meta property="og:title" content="Tienes un regalo">
  <meta property="og:description" content="Alguien te envió un regalo especial de Manny Rewards. Reclámalo ahora.">
  <meta property="og:image" content="https://i.ibb.co/jZrZCyNs/solo-haz-que-mi-personaje-en-lugar-de-estar-en-el-centro-este-en-la-izquierda-y-que-a-la-derecha-di.png">
  <meta property="og:url" content="https://mannysoytupartner.com/g/${codigo}">
  <meta name="theme-color" content="#e91e63">
  <meta http-equiv="refresh" content="0;url=/g/${codigo}">
</head>
<body>
  <h1>Regalo Manny</h1>
  <p><a href="/g/${codigo}">Ver regalo</a></p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
    },
  });
}
