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

// Default DB IDs if not set in env
const DEFAULT_CONTACTOS_DB = '17ac6cfd-8c1e-8068-8bc0-d32488189164';
const DEFAULT_MANNY_REWARDS_DB = '2bfc6cfd-8c1e-8026-9291-e4bc8c18ee01';

interface SyncQueueItem {
  id: string;
  operation_type: string;
  resource_id: string;
  payload: Record<string, unknown>;
  retry_count: number;
}

async function notionRequest(endpoint: string, method: string, body: unknown, token: string) {
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

async function processSyncCliente(
  supabase: ReturnType<typeof createClient>,
  resourceId: string,
  notionToken: string
) {
  const CONTACTOS_DB = Deno.env.get('NOTION_CONTACTOS_DB') || DEFAULT_CONTACTOS_DB;
  const MANNY_REWARDS_DB = Deno.env.get('NOTION_MANNY_REWARDS_DB') || DEFAULT_MANNY_REWARDS_DB;

  // Get cliente from Supabase
  const { data: cliente, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', resourceId)
    .single();

  if (error || !cliente) {
    throw new Error(`Cliente not found: ${resourceId}`);
  }

  let contactoId = cliente.notion_page_id;
  let mannyRewardId = cliente.notion_reward_id;

  // Find or create Contacto
  if (!contactoId) {
    // Try to find by phone
    const searchResult = await notionRequest(`/databases/${CONTACTOS_DB}/query`, 'POST', {
      filter: {
        property: 'Teléfono',
        phone_number: { equals: cliente.telefono }
      },
      page_size: 1
    }, notionToken);

    if (searchResult.results?.length > 0) {
      contactoId = searchResult.results[0].id;
    } else {
      // Try with +52 prefix
      const searchResult2 = await notionRequest(`/databases/${CONTACTOS_DB}/query`, 'POST', {
        filter: {
          property: 'Teléfono',
          phone_number: { equals: `+52${cliente.telefono}` }
        },
        page_size: 1
      }, notionToken);

      if (searchResult2.results?.length > 0) {
        contactoId = searchResult2.results[0].id;
      } else {
        // Create new Contacto
        const createResult = await notionRequest('/pages', 'POST', {
          parent: { database_id: CONTACTOS_DB },
          properties: {
            '': { title: [{ text: { content: cliente.nombre || 'Nuevo Cliente' } }] },
            'Teléfono': { phone_number: `+52${cliente.telefono}` }
          }
        }, notionToken);
        contactoId = createResult.id;
      }
    }

    // Update Supabase
    await supabase
      .from('clientes')
      .update({ notion_page_id: contactoId })
      .eq('id', cliente.id);
  }

  // Find or create Manny Reward
  if (!mannyRewardId && contactoId) {
    const searchResult = await notionRequest(`/databases/${MANNY_REWARDS_DB}/query`, 'POST', {
      filter: {
        property: 'Cliente',
        relation: { contains: contactoId }
      },
      page_size: 1
    }, notionToken);

    if (searchResult.results?.length > 0) {
      mannyRewardId = searchResult.results[0].id;
    } else {
      // Create new Manny Reward
      const createResult = await notionRequest('/pages', 'POST', {
        parent: { database_id: MANNY_REWARDS_DB },
        properties: {
          'Nombre': { title: [{ text: { content: cliente.nombre || 'Nuevo Cliente' } }] },
          'Cliente': { relation: [{ id: contactoId }] },
          'Nivel': { select: { name: 'Partner' } },
          'Puntos': { number: 0 },
          'Supabase ID': { rich_text: [{ text: { content: cliente.id } }] }
        }
      }, notionToken);
      mannyRewardId = createResult.id;
    }

    // Update Supabase
    await supabase
      .from('clientes')
      .update({ notion_reward_id: mannyRewardId })
      .eq('id', cliente.id);
  }

  return { contactoId, mannyRewardId };
}

async function processCreateBenefitTicket(
  supabase: ReturnType<typeof createClient>,
  resourceId: string,
  notionToken: string
) {
  const TICKETS_DB = Deno.env.get('NOTION_TICKETS_DB');

  if (!TICKETS_DB) {
    throw new Error('NOTION_TICKETS_DB not configured');
  }

  // Get beneficio from Supabase
  const { data: beneficio, error } = await supabase
    .from('beneficios')
    .select(`
      *,
      cliente:clientes(id, nombre, telefono, notion_reward_id)
    `)
    .eq('id', resourceId)
    .single();

  if (error || !beneficio) {
    throw new Error(`Beneficio not found: ${resourceId}`);
  }

  // Create ticket in Notion
  const result = await notionRequest('/pages', 'POST', {
    parent: { database_id: TICKETS_DB },
    properties: {
      'Nombre': { title: [{ text: { content: beneficio.nombre || 'Beneficio' } }] },
      'Estado': { status: { name: 'Pendiente' } },
      'Tipo': { select: { name: 'Beneficio Regalo' } },
      ...(beneficio.cliente?.notion_reward_id && {
        'Cliente Manny Rewards': { relation: [{ id: beneficio.cliente.notion_reward_id }] }
      }),
      'Supabase ID': { rich_text: [{ text: { content: resourceId } }] },
      'Fecha Expira': beneficio.fecha_expiracion ? {
        date: { start: beneficio.fecha_expiracion }
      } : undefined
    }
  }, notionToken);

  // Update beneficio with notion_ticket_id
  await supabase
    .from('beneficios')
    .update({ notion_ticket_id: result.id })
    .eq('id', resourceId);

  return { ticketId: result.id };
}

async function processItem(
  supabase: ReturnType<typeof createClient>,
  item: SyncQueueItem,
  notionToken: string
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  try {
    let result;

    switch (item.operation_type) {
      case 'sync_cliente':
        result = await processSyncCliente(supabase, item.resource_id, notionToken);
        break;
      case 'create_benefit_ticket':
        result = await processCreateBenefitTicket(supabase, item.resource_id, notionToken);
        break;
      default:
        throw new Error(`Unknown operation type: ${item.operation_type}`);
    }

    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Admin-only function for processing sync queue
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

    // Parse batch size from request or use default
    let batchSize = 10;
    try {
      const body = await req.json();
      if (body.batch_size && typeof body.batch_size === 'number') {
        batchSize = Math.min(body.batch_size, 50); // Max 50 per batch
      }
    } catch {
      // No body or invalid JSON, use defaults
    }

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      dead_lettered: 0,
      items: [] as Array<{ id: string; success: boolean; error?: string }>,
    };

    // Process items in a loop
    for (let i = 0; i < batchSize; i++) {
      // Dequeue next item
      const { data: item, error: dequeueError } = await supabase.rpc('dequeue_sync_operation');

      if (dequeueError) {
        console.error('Dequeue error:', dequeueError);
        break;
      }

      if (!item) {
        // No more items in queue
        break;
      }

      console.log(`Processing item ${item.id}: ${item.operation_type} for ${item.resource_id}`);
      results.processed++;

      // Process the item
      const processResult = await processItem(supabase, item, notionToken);

      // Complete or fail the item
      const { error: completeError } = await supabase.rpc('complete_sync_operation', {
        p_queue_id: item.id,
        p_success: processResult.success,
        p_error_message: processResult.error || null,
        p_result: processResult.result || null,
      });

      if (completeError) {
        console.error('Complete error:', completeError);
      }

      if (processResult.success) {
        results.succeeded++;
      } else {
        // Check if we need to mark as dead letter (already handled by complete_sync_operation)
        if (item.retry_count >= 4) { // 0-indexed, so 4 means 5th attempt
          results.dead_lettered++;
        }
        results.failed++;
      }

      results.items.push({
        id: item.id,
        success: processResult.success,
        error: processResult.error,
      });
    }

    console.log('Sync queue processing complete:', results);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing sync queue:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
