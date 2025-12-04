import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotionPage {
  id: string;
  properties: {
    [key: string]: any;
  };
}

function mapNotionEstadoToSupabase(notionEstado: string): string | null {
  const mapping: Record<string, string> = {
    'Pendiente Entrega': 'pendiente_entrega',
    'En Proceso': 'en_lista',
    'Entregado': 'entregado',
    'Completado': 'completado'
  };
  return mapping[notionEstado] || null;
}

function extractEstado(properties: any): string | null {
  const estadoField = properties['Estado'];
  if (!estadoField) return null;

  if (estadoField.select?.name) return estadoField.select.name;
  if (estadoField.status?.name) return estadoField.status.name;

  return null;
}

function extractSupabaseId(properties: any): string | null {
  const supabaseIdField = properties['Supabase ID'];
  if (!supabaseIdField || !supabaseIdField.rich_text) return null;

  return supabaseIdField.rich_text.map((t: any) => t.plain_text).join('') || null;
}

function extractFechaEntrega(properties: any): string | null {
  const fechaField = properties['Fecha Entrega'];
  if (!fechaField || !fechaField.date) return null;

  return fechaField.date.start || null;
}

async function getPageFromNotion(pageId: string, notionToken: string): Promise<NotionPage | null> {
  const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    headers: {
      'Authorization': `Bearer ${notionToken}`,
      'Notion-Version': '2022-06-28',
    },
  });

  if (!response.ok) {
    console.error('Failed to fetch page from Notion:', await response.text());
    return null;
  }

  return await response.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const notionToken = Deno.env.get('NOTION_TOKEN');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log('Canje status webhook received:', JSON.stringify(payload, null, 2));

    // Notion webhook verification
    if (payload.challenge) {
      return new Response(JSON.stringify({ challenge: payload.challenge }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let page: NotionPage | null = null;
    let canjeNotionPageId: string | null = null;

    // Extraer página de diferentes estructuras de payload
    if (payload.data?.properties) {
      page = payload.data;
      canjeNotionPageId = page.id;
    } else if (payload.properties) {
      page = payload;
      canjeNotionPageId = page.id;
    } else if (payload.page?.properties) {
      page = payload.page;
      canjeNotionPageId = page.id;
    } else {
      // Notion Automations envía solo el page_id
      canjeNotionPageId = payload.data?.id || payload.id || payload.page_id || payload.page?.id;

      if (canjeNotionPageId && notionToken) {
        console.log('Fetching canje page from Notion API...');
        page = await getPageFromNotion(canjeNotionPageId, notionToken);

        if (!page) {
          return new Response(JSON.stringify({
            status: 'error',
            reason: 'failed to fetch page from Notion',
            page_id: canjeNotionPageId
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else {
        return new Response(JSON.stringify({
          status: 'error',
          reason: 'could not extract page_id from payload'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const properties = page!.properties;
    const notionEstado = extractEstado(properties);
    const supabaseId = extractSupabaseId(properties);
    const fechaEntrega = extractFechaEntrega(properties);

    console.log(`Canje Notion ID: ${canjeNotionPageId}, Supabase ID: ${supabaseId}, Estado: ${notionEstado}, Fecha Entrega: ${fechaEntrega}`);

    if (!supabaseId) {
      // Buscar por notion_page_id
      const { data: canje } = await supabase
        .from('canjes')
        .select('id')
        .eq('notion_page_id', canjeNotionPageId)
        .single();

      if (!canje) {
        return new Response(JSON.stringify({
          status: 'skipped',
          reason: 'canje not found in Supabase'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const canjeId = supabaseId;
    const supabaseEstado = notionEstado ? mapNotionEstadoToSupabase(notionEstado) : null;

    if (!supabaseEstado) {
      return new Response(JSON.stringify({
        status: 'skipped',
        reason: 'unknown estado',
        notion_estado: notionEstado
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Actualizar el canje en Supabase
    const updateData: any = { estado: supabaseEstado };
    if (fechaEntrega) {
      updateData.fecha_entrega = fechaEntrega;
    }

    const { error: updateError } = await supabase
      .from('canjes')
      .update(updateData)
      .eq('id', canjeId);

    if (updateError) {
      console.error('Error updating canje:', updateError);
      return new Response(JSON.stringify({
        status: 'error',
        reason: 'failed to update canje',
        error: updateError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      status: 'success',
      canje_id: canjeId,
      nuevo_estado: supabaseEstado,
      fecha_entrega: fechaEntrega
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing canje webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
