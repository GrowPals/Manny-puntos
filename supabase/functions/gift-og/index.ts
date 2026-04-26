import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};
// User agents that are social media crawlers
const CRAWLER_USER_AGENTS = [
  'facebookexternalhit',
  'Facebot',
  'Twitterbot',
  'WhatsApp',
  'TelegramBot',
  'LinkedInBot',
  'Slackbot',
  'Discordbot',
  'Pinterest',
  'redditbot',
  'Embedly',
  'Quora Link Preview',
  'Showyoubot',
  'outbrain',
  'vkShare',
  'W3C_Validator'
];
function isCrawler(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return CRAWLER_USER_AGENTS.some((crawler)=>ua.includes(crawler.toLowerCase()));
}
function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
Deno.serve(async (req)=>{
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const url = new URL(req.url);
    const codigo = url.searchParams.get('codigo');
    const userAgent = req.headers.get('user-agent') || '';
    // Get the base URL for redirects
    const baseUrl = Deno.env.get('APP_URL') || 'https://recompensas.manny.mx';
    if (!codigo) {
      return Response.redirect(`${baseUrl}/`, 302);
    }
    // If not a crawler, redirect to the React app
    if (!isCrawler(userAgent)) {
      return Response.redirect(`${baseUrl}/g/${codigo}`, 302);
    }
    // For crawlers, fetch gift data and return HTML with meta tags
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: gift, error } = await supabase.from('links_regalo').select('*').eq('codigo', codigo).single();
    if (error || !gift) {
      // Gift not found - still return valid HTML for crawlers
      return new Response(generateHtml({
        title: 'Regalo no encontrado - Manny Rewards',
        description: 'Este link de regalo no existe o ha expirado.',
        image: 'https://i.ibb.co/jZrZCyNs/solo-haz-que-mi-personaje-en-lugar-de-estar-en-el-centro-este-en-la-izquierda-y-que-a-la-derecha-di.png',
        url: `${baseUrl}/g/${codigo}`,
        color: '#E91E63'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html; charset=utf-8'
        }
      });
    }
    // Build title based on gift type
    let title = '🎁 ¡Tienes un regalo!';
    let description = 'Alguien especial te envió un regalo de Manny Rewards';
    if (gift.es_campana && gift.nombre_campana) {
      title = `🎁 ${gift.nombre_campana}`;
    }
    if (gift.tipo === 'puntos') {
      description = `Te regalan ${gift.puntos_regalo?.toLocaleString()} puntos Manny`;
    } else if (gift.nombre_beneficio) {
      description = `Te regalan: ${gift.nombre_beneficio}`;
    }
    if (gift.mensaje_personalizado) {
      description = gift.mensaje_personalizado;
    }
    // Use custom banner or default image
    const image = gift.imagen_banner || 'https://i.ibb.co/jZrZCyNs/solo-haz-que-mi-personaje-en-lugar-de-estar-en-el-centro-este-en-la-izquierda-y-que-a-la-derecha-di.png';
    const color = gift.color_tema || '#E91E63';
    return new Response(generateHtml({
      title,
      description,
      image,
      url: `${baseUrl}/g/${codigo}`,
      color
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8'
      }
    });
  } catch (err) {
    console.error('Error in gift-og:', err);
    return new Response('Internal Server Error', {
      status: 500
    });
  }
});
function generateHtml({ title, description, image, url, color }) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeImage = escapeHtml(image);
  const safeUrl = escapeHtml(url);
  const safeColor = escapeHtml(color);
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Primary Meta Tags -->
  <title>${safeTitle}</title>
  <meta name="title" content="${safeTitle}">
  <meta name="description" content="${safeDescription}">
  <meta name="theme-color" content="${safeColor}">
  
  <!-- Open Graph / Facebook / WhatsApp -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${safeUrl}">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:image" content="${safeImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="Manny Rewards">
  <meta property="og:locale" content="es_MX">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${safeUrl}">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDescription}">
  <meta name="twitter:image" content="${safeImage}">
  
  <!-- WhatsApp specific -->
  <meta property="whatsapp:title" content="${safeTitle}">
  <meta property="whatsapp:description" content="${safeDescription}">
  <meta property="whatsapp:image" content="${safeImage}">
  
  <!-- Redirect for any browser that loads this -->
  <meta http-equiv="refresh" content="0;url=${safeUrl}">
  
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, ${safeColor}20, #9C27B020);
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    h1 { color: ${safeColor}; font-size: 2rem; margin-bottom: 1rem; }
    p { color: #666; font-size: 1.1rem; }
    a { color: ${safeColor}; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${safeTitle}</h1>
    <p>${safeDescription}</p>
    <p><a href="${safeUrl}">Clic aquí si no eres redirigido automáticamente</a></p>
  </div>
</body>
</html>`;
}
