import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateData {
  canje_id: string;
  nuevo_estado: string;
  fecha_entrega?: string;
}

function mapSupabaseEstadoToNotion(estado: string): string {
  const mapping: Record<string, string> = {
    'pendiente_entrega': 'Pendiente Entrega',
    'en_lista': 'En Proceso',
    'entregado': 'Entregado',
    'completado': 'Completado',
    'agendado': 'En Proceso'
  };
  return mapping[estado] || 'Pendiente Entrega';
}

async function updateNotionPage(
  notionPageId: string,
  nuevoEstado: string,
  fechaEntrega: string | null,
  notionToken: string
): Promise<boolean> {
  const estadoNotion = mapSupabaseEstadoToNotion(nuevoEstado);

  const properties: Record<string, unknown> = {
    'Estado': {
      select: { name: estadoNotion }
    }
  };

  if (fechaEntrega) {
    properties['Fecha Entrega'] = {
      date: { start: fechaEntrega.split('T')[0] }
    };
  }

  const response = await fetch(`https://api.notion.com/v1/pages/${notionPageId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${notionToken}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ properties }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to update Notion page:', errorText);
    return false;
  }

  return true;
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

    const { canje_id, nuevo_estado, fecha_entrega }: UpdateData = await req.json();
    console.log('Update canje status in Notion:', canje_id, nuevo_estado);

    if (!canje_id || !nuevo_estado) {
      return new Response(JSON.stringify({ error: 'canje_id and nuevo_estado are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Obtener el notion_page_id del canje
    const { data: canje, error: canjeError } = await supabase
      .from('canjes')
      .select('notion_page_id')
      .eq('id', canje_id)
      .single();

    if (canjeError || !canje) {
      return new Response(JSON.stringify({ error: 'Canje not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!canje.notion_page_id) {
      return new Response(JSON.stringify({
        status: 'skipped',
        reason: 'Canje not synced to Notion yet'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const success = await updateNotionPage(
      canje.notion_page_id,
      nuevo_estado,
      fecha_entrega || null,
      notionToken
    );

    if (!success) {
      return new Response(JSON.stringify({ error: 'Failed to update Notion' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      status: 'success',
      canje_id: canje_id,
      notion_page_id: canje.notion_page_id,
      nuevo_estado: nuevo_estado
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error updating canje status in Notion:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
