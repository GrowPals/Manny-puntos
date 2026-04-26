import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const TICKETS_DB = '17ac6cfd-8c1e-8162-b724-d4047a7e7635';
const MANNY_REWARDS_DB = '2bfc6cfd-8c1e-8026-9291-e4bc8c18ee01';
async function notionRequest(path, method, body, token) {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Notion API error: ${response.status} - ${text}`);
  }
  return response.json();
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
    const limit = body.limit || 20;
    // 1. Buscar tickets sin Rewards vinculado pero CON Contacto
    console.log('Buscando tickets sin Rewards...');
    const ticketsResponse = await notionRequest(`/databases/${TICKETS_DB}/query`, 'POST', {
      page_size: limit,
      filter: {
        and: [
          {
            property: 'Rewards',
            relation: {
              is_empty: true
            }
          },
          {
            property: 'Contacto',
            relation: {
              is_not_empty: true
            }
          }
        ]
      }
    }, notionToken);
    const tickets = ticketsResponse.results;
    console.log(`Encontrados ${tickets.length} tickets sin Rewards`);
    // 2. Obtener todos los Manny Rewards con su Cliente
    console.log('Obteniendo Manny Rewards...');
    const rewardsMap = new Map(); // clienteId -> rewardId
    let hasMore = true;
    let startCursor;
    while(hasMore){
      const rewardsBody = {
        page_size: 100
      };
      if (startCursor) rewardsBody.start_cursor = startCursor;
      const rewardsResponse = await notionRequest(`/databases/${MANNY_REWARDS_DB}/query`, 'POST', rewardsBody, notionToken);
      for (const reward of rewardsResponse.results){
        const clienteRelation = reward.properties['Cliente']?.relation;
        if (clienteRelation && clienteRelation.length > 0) {
          rewardsMap.set(clienteRelation[0].id, reward.id);
        }
      }
      hasMore = rewardsResponse.has_more;
      startCursor = rewardsResponse.next_cursor;
    }
    console.log(`Mapeados ${rewardsMap.size} Manny Rewards`);
    // 3. Vincular cada ticket a su Manny Reward correspondiente
    const results = {
      total_tickets: tickets.length,
      linked: 0,
      no_reward_found: 0,
      errors: 0,
      details: []
    };
    for (const ticket of tickets){
      const ticketTitle = ticket.properties['Ticket ']?.title?.map((t)=>t.plain_text).join('') || 'Sin título';
      const contactoRelation = ticket.properties['Contacto']?.relation;
      if (!contactoRelation || contactoRelation.length === 0) {
        results.no_reward_found++;
        results.details.push({
          ticket: ticketTitle,
          status: 'no_contacto'
        });
        continue;
      }
      const contactoId = contactoRelation[0].id;
      const rewardId = rewardsMap.get(contactoId);
      if (!rewardId) {
        results.no_reward_found++;
        results.details.push({
          ticket: ticketTitle,
          status: 'no_reward_for_contacto',
          contacto_id: contactoId
        });
        continue;
      }
      if (dryRun) {
        results.linked++;
        results.details.push({
          ticket: ticketTitle,
          status: 'would_link',
          reward_id: rewardId
        });
        continue;
      }
      try {
        await notionRequest(`/pages/${ticket.id}`, 'PATCH', {
          properties: {
            'Rewards': {
              relation: [
                {
                  id: rewardId
                }
              ]
            }
          }
        }, notionToken);
        results.linked++;
        results.details.push({
          ticket: ticketTitle,
          status: 'linked',
          reward_id: rewardId
        });
        // Rate limiting
        await new Promise((resolve)=>setTimeout(resolve, 350));
      } catch (e) {
        results.errors++;
        results.details.push({
          ticket: ticketTitle,
          status: 'error',
          error: e.message
        });
      }
    }
    return new Response(JSON.stringify({
      status: dryRun ? 'dry_run' : 'completed',
      rewards_mapped: rewardsMap.size,
      ...results
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error:', error);
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
