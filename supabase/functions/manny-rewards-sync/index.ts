import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const MANNY_REWARDS_DATABASE_ID = '2bfc6cfd-8c1e-8026-9291-e4bc8c18ee01';
// =====================================================
// EXTRACCIÓN DE DATOS DE NOTION
// =====================================================
function extractNivel(properties) {
  const nivelField = properties['Nivel'];
  if (!nivelField || !nivelField.select) return null;
  const nivel = nivelField.select.name?.toLowerCase();
  return nivel === 'vip' ? 'vip' : 'partner';
}
function extractPuntos(properties) {
  const puntosField = properties['Puntos'];
  if (!puntosField) return null;
  return puntosField.number ?? null;
}
function extractClienteRelation(properties) {
  const clienteField = properties['Cliente'];
  if (!clienteField || !clienteField.relation || clienteField.relation.length === 0) {
    return null;
  }
  return clienteField.relation[0].id;
}
function extractSupabaseId(properties) {
  const supabaseIdField = properties['Supabase ID'];
  if (!supabaseIdField || !supabaseIdField.rich_text) return null;
  return supabaseIdField.rich_text.map((t)=>t.plain_text).join('') || null;
}
function extractNombre(properties) {
  const titleField = properties['Nombre'];
  if (!titleField || !titleField.title) return null;
  return titleField.title.map((t)=>t.plain_text).join('') || null;
}
async function getPageFromNotion(pageId, notionToken) {
  const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    headers: {
      'Authorization': `Bearer ${notionToken}`,
      'Notion-Version': '2022-06-28'
    }
  });
  if (!response.ok) {
    console.error('Failed to fetch page from Notion:', await response.text());
    return null;
  }
  return await response.json();
}
async function getClienteFromContacto(contactoNotionId, notionToken, supabase) {
  // Primero buscar en Supabase por notion_page_id
  const { data: cliente } = await supabase.from('clientes').select('id, telefono, puntos_actuales, nivel').eq('notion_page_id', contactoNotionId).single();
  if (cliente) return cliente;
  // Si no existe, obtener teléfono de Notion y buscar por teléfono
  const contactPage = await getPageFromNotion(contactoNotionId, notionToken);
  if (!contactPage) return null;
  const phoneField = contactPage.properties['Teléfono'];
  if (!phoneField || !phoneField.phone_number) return null;
  let phone = phoneField.phone_number.replace(/\D/g, '');
  if (phone.startsWith('52') && phone.length > 10) phone = phone.slice(2);
  if (phone.startsWith('1') && phone.length > 10) phone = phone.slice(1);
  const { data: clienteByPhone } = await supabase.from('clientes').select('id, telefono, puntos_actuales, nivel').eq('telefono', phone).single();
  if (clienteByPhone) {
    // Actualizar notion_page_id
    await supabase.from('clientes').update({
      notion_page_id: contactoNotionId
    }).eq('id', clienteByPhone.id);
    return clienteByPhone;
  }
  return null;
}
async function updateNotionPage(pageId, properties, notionToken) {
  const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${notionToken}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties
    })
  });
  return response.ok;
}
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const notionToken = Deno.env.get('NOTION_TOKEN');
    if (!notionToken) {
      return new Response(JSON.stringify({
        error: 'NOTION_TOKEN not configured'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const payload = await req.json();
    console.log('Manny Rewards sync webhook received:', JSON.stringify(payload, null, 2));
    // Notion webhook verification
    if (payload.challenge) {
      return new Response(JSON.stringify({
        challenge: payload.challenge
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Extraer página
    let page = null;
    let pageId = null;
    if (payload.data?.properties) {
      page = payload.data;
      pageId = page.id;
    } else if (payload.properties) {
      page = payload;
      pageId = page.id;
    } else {
      pageId = payload.data?.id || payload.id || payload.page_id || payload.page?.id;
      if (pageId) {
        page = await getPageFromNotion(pageId, notionToken);
      }
    }
    if (!page || !page.properties) {
      return new Response(JSON.stringify({
        status: 'skipped',
        reason: 'no page data'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const properties = page.properties;
    const nivelNotion = extractNivel(properties);
    const puntosNotion = extractPuntos(properties);
    const clienteNotionId = extractClienteRelation(properties);
    const nombre = extractNombre(properties);
    const supabaseId = extractSupabaseId(properties);
    console.log(`Nombre: ${nombre}, Nivel: ${nivelNotion}, Puntos: ${puntosNotion}, Cliente Notion: ${clienteNotionId}`);
    if (!clienteNotionId) {
      return new Response(JSON.stringify({
        status: 'skipped',
        reason: 'no cliente relation'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Obtener cliente de Supabase
    const cliente = await getClienteFromContacto(clienteNotionId, notionToken, supabase);
    if (!cliente) {
      return new Response(JSON.stringify({
        status: 'skipped',
        reason: 'cliente not found in Supabase'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const actions = [];
    // =====================================================
    // SINCRONIZACIÓN BIDIRECCIONAL: NIVEL
    // Si el nivel en Notion es diferente al de Supabase, actualizar Supabase
    // =====================================================
    if (nivelNotion && cliente.nivel !== nivelNotion) {
      const { error } = await supabase.from('clientes').update({
        nivel: nivelNotion,
        last_sync_at: new Date().toISOString(),
        sync_source: 'notion'
      }).eq('id', cliente.id);
      if (!error) {
        actions.push(`nivel: ${cliente.nivel} → ${nivelNotion}`);
      }
    }
    // =====================================================
    // SINCRONIZACIÓN BIDIRECCIONAL: PUNTOS
    // Si los puntos en Notion son diferentes a Supabase, ajustar
    // =====================================================
    if (puntosNotion !== null && puntosNotion !== cliente.puntos_actuales) {
      const diferencia = puntosNotion - cliente.puntos_actuales;
      if (diferencia !== 0) {
        // Usar la función atómica para ajustar puntos
        const { error: rpcError } = await supabase.rpc('asignar_puntos_atomico', {
          p_cliente_telefono: cliente.telefono,
          p_puntos_a_sumar: diferencia,
          p_concepto: `Ajuste desde Notion Manny Rewards`
        });
        if (!rpcError) {
          actions.push(`puntos: ${cliente.puntos_actuales} → ${puntosNotion} (${diferencia > 0 ? '+' : ''}${diferencia})`);
        }
      }
    }
    // Si no se actualizó el Supabase ID en Notion, actualizarlo
    if (!supabaseId && cliente.id) {
      await updateNotionPage(pageId, {
        'Supabase ID': {
          rich_text: [
            {
              text: {
                content: cliente.id
              }
            }
          ]
        }
      }, notionToken);
      actions.push('supabase_id synced');
    }
    if (actions.length === 0) {
      return new Response(JSON.stringify({
        status: 'no_changes',
        cliente_id: cliente.id
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log(`Cliente ${cliente.id} actualizado: ${actions.join(', ')}`);
    return new Response(JSON.stringify({
      status: 'success',
      cliente_id: cliente.id,
      actions
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in manny-rewards-sync:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
