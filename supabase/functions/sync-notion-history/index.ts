import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const TICKETS_DATABASE_ID = '17ac6cfd-8c1e-8162-b724-d4047a7e7635';
const CONTACTOS_DATABASE_ID = '17ac6cfd-8c1e-8068-8bc0-d32488189164';
async function queryNotionDatabase(databaseId, notionToken, filter, startCursor) {
  const body = {
    page_size: 100
  };
  if (filter) body.filter = filter;
  if (startCursor) body.start_cursor = startCursor;
  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${notionToken}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Notion API error: ${errorText}`);
  }
  return await response.json();
}
async function getContactPage(pageId, notionToken) {
  const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    headers: {
      'Authorization': `Bearer ${notionToken}`,
      'Notion-Version': '2022-06-28'
    }
  });
  if (!response.ok) return null;
  return await response.json();
}
function extractPhone(properties) {
  // Try rollup first (from Contacto relation)
  const phoneRollup = properties['Teléfono'];
  if (phoneRollup?.rollup?.array?.[0]?.phone_number) {
    let phone = phoneRollup.rollup.array[0].phone_number.replace(/\D/g, '');
    if (phone.startsWith('52') && phone.length > 10) phone = phone.slice(2);
    if (phone.startsWith('1') && phone.length > 10) phone = phone.slice(1);
    return phone.length >= 10 ? phone : null;
  }
  return null;
}
function extractTicketData(page) {
  const props = page.properties;
  // Extract Ticket ID/Name
  const titleField = props['Ticket '] || props['Ticket'] || props['title'];
  const ticketName = titleField?.title?.map((t)=>t.plain_text).join('') || '';
  // Extract Ticket ID formula
  const ticketIdFormula = props['Ticket ID']?.formula?.string || ticketName;
  // Extract Monto
  const monto = props['Monto']?.number || props['Ingreso']?.rollup?.number || 0;
  // Extract Tipo de trabajo
  const tipoTrabajo = props['Tipo de trabajo']?.select?.name || null;
  // Extract description
  const descripcion = props['Descripción breve del servicio ']?.rich_text?.map((t)=>t.plain_text).join('') || '';
  // Extract date - try multiple fields
  let fechaServicio = props['Fecha']?.date?.start || props['Agregado']?.created_time || page.created_time;
  // Extract Contacto relation ID
  const contactoRelation = props['Contacto']?.relation?.[0]?.id || null;
  return {
    notionPageId: page.id,
    ticketName: ticketIdFormula || ticketName,
    ticketNumber: ticketName,
    tipoTrabajo,
    descripcion,
    monto,
    fechaServicio,
    contactoNotionId: contactoRelation
  };
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
    // Parse request body for options
    let options = {
      dryRun: false,
      limit: null
    };
    try {
      const body = await req.json();
      options = {
        ...options,
        ...body
      };
    } catch (e) {
    // No body or invalid JSON, use defaults
    }
    const result = {
      total_tickets: 0,
      synced: 0,
      skipped: 0,
      errors: 0,
      details: []
    };
    // Query all completed tickets from Notion
    let hasMore = true;
    let nextCursor;
    const allTickets = [];
    while(hasMore){
      const response = await queryNotionDatabase(TICKETS_DATABASE_ID, notionToken, {
        property: 'Status',
        status: {
          equals: 'Terminadas'
        }
      }, nextCursor);
      allTickets.push(...response.results);
      hasMore = response.has_more;
      nextCursor = response.next_cursor;
      // Respect limit if set
      if (options.limit && allTickets.length >= options.limit) {
        allTickets.splice(options.limit);
        hasMore = false;
      }
    }
    result.total_tickets = allTickets.length;
    console.log(`Found ${allTickets.length} completed tickets`);
    // Build a cache of phone numbers from contacto pages
    const contactoCache = new Map();
    // Process each ticket
    for (const ticket of allTickets){
      const ticketData = extractTicketData(ticket);
      try {
        // Check if already synced
        const { data: existing } = await supabase.from('historial_servicios').select('id').eq('notion_ticket_id', ticketData.notionPageId).single();
        if (existing) {
          result.skipped++;
          result.details.push({
            ticket: ticketData.ticketName,
            status: 'skipped',
            reason: 'already synced'
          });
          continue;
        }
        // Get phone number
        let phone = extractPhone(ticket.properties);
        // If no phone from rollup and we have contacto ID, fetch it
        if (!phone && ticketData.contactoNotionId) {
          if (contactoCache.has(ticketData.contactoNotionId)) {
            phone = contactoCache.get(ticketData.contactoNotionId) || null;
          } else {
            const contactPage = await getContactPage(ticketData.contactoNotionId, notionToken);
            if (contactPage) {
              const phoneField = contactPage.properties['Teléfono'];
              if (phoneField?.phone_number) {
                phone = phoneField.phone_number.replace(/\D/g, '');
                if (phone.startsWith('52') && phone.length > 10) phone = phone.slice(2);
                if (phone.startsWith('1') && phone.length > 10) phone = phone.slice(1);
                if (phone.length < 10) phone = null;
              }
              contactoCache.set(ticketData.contactoNotionId, phone || '');
            }
          }
        }
        if (!phone) {
          result.skipped++;
          result.details.push({
            ticket: ticketData.ticketName,
            status: 'skipped',
            reason: 'no phone number found'
          });
          continue;
        }
        // Find cliente in Supabase
        const { data: cliente } = await supabase.from('clientes').select('id, nombre, telefono, notion_page_id').eq('telefono', phone).single();
        if (!cliente) {
          result.skipped++;
          result.details.push({
            ticket: ticketData.ticketName,
            phone,
            status: 'skipped',
            reason: 'cliente not found in Supabase'
          });
          continue;
        }
        // Update cliente's notion_page_id if not set
        if (!cliente.notion_page_id && ticketData.contactoNotionId) {
          await supabase.from('clientes').update({
            notion_page_id: ticketData.contactoNotionId
          }).eq('id', cliente.id);
        }
        // Calculate points (5% of monto)
        const puntosGenerados = ticketData.monto > 0 ? Math.floor(ticketData.monto * 0.05) : 0;
        if (options.dryRun) {
          result.synced++;
          result.details.push({
            ticket: ticketData.ticketName,
            cliente: cliente.nombre,
            phone,
            monto: ticketData.monto,
            puntos: puntosGenerados,
            tipo: ticketData.tipoTrabajo,
            fecha: ticketData.fechaServicio,
            status: 'would_sync'
          });
          continue;
        }
        // Insert into historial_servicios
        const { error: insertError } = await supabase.from('historial_servicios').insert({
          cliente_id: cliente.id,
          notion_ticket_id: ticketData.notionPageId,
          ticket_number: ticketData.ticketNumber,
          tipo_trabajo: ticketData.tipoTrabajo,
          titulo: ticketData.ticketName,
          descripcion: ticketData.descripcion || null,
          monto: ticketData.monto || null,
          puntos_generados: puntosGenerados,
          fecha_servicio: ticketData.fechaServicio
        });
        if (insertError) {
          throw insertError;
        }
        result.synced++;
        result.details.push({
          ticket: ticketData.ticketName,
          cliente: cliente.nombre,
          monto: ticketData.monto,
          puntos: puntosGenerados,
          status: 'synced'
        });
      } catch (error) {
        result.errors++;
        result.details.push({
          ticket: ticketData.ticketName,
          status: 'error',
          error: error.message
        });
      }
    }
    return new Response(JSON.stringify(result, null, 2), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Sync error:', error);
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
