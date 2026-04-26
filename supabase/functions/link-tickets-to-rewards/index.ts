import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const TICKETS_MANNY_DATABASE_ID = '17ac6cfd-8c1e-8162-b724-d4047a7e7635';
const MANNY_REWARDS_DATABASE_ID = '2bfc6cfd-8c1e-8026-9291-e4bc8c18ee01';
async function getAllMannyRewards(notionToken) {
  const records = [];
  let hasMore = true;
  let startCursor;
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
      console.error('Failed to query Manny Rewards:', await response.text());
      break;
    }
    const data = await response.json();
    for (const page of data.results){
      const clienteRelation = page.properties['Cliente']?.relation;
      const nombre = page.properties['Nombre']?.title?.map((t)=>t.plain_text).join('') || '';
      records.push({
        id: page.id,
        nombre,
        clienteNotionId: clienteRelation?.[0]?.id || null
      });
    }
    hasMore = data.has_more;
    startCursor = data.next_cursor;
  }
  return records;
}
async function getTicketsForContacto(contactoId, notionToken) {
  const tickets = [];
  let hasMore = true;
  let startCursor;
  while(hasMore){
    const body = {
      page_size: 100,
      filter: {
        property: 'Contacto',
        relation: {
          contains: contactoId
        }
      }
    };
    if (startCursor) body.start_cursor = startCursor;
    const response = await fetch(`https://api.notion.com/v1/databases/${TICKETS_MANNY_DATABASE_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      console.error('Failed to query tickets:', await response.text());
      break;
    }
    const data = await response.json();
    for (const page of data.results){
      const titulo = page.properties['Ticket ']?.title?.map((t)=>t.plain_text).join('') || '';
      const monto = page.properties['Monto']?.number || null;
      const rewardsRelation = page.properties['Rewards']?.relation?.map((r)=>r.id) || [];
      tickets.push({
        id: page.id,
        titulo,
        contactoNotionId: contactoId,
        monto,
        rewardsRelation
      });
    }
    hasMore = data.has_more;
    startCursor = data.next_cursor;
  }
  return tickets;
}
async function updateTicketRewards(ticketId, rewardsId, notionToken) {
  const response = await fetch(`https://api.notion.com/v1/pages/${ticketId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${notionToken}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        'Rewards': {
          relation: [
            {
              id: rewardsId
            }
          ]
        }
      }
    })
  });
  if (!response.ok) {
    console.error('Failed to update ticket:', await response.text());
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
    const body = await req.json().catch(()=>({}));
    const dryRun = body.dry_run === true;
    const limit = body.limit || 100;
    console.log('Fetching Manny Rewards records...');
    const rewardsRecords = await getAllMannyRewards(notionToken);
    console.log(`Found ${rewardsRecords.length} Manny Rewards records`);
    const results = {
      total_rewards: rewardsRecords.length,
      processed: 0,
      tickets_linked: 0,
      already_linked: 0,
      no_tickets: 0,
      errors: 0,
      details: []
    };
    let processed = 0;
    for (const reward of rewardsRecords){
      if (processed >= limit) break;
      if (!reward.clienteNotionId) {
        results.details.push({
          reward: reward.nombre,
          action: 'skipped',
          reason: 'no cliente relation'
        });
        continue;
      }
      // Buscar tickets de este cliente
      const tickets = await getTicketsForContacto(reward.clienteNotionId, notionToken);
      if (tickets.length === 0) {
        results.no_tickets++;
        results.details.push({
          reward: reward.nombre,
          action: 'no_tickets',
          cliente_id: reward.clienteNotionId
        });
        processed++;
        continue;
      }
      let linkedCount = 0;
      let alreadyLinkedCount = 0;
      for (const ticket of tickets){
        // Verificar si ya está vinculado
        if (ticket.rewardsRelation.includes(reward.id)) {
          alreadyLinkedCount++;
          continue;
        }
        if (dryRun) {
          linkedCount++;
          continue;
        }
        // Vincular el ticket al rewards
        const success = await updateTicketRewards(ticket.id, reward.id, notionToken);
        if (success) {
          linkedCount++;
        } else {
          results.errors++;
        }
        // Rate limiting
        await new Promise((resolve)=>setTimeout(resolve, 350));
      }
      results.tickets_linked += linkedCount;
      results.already_linked += alreadyLinkedCount;
      results.processed++;
      results.details.push({
        reward: reward.nombre,
        total_tickets: tickets.length,
        linked: linkedCount,
        already_linked: alreadyLinkedCount
      });
      processed++;
      // Rate limiting entre clientes
      await new Promise((resolve)=>setTimeout(resolve, 200));
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
    console.error('Error linking tickets:', error);
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
