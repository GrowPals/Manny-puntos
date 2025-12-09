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

export const config = {
  runtime: 'edge',
};

// Imagen por defecto para regalos
const DEFAULT_IMAGE = 'https://i.ibb.co/jZrZCyNs/solo-haz-que-mi-personaje-en-lugar-de-estar-en-el-centro-este-en-la-izquierda-y-que-a-la-derecha-di.png';

export default async function handler(request) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const codigo = pathParts[pathParts.length - 1];
  const userAgent = request.headers.get('user-agent') || '';

  // Si no es un crawler, redirigir a la app
  if (!isCrawler(userAgent)) {
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `/gift/${codigo}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
    });
  }

  // Es un crawler - obtener datos del regalo
  try {
    const supabaseUrl = process.env.SUPABASE_URL
      || process.env.VITE_SUPABASE_URL
      || 'https://kuftyqupibyjliaukpxn.supabase.co';

    const supabaseKey = process.env.SUPABASE_ANON_KEY
      || process.env.VITE_SUPABASE_ANON_KEY
      || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseKey) {
      return serveHtml(codigo, '🎁 Tienes un regalo', DEFAULT_IMAGE);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: gift, error } = await supabase
      .from('links_regalo')
      .select('nombre_campana, nombre_beneficio, imagen_banner, tipo, puntos_regalo')
      .eq('codigo', codigo.toUpperCase())
      .maybeSingle();

    if (error || !gift) {
      return serveHtml(codigo, '🎁 Tienes un regalo', DEFAULT_IMAGE);
    }

    // Título simple
    let title = '🎁 Tienes un regalo';
    if (gift.nombre_campana) {
      title = `🎁 ${escapeHtml(gift.nombre_campana)}`;
    } else if (gift.tipo === 'puntos' && gift.puntos_regalo) {
      title = `🎁 ${gift.puntos_regalo.toLocaleString()} puntos`;
    } else if (gift.nombre_beneficio) {
      title = `🎁 ${escapeHtml(gift.nombre_beneficio)}`;
    }

    // Imagen: usar banner si existe, sino default
    const image = gift.imagen_banner || DEFAULT_IMAGE;

    return serveHtml(codigo, title, image);

  } catch (error) {
    console.error('Error fetching gift:', error);
    return serveHtml(codigo, '🎁 Tienes un regalo', DEFAULT_IMAGE);
  }
}

function serveHtml(codigo, title, image) {
  const canonicalUrl = `https://recompensas.manny.mx/g/${codigo}`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>

  <!-- Open Graph -->
  <meta property="og:title" content="${title}">
  <meta property="og:image" content="${image}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:type" content="website">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:image" content="${image}">

  <meta name="theme-color" content="#e91e63">
  <meta http-equiv="refresh" content="0;url=${canonicalUrl}">
</head>
<body>
  <a href="${canonicalUrl}">${title}</a>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
