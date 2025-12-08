import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS with whitelist
const ALLOWED_ORIGINS = [
  'https://recompensas.manny.mx',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://[::]:3000',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cliente-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

const MANNY_REWARDS_DB = '2bfc6cfd-8c1e-8026-9291-e4bc8c18ee01';

async function notionRequest(endpoint: string, method: string, body: any, token: string) {
  const response = await fetch(`https://api.notion.com/v1${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Notion API error: ${error}`);
  }

  return response.json();
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Admin-only function for batch point sync
Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const notionToken = Deno.env.get('NOTION_TOKEN');

    if (!notionToken) {
      throw new Error('NOTION_TOKEN not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate caller is admin
    const callerClienteId = req.headers.get('x-cliente-id');
    if (!callerClienteId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: caller, error: callerError } = await supabase
      .from('clientes')
      .select('id, es_admin')
      .eq('id', callerClienteId)
      .single();

    if (callerError || !caller || !caller.es_admin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = await req.json().catch(() => ({}));
    const limit = payload.limit || 50;
    const dryRun = payload.dry_run ?? false;
    const startCursor = payload.start_cursor || undefined;

    console.log(`Syncing points - limit: ${limit}, dry_run: ${dryRun}`);

    // Get all Manny Rewards
    const queryBody: any = { page_size: Math.min(limit, 100) };
    if (startCursor) {
      queryBody.start_cursor = startCursor;
    }

    const rewardsResponse = await notionRequest(
      `/databases/${MANNY_REWARDS_DB}/query`,
      'POST',
      queryBody,
      notionToken
    );

    const results: any[] = [];
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const reward of rewardsResponse.results) {
      const rewardId = reward.id;
      const nombre = reward.properties['Nombre']?.title?.[0]?.plain_text || 'Sin nombre';
      const montoTotal = reward.properties['Monto Total']?.rollup?.number || 0;
      const currentPuntos = reward.properties['Puntos']?.number || 0;
      // 5% del monto total
      const calculatedPuntos = Math.round(montoTotal * 0.05);

      if (currentPuntos === calculatedPuntos) {
        results.push({
          nombre,
          status: 'no_change',
          puntos: currentPuntos
        });
        skipped++;
        continue;
      }

      if (dryRun) {
        results.push({
          nombre,
          status: 'would_update',
          from: currentPuntos,
          to: calculatedPuntos,
          monto_total: montoTotal
        });
        updated++;
      } else {
        try {
          await notionRequest(`/pages/${rewardId}`, 'PATCH', {
            properties: {
              'Puntos': { number: calculatedPuntos }
            }
          }, notionToken);

          results.push({
            nombre,
            status: 'updated',
            from: currentPuntos,
            to: calculatedPuntos
          });
          updated++;
          await delay(350); // Rate limiting
        } catch (e) {
          results.push({
            nombre,
            status: 'error',
            error: e.message
          });
          errors++;
        }
      }
    }

    return new Response(JSON.stringify({
      status: dryRun ? 'dry_run' : 'completed',
      total_processed: rewardsResponse.results.length,
      updated,
      skipped,
      errors,
      has_more: rewardsResponse.has_more,
      next_cursor: rewardsResponse.next_cursor,
      results: results.slice(0, 20) // Only show first 20 for brevity
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
