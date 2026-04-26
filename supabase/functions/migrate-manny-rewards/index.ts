import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const MANNY_REWARDS_DATABASE_ID = '2bfc6cfd-8c1e-8026-9291-e4bc8c18ee01';
function extractClienteRelation(properties) {
  const clienteField = properties['Cliente'];
  if (!clienteField || !clienteField.relation || clienteField.relation.length === 0) {
    return null;
  }
  return clienteField.relation[0].id;
}
function extractPuntos(properties) {
  const puntosField = properties['Puntos'];
  if (!puntosField) return 0;
  return puntosField.number ?? 0;
}
function extractNivel(properties) {
  const nivelField = properties['Nivel'];
  if (!nivelField || !nivelField.select) return null;
  return nivelField.select.name || null;
}
function extractMonto(properties) {
  const montoField = properties['Monto Total'];
  if (!montoField) return 0;
  return montoField.number ?? 0;
}
function extractTickets(properties) {
  const ticketField = properties['Ticket'];
  if (!ticketField || !ticketField.relation) return [];
  return ticketField.relation.map((r)=>r.id);
}
function extractFecha(properties) {
  const fechaField = properties['Fecha'];
  if (!fechaField || !fechaField.date) return null;
  return fechaField.date.start || null;
}
function extractSupabaseId(properties) {
  const supabaseIdField = properties['Supabase ID'];
  if (!supabaseIdField || !supabaseIdField.rich_text) return null;
  return supabaseIdField.rich_text.map((t)=>t.plain_text).join('') || null;
}
async function getAllMannyRewardsPages(notionToken) {
  let allPages = [];
  let startCursor = undefined;
  let hasMore = true;
  while(hasMore){
    const body = {
      page_size: 100
    };
    if (startCursor) body.start_cursor = startCursor;
    const response = await fetch(`https://api.notion.com/v1/databases/${MANNY_REWARDS_DATABASE_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      throw new Error(`Failed to query database: ${await response.text()}`);
    }
    const data = await response.json();
    allPages = allPages.concat(data.results);
    hasMore = data.has_more;
    startCursor = data.next_cursor;
  }
  return allPages;
}
async function getClienteNombre(contactoNotionId, notionToken) {
  const response = await fetch(`https://api.notion.com/v1/pages/${contactoNotionId}`, {
    headers: {
      'Authorization': `Bearer ${notionToken}`,
      'Notion-Version': '2022-06-28'
    }
  });
  if (!response.ok) {
    return 'Cliente Sin Nombre';
  }
  const page = await response.json();
  const titleField = page.properties['Nombre'] || page.properties['Name'];
  if (!titleField || !titleField.title) return 'Cliente Sin Nombre';
  return titleField.title.map((t)=>t.plain_text).join('') || 'Cliente Sin Nombre';
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
  if (!response.ok) {
    console.error('Failed to update page:', pageId, await response.text());
    return false;
  }
  return true;
}
async function archivePage(pageId, notionToken) {
  const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${notionToken}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      archived: true
    })
  });
  if (!response.ok) {
    console.error('Failed to archive page:', pageId, await response.text());
    return false;
  }
  return true;
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
    // Obtener parámetro dry_run
    const url = new URL(req.url);
    const dryRun = url.searchParams.get('dry_run') === 'true';
    console.log(`Starting Manny Rewards migration (dry_run: ${dryRun})...`);
    // 1. Obtener todas las páginas de Manny Rewards
    const allPages = await getAllMannyRewardsPages(notionToken);
    console.log(`Found ${allPages.length} total pages`);
    // 2. Agrupar por cliente
    const clientesMap = new Map();
    for (const page of allPages){
      const clienteNotionId = extractClienteRelation(page.properties);
      if (!clienteNotionId) {
        console.log(`Page ${page.id} has no cliente relation, will archive`);
        continue;
      }
      if (!clientesMap.has(clienteNotionId)) {
        clientesMap.set(clienteNotionId, {
          clienteNotionId,
          supabaseId: null,
          pages: [],
          totalMonto: 0,
          puntos: 0,
          nivel: null,
          tickets: [],
          fechaMasAntigua: null
        });
      }
      const clienteData = clientesMap.get(clienteNotionId);
      clienteData.pages.push(page);
      clienteData.totalMonto += extractMonto(page.properties);
      clienteData.puntos = Math.max(clienteData.puntos, extractPuntos(page.properties));
      const nivel = extractNivel(page.properties);
      if (nivel && !clienteData.nivel) clienteData.nivel = nivel;
      if (nivel === 'VIP') clienteData.nivel = 'VIP'; // VIP tiene prioridad
      const tickets = extractTickets(page.properties);
      tickets.forEach((t)=>{
        if (!clienteData.tickets.includes(t)) {
          clienteData.tickets.push(t);
        }
      });
      const fecha = extractFecha(page.properties);
      if (fecha && (!clienteData.fechaMasAntigua || fecha < clienteData.fechaMasAntigua)) {
        clienteData.fechaMasAntigua = fecha;
      }
      const supabaseId = extractSupabaseId(page.properties);
      if (supabaseId && !clienteData.supabaseId) {
        clienteData.supabaseId = supabaseId;
      }
    }
    console.log(`Found ${clientesMap.size} unique clientes`);
    const results = {
      totalPages: allPages.length,
      uniqueClientes: clientesMap.size,
      consolidated: 0,
      archived: 0,
      errors: []
    };
    // 3. Consolidar cada cliente
    for (const [clienteNotionId, clienteData] of clientesMap){
      if (clienteData.pages.length === 0) continue;
      // Obtener nombre del cliente
      const clienteNombre = await getClienteNombre(clienteNotionId, notionToken);
      // Obtener puntos actuales de Supabase si tenemos el ID
      let puntosActuales = clienteData.puntos;
      if (clienteData.supabaseId) {
        const { data: cliente } = await supabase.from('clientes').select('puntos_actuales, nivel').eq('id', clienteData.supabaseId).single();
        if (cliente) {
          puntosActuales = cliente.puntos_actuales;
          if (cliente.nivel === 'vip') clienteData.nivel = 'VIP';
        }
      }
      // Ordenar páginas por fecha (más antigua primero)
      clienteData.pages.sort((a, b)=>{
        const fechaA = extractFecha(a.properties) || '9999';
        const fechaB = extractFecha(b.properties) || '9999';
        return fechaA.localeCompare(fechaB);
      });
      // La primera página será la principal (consolidada)
      const mainPage = clienteData.pages[0];
      const pagesToArchive = clienteData.pages.slice(1);
      console.log(`Cliente ${clienteNombre}: ${clienteData.pages.length} pages → 1 (archiving ${pagesToArchive.length})`);
      if (!dryRun) {
        // Actualizar página principal con datos consolidados
        const updateProps = {
          'Nombre': {
            title: [
              {
                text: {
                  content: clienteNombre
                }
              }
            ]
          },
          'Puntos': {
            number: puntosActuales
          },
          'Monto Total': {
            number: clienteData.totalMonto
          }
        };
        // Agregar nivel si existe
        if (clienteData.nivel) {
          updateProps['Nivel'] = {
            select: {
              name: clienteData.nivel
            }
          };
        }
        // Agregar fecha
        if (clienteData.fechaMasAntigua) {
          updateProps['Fecha'] = {
            date: {
              start: clienteData.fechaMasAntigua
            }
          };
        }
        // Agregar todos los tickets
        if (clienteData.tickets.length > 0) {
          updateProps['Ticket'] = {
            relation: clienteData.tickets.map((id)=>({
                id
              }))
          };
        }
        // Limpiar Ticket ID (campo de texto obsoleto)
        updateProps['Ticket ID'] = {
          rich_text: []
        };
        // Limpiar Pendientes
        updateProps['Pendientes'] = {
          rich_text: []
        };
        const updated = await updateNotionPage(mainPage.id, updateProps, notionToken);
        if (updated) {
          results.consolidated++;
        } else {
          results.errors.push(`Failed to update main page for ${clienteNombre}`);
        }
        // Archivar páginas duplicadas
        for (const page of pagesToArchive){
          const archived = await archivePage(page.id, notionToken);
          if (archived) {
            results.archived++;
          } else {
            results.errors.push(`Failed to archive page ${page.id}`);
          }
        }
      } else {
        results.consolidated++;
        results.archived += pagesToArchive.length;
      }
    }
    console.log('Migration complete:', results);
    return new Response(JSON.stringify({
      status: 'success',
      dryRun,
      results
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Migration error:', error);
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
