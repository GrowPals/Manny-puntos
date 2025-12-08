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

const MANNY_REWARDS_DATABASE_ID = '2bfc6cfd-8c1e-8026-9291-e4bc8c18ee01';

interface CanjeData {
  canje_id: string;
}

async function createCanjeInNotion(
  clienteNotionId: string | null,
  clienteNombre: string,
  productoNombre: string,
  puntosUsados: number,
  estado: string,
  canjeSupabaseId: string,
  nivelCliente: string,
  notionToken: string
): Promise<string | null> {
  const today = new Date().toISOString().split('T')[0];

  // Mapear estado de Supabase a Notion
  const estadoNotion = {
    'pendiente_entrega': 'Pendiente Entrega',
    'en_lista': 'En Proceso',
    'entregado': 'Entregado',
    'completado': 'Completado',
    'agendado': 'En Proceso'
  }[estado] || 'Pendiente Entrega';

  const nivelCapitalized = nivelCliente === 'vip' ? 'VIP' : 'Partner';

  const properties: Record<string, unknown> = {
    'Registro': {
      title: [{ text: { content: `Canje: ${productoNombre}` } }]
    },
    'Tipo': {
      select: { name: 'Canje' }
    },
    'Puntos': {
      number: -puntosUsados  // Negativo porque son puntos usados
    },
    'Producto': {
      rich_text: [{ text: { content: productoNombre } }]
    },
    'Estado': {
      select: { name: estadoNotion }
    },
    'Nivel': {
      select: { name: nivelCapitalized }
    },
    'Fecha': {
      date: { start: today }
    },
    'Supabase ID': {
      rich_text: [{ text: { content: canjeSupabaseId } }]
    }
  };

  // Agregar relación con Cliente si tiene notion_page_id
  if (clienteNotionId) {
    properties['Cliente'] = {
      relation: [{ id: clienteNotionId }]
    };
  }

  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${notionToken}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      parent: { database_id: MANNY_REWARDS_DATABASE_ID },
      properties
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to create canje in Notion:', errorText);
    return null;
  }

  const page = await response.json();
  return page.id;
}

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

    // Validate caller is authenticated
    const callerClienteId = req.headers.get('x-cliente-id');
    if (!callerClienteId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify caller exists in database
    const { data: caller, error: callerError } = await supabase
      .from('clientes')
      .select('id')
      .eq('id', callerClienteId)
      .single();

    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { canje_id }: CanjeData = await req.json();
    console.log('Sync canje to Notion:', canje_id);

    if (!canje_id) {
      return new Response(JSON.stringify({ error: 'canje_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Obtener datos completos del canje
    const { data: canje, error: canjeError } = await supabase
      .from('canjes')
      .select(`
        id,
        puntos_usados,
        estado,
        notion_page_id,
        clientes(id, nombre, notion_page_id, nivel),
        productos(nombre)
      `)
      .eq('id', canje_id)
      .single();

    if (canjeError || !canje) {
      console.error('Canje not found:', canjeError);
      return new Response(JSON.stringify({ error: 'Canje not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Si ya tiene notion_page_id, ya fue sincronizado
    if (canje.notion_page_id) {
      return new Response(JSON.stringify({
        status: 'already_synced',
        notion_page_id: canje.notion_page_id
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cliente = canje.clientes as { id: string; nombre: string; notion_page_id: string | null; nivel: string } | null;
    const producto = canje.productos as { nombre: string } | null;

    const notionPageId = await createCanjeInNotion(
      cliente?.notion_page_id || null,
      cliente?.nombre || 'Cliente',
      producto?.nombre || 'Producto',
      canje.puntos_usados,
      canje.estado,
      canje.id,
      cliente?.nivel || 'partner',
      notionToken
    );

    if (!notionPageId) {
      return new Response(JSON.stringify({ error: 'Failed to create in Notion' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Guardar el notion_page_id en el canje
    await supabase
      .from('canjes')
      .update({ notion_page_id: notionPageId })
      .eq('id', canje_id);

    console.log(`Canje ${canje_id} synced to Notion: ${notionPageId}`);

    return new Response(JSON.stringify({
      status: 'success',
      canje_id: canje_id,
      notion_page_id: notionPageId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error syncing canje to Notion:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
