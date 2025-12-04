import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MANNY_REWARDS_DATABASE_ID = '2bfc6cfd-8c1e-8026-9291-e4bc8c18ee01';

interface UpdateNivelData {
  cliente_id: string;
  nuevo_nivel: 'partner' | 'vip';
}

async function createNivelChangeInNotion(
  clienteNotionId: string | null,
  clienteNombre: string,
  nuevoNivel: string,
  clienteSupabaseId: string,
  notionToken: string
): Promise<string | null> {
  const today = new Date().toISOString().split('T')[0];
  const nivelCapitalized = nuevoNivel === 'vip' ? 'VIP' : 'Partner';

  const properties: Record<string, unknown> = {
    'Registro': {
      title: [{ text: { content: `Cambio de nivel: ${clienteNombre} → ${nivelCapitalized}` } }]
    },
    'Tipo': {
      select: { name: 'Puntos Ganados' }  // Usamos este tipo para registros de cambio
    },
    'Puntos': {
      number: 0  // No afecta puntos
    },
    'Nivel': {
      select: { name: nivelCapitalized }
    },
    'Fecha': {
      date: { start: today }
    },
    'Supabase ID': {
      rich_text: [{ text: { content: `nivel-change-${clienteSupabaseId}` } }]
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
    console.error('Failed to create nivel change in Notion:', errorText);
    return null;
  }

  const page = await response.json();
  return page.id;
}

Deno.serve(async (req: Request) => {
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

    const { cliente_id, nuevo_nivel }: UpdateNivelData = await req.json();
    console.log('Update cliente nivel:', cliente_id, nuevo_nivel);

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
      .select('id, nombre, nivel, notion_page_id')
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

    // Crear registro de cambio en Notion Manny Rewards
    const notionPageId = await createNivelChangeInNotion(
      cliente.notion_page_id,
      cliente.nombre,
      nuevo_nivel,
      cliente.id,
      notionToken
    );

    console.log(`Cliente ${cliente.nombre} nivel updated to ${nuevo_nivel}`);

    return new Response(JSON.stringify({
      status: 'success',
      cliente_id: cliente_id,
      nuevo_nivel: nuevo_nivel,
      notion_page_id: notionPageId
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
