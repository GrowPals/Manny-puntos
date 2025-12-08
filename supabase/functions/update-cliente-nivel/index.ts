import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Dominios permitidos para CORS
const ALLOWED_ORIGINS = [
  'https://recompensas.manny.mx',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
];

function getCorsHeaders(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cliente-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

const MANNY_REWARDS_DATABASE_ID = '2bfc6cfd-8c1e-8026-9291-e4bc8c18ee01';

interface UpdateNivelData {
  cliente_id: string;
  nuevo_nivel: 'partner' | 'vip';
}

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
    console.error(`Notion API error: ${error}`);
    throw new Error(`Notion API error: ${error}`);
  }

  return response.json();
}

async function findMannyRewardByContacto(contactoId: string, notionToken: string): Promise<string | null> {
  const result = await notionRequest(`/databases/${MANNY_REWARDS_DATABASE_ID}/query`, 'POST', {
    filter: {
      property: 'Cliente',
      relation: { contains: contactoId }
    },
    page_size: 1
  }, notionToken);

  if (result.results && result.results.length > 0) {
    return result.results[0].id;
  }
  return null;
}

async function updateMannyRewardNivel(rewardId: string, nuevoNivel: string, notionToken: string) {
  const nivelCapitalized = nuevoNivel === 'vip' ? 'VIP' : 'Partner';

  await notionRequest(`/pages/${rewardId}`, 'PATCH', {
    properties: {
      'Nivel': { select: { name: nivelCapitalized } }
    }
  }, notionToken);

  console.log(`Updated Manny Reward ${rewardId} nivel to ${nivelCapitalized}`);
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
    const notionToken = Deno.env.get('NOTION_TOKEN');

    if (!notionToken) {
      return new Response(JSON.stringify({ error: 'NOTION_TOKEN not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // =====================================================
    // VALIDACIÓN DE ADMIN - Solo admins pueden cambiar niveles
    // =====================================================
    const callerClienteId = req.headers.get('x-cliente-id');

    if (!callerClienteId) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing client ID' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar que el caller sea admin
    const { data: caller, error: callerError } = await supabase
      .from('clientes')
      .select('id, es_admin')
      .eq('id', callerClienteId)
      .single();

    if (callerError || !caller || !caller.es_admin) {
      console.warn(`Unauthorized attempt to change nivel by ${callerClienteId}`);
      return new Response(JSON.stringify({ error: 'Forbidden: Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // =====================================================

    const { cliente_id, nuevo_nivel }: UpdateNivelData = await req.json();
    console.log('Update cliente nivel:', cliente_id, nuevo_nivel, 'by admin:', callerClienteId);

    if (!cliente_id || !nuevo_nivel) {
      return new Response(JSON.stringify({ error: 'cliente_id and nuevo_nivel are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (nuevo_nivel !== 'partner' && nuevo_nivel !== 'vip') {
      return new Response(JSON.stringify({ error: 'nivel must be partner or vip' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Obtener datos del cliente
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('id, nombre, nivel, notion_page_id, notion_reward_id')
      .eq('id', cliente_id)
      .single();

    if (clienteError || !cliente) {
      return new Response(JSON.stringify({ error: 'Cliente not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Actualizar nivel en Supabase
    const { error: updateError } = await supabase
      .from('clientes')
      .update({ nivel: nuevo_nivel, last_sync_at: new Date().toISOString() })
      .eq('id', cliente_id);

    if (updateError) {
      throw updateError;
    }

    // Buscar y actualizar Manny Reward en Notion
    let mannyRewardId = cliente.notion_reward_id;

    // Si no tenemos el reward_id guardado, buscarlo por el contacto
    if (!mannyRewardId && cliente.notion_page_id) {
      mannyRewardId = await findMannyRewardByContacto(cliente.notion_page_id, notionToken);

      // Guardar el reward_id encontrado para futuras referencias
      if (mannyRewardId) {
        await supabase
          .from('clientes')
          .update({ notion_reward_id: mannyRewardId })
          .eq('id', cliente_id);
      }
    }

    // Actualizar nivel en Notion si encontramos el Manny Reward
    if (mannyRewardId) {
      await updateMannyRewardNivel(mannyRewardId, nuevo_nivel, notionToken);
      console.log(`Manny Reward ${mannyRewardId} nivel synced to ${nuevo_nivel}`);
    } else {
      console.warn(`No Manny Reward found for cliente ${cliente.nombre} - Notion sync skipped`);
    }

    console.log(`Cliente ${cliente.nombre} nivel updated to ${nuevo_nivel}`);

    return new Response(JSON.stringify({
      status: 'success',
      cliente_id: cliente_id,
      nuevo_nivel: nuevo_nivel,
      notion_reward_id: mannyRewardId,
      notion_synced: !!mannyRewardId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error updating cliente nivel:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
