import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const notionToken = Deno.env.get('NOTION_TOKEN');
    if (!notionToken) {
      throw new Error('NOTION_TOKEN not configured');
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
