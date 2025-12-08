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

interface NotionReward {
  id: string;
  nombre: string;
  puntos: number;
  nivel: string;
  supabaseId: string | null;
  clienteRelation: string | null;
}

// Optimizado: Solo obtener una página de Notion a la vez
async function getMannyRewardsBatch(notionToken: string, startCursor?: string): Promise<{
  rewards: NotionReward[];
  nextCursor: string | null;
}> {
  const body: any = { page_size: 50 };
  if (startCursor) body.start_cursor = startCursor;

  const response = await fetch(`https://api.notion.com/v1/databases/${MANNY_REWARDS_DB}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${notionToken}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    console.error('Error querying Manny Rewards:', await response.text());
    return { rewards: [], nextCursor: null };
  }

  const data = await response.json();
  const rewards: NotionReward[] = [];

  for (const page of data.results) {
    const props = page.properties;
    const nombreTitle = props['Nombre']?.title;
    const nombre = nombreTitle?.[0]?.plain_text || 'Sin nombre';
    const puntos = props['Puntos']?.number || 0;
    const nivel = props['Nivel']?.select?.name || 'Partner';
    const supabaseIdRichText = props['Supabase ID']?.rich_text;
    const supabaseId = supabaseIdRichText?.[0]?.plain_text || null;
    const clienteRelation = props['Cliente']?.relation?.[0]?.id || null;

    rewards.push({
      id: page.id,
      nombre,
      puntos,
      nivel: nivel.toLowerCase(),
      supabaseId,
      clienteRelation,
    });
  }

  return {
    rewards,
    nextCursor: data.has_more ? data.next_cursor : null,
  };
}

// Admin-only function for batch rewards sync
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
      return new Response(JSON.stringify({ error: 'NOTION_TOKEN not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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

    // Parse request body for options
    let dryRun = true;
    let cursor: string | undefined;
    let limit = 50; // Process max 50 per call to avoid timeout

    try {
      const body = await req.json();
      dryRun = body.dry_run !== false;
      cursor = body.cursor;
      limit = body.limit || 50;
    } catch {
      // Default values
    }

    console.log(`Sync started. Dry run: ${dryRun}, Cursor: ${cursor || 'start'}`);

    // Get batch of Manny Rewards from Notion
    const { rewards: notionRewards, nextCursor } = await getMannyRewardsBatch(notionToken, cursor);
    console.log(`Processing ${notionRewards.length} rewards`);

    // Get all clients from Supabase (this is fast)
    const { data: supabaseClients, error: clientsError } = await supabase
      .from('clientes')
      .select('id, nombre, telefono, puntos_actuales, nivel, notion_page_id, notion_reward_id');

    if (clientsError) throw clientsError;

    const results = {
      batch_size: notionRewards.length,
      next_cursor: nextCursor,
      has_more: !!nextCursor,
      synced: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      details: [] as any[],
    };

    // Create lookup maps - by Supabase ID and by notion_page_id (contacto)
    const supabaseById = new Map(supabaseClients?.map(c => [c.id, c]) || []);
    const supabaseByNotionPageId = new Map(
      supabaseClients?.filter(c => c.notion_page_id).map(c => [c.notion_page_id, c]) || []
    );

    for (const reward of notionRewards) {
      try {
        // Skip special entries
        if (reward.nombre.includes('Puntos acumulados') ||
            reward.nombre.toLowerCase().includes('admin') ||
            !reward.nombre.trim()) {
          results.skipped++;
          continue;
        }

        let supabaseClient = null;

        // Method 1: Find by Supabase ID (most reliable)
        if (reward.supabaseId) {
          supabaseClient = supabaseById.get(reward.supabaseId);
        }

        // Method 2: Find by Cliente relation -> notion_page_id
        if (!supabaseClient && reward.clienteRelation) {
          supabaseClient = supabaseByNotionPageId.get(reward.clienteRelation);
        }

        if (supabaseClient) {
          // Found matching client - ONLY update notion_reward_id if missing
          // DO NOT update puntos or nivel - Supabase is source of truth
          const needsUpdate = supabaseClient.notion_reward_id !== reward.id;

          if (needsUpdate) {
            if (!dryRun) {
              const { error: updateError } = await supabase
                .from('clientes')
                .update({
                  notion_reward_id: reward.id,
                })
                .eq('id', supabaseClient.id);

              if (updateError) {
                results.errors++;
                results.details.push({
                  action: 'update_error',
                  nombre: reward.nombre,
                  error: updateError.message,
                });
                continue;
              }
            }

            results.updated++;
            results.details.push({
              action: dryRun ? 'would_link' : 'linked',
              nombre: reward.nombre,
              supabase_id: supabaseClient.id,
              notion_reward_id: reward.id,
            });
          } else {
            results.synced++;
          }
        } else {
          // No matching client - skip (would need phone lookup which is slow)
          results.skipped++;
          results.details.push({
            action: 'skipped_no_match',
            nombre: reward.nombre,
            notion_id: reward.id,
            has_supabase_id: !!reward.supabaseId,
            has_cliente_relation: !!reward.clienteRelation,
          });
        }
      } catch (err) {
        results.errors++;
        results.details.push({
          action: 'error',
          nombre: reward.nombre,
          error: err.message,
        });
      }
    }

    return new Response(JSON.stringify({
      status: 'completed',
      dry_run: dryRun,
      ...results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Sync error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
