import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const MANNY_REWARDS_DATABASE_ID = '2bfc6cfd-8c1e-8026-9291-e4bc8c18ee01';
async function getMannyRewardsPage(clienteNotionId, notionToken) {
  const response = await fetch(`https://api.notion.com/v1/databases/${MANNY_REWARDS_DATABASE_ID}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${notionToken}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      filter: {
        property: 'Cliente',
        relation: {
          contains: clienteNotionId
        }
      },
      page_size: 1
    })
  });
  if (!response.ok) {
    console.error('Failed to search Manny Rewards:', await response.text());
    return null;
  }
  const data = await response.json();
  return data.results?.[0] || null;
}
async function updateMannyRewardsPage(pageId, data, notionToken) {
  const properties = {
    'Puntos': {
      number: data.puntos
    },
    'Monto Total': {
      number: data.montoTotal
    },
    'Nivel': {
      select: {
        name: data.nivel === 'vip' ? 'VIP' : 'Partner'
      }
    },
    'Supabase ID': {
      rich_text: [
        {
          text: {
            content: data.supabaseId
          }
        }
      ]
    }
  };
  // Solo actualizar tickets si hay IDs válidos
  if (data.ticketIds.length > 0) {
    properties['Ticket'] = {
      relation: data.ticketIds.map((id)=>({
          id
        }))
    };
  }
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
    console.error('Failed to update page:', await response.text());
    return false;
  }
  return true;
}
async function createMannyRewardsPage(clienteNotionId, data, notionToken) {
  const today = new Date().toISOString().split('T')[0];
  const properties = {
    'Nombre': {
      title: [
        {
          text: {
            content: data.nombre
          }
        }
      ]
    },
    'Cliente': {
      relation: [
        {
          id: clienteNotionId
        }
      ]
    },
    'Puntos': {
      number: data.puntos
    },
    'Monto Total': {
      number: data.montoTotal
    },
    'Nivel': {
      select: {
        name: data.nivel === 'vip' ? 'VIP' : 'Partner'
      }
    },
    'Fecha': {
      date: {
        start: today
      }
    },
    'Supabase ID': {
      rich_text: [
        {
          text: {
            content: data.supabaseId
          }
        }
      ]
    }
  };
  if (data.ticketIds.length > 0) {
    properties['Ticket'] = {
      relation: data.ticketIds.map((id)=>({
          id
        }))
    };
  }
  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${notionToken}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      parent: {
        database_id: MANNY_REWARDS_DATABASE_ID
      },
      properties
    })
  });
  if (!response.ok) {
    console.error('Failed to create page:', await response.text());
    return null;
  }
  const page = await response.json();
  return page.id;
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
    const body = await req.json().catch(()=>({}));
    const dryRun = body.dry_run === true;
    const limit = body.limit || 100;
    // Obtener datos de clientes con sus totales
    const { data: clientes, error: clientesError } = await supabase.from('clientes').select(`
        id,
        nombre,
        telefono,
        puntos_actuales,
        nivel,
        notion_page_id
      `).not('notion_page_id', 'is', null).limit(limit);
    if (clientesError) {
      throw new Error(`Error fetching clientes: ${clientesError.message}`);
    }
    const results = {
      total: clientes?.length || 0,
      updated: 0,
      created: 0,
      skipped: 0,
      errors: 0,
      details: []
    };
    for (const cliente of clientes || []){
      try {
        // Obtener historial de servicios
        const { data: servicios } = await supabase.from('historial_servicios').select('monto, notion_ticket_id').eq('cliente_id', cliente.id);
        const montoTotal = servicios?.reduce((sum, s)=>sum + (Number(s.monto) || 0), 0) || 0;
        const ticketIds = servicios?.map((s)=>s.notion_ticket_id).filter((id)=>id !== null && id !== undefined) || [];
        // Buscar página existente en Manny Rewards
        const existingPage = await getMannyRewardsPage(cliente.notion_page_id, notionToken);
        const syncData = {
          nombre: cliente.nombre,
          puntos: cliente.puntos_actuales,
          montoTotal: montoTotal,
          nivel: cliente.nivel || 'partner',
          supabaseId: cliente.id,
          ticketIds: ticketIds
        };
        if (dryRun) {
          results.details.push({
            cliente: cliente.nombre,
            action: existingPage ? 'would_update' : 'would_create',
            data: syncData
          });
          continue;
        }
        if (existingPage) {
          // Actualizar página existente
          const success = await updateMannyRewardsPage(existingPage.id, syncData, notionToken);
          if (success) {
            results.updated++;
            results.details.push({
              cliente: cliente.nombre,
              action: 'updated',
              pageId: existingPage.id
            });
          } else {
            results.errors++;
            results.details.push({
              cliente: cliente.nombre,
              action: 'error',
              error: 'Failed to update'
            });
          }
        } else {
          // Crear nueva página
          const pageId = await createMannyRewardsPage(cliente.notion_page_id, syncData, notionToken);
          if (pageId) {
            results.created++;
            results.details.push({
              cliente: cliente.nombre,
              action: 'created',
              pageId
            });
          } else {
            results.errors++;
            results.details.push({
              cliente: cliente.nombre,
              action: 'error',
              error: 'Failed to create'
            });
          }
        }
        // Rate limiting para Notion API
        await new Promise((resolve)=>setTimeout(resolve, 350));
      } catch (err) {
        results.errors++;
        results.details.push({
          cliente: cliente.nombre,
          action: 'error',
          error: err.message
        });
      }
    }
    return new Response(JSON.stringify({
      status: dryRun ? 'dry_run' : 'completed',
      ...results
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error syncing Manny Rewards:', error);
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
