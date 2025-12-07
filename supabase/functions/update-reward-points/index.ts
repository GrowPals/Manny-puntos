import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MANNY_REWARDS_DB = '2bfc6cfd-8c1e-8026-9291-e4bc8c18ee01';

interface NotionPage {
  id: string;
  properties: Record<string, any>;
}

async function notionRequest(endpoint: string, method: string, body: any, token: string) {
  const response = await fetch(`https://api.notion.com/v1${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Notion API error: ${error}`);
  }

  return response.json();
}

async function getTicketDetails(ticketId: string, notionToken: string): Promise<NotionPage> {
  return await notionRequest(`/pages/${ticketId}`, 'GET', null, notionToken);
}

async function getRewardByRelation(ticketId: string, notionToken: string): Promise<string | null> {
  // Get the ticket to find its Rewards relation
  const ticket = await getTicketDetails(ticketId, notionToken);
  const rewardsRelation = ticket.properties['Rewards']?.relation;

  if (rewardsRelation && rewardsRelation.length > 0) {
    return rewardsRelation[0].id;
  }

  // If no direct Rewards relation, try to find via Contacto
  const contactoRelation = ticket.properties['Contacto']?.relation;
  if (!contactoRelation || contactoRelation.length === 0) {
    return null;
  }

  const contactoId = contactoRelation[0].id;

  // Find the Manny Reward linked to this Contacto
  const searchResult = await notionRequest('/databases/' + MANNY_REWARDS_DB + '/query', 'POST', {
    filter: {
      property: 'Cliente',
      relation: {
        contains: contactoId
      }
    },
    page_size: 1
  }, notionToken);

  if (searchResult.results && searchResult.results.length > 0) {
    return searchResult.results[0].id;
  }

  return null;
}

async function calculateTotalPoints(rewardId: string, notionToken: string): Promise<number> {
  // Get the Manny Reward page to read the Monto Total rollup
  const reward = await notionRequest(`/pages/${rewardId}`, 'GET', null, notionToken);

  // Monto Total is a rollup that sums all linked ticket amounts
  const montoTotal = reward.properties['Monto Total']?.rollup?.number || 0;

  // Calculate points: 5% del monto total
  const puntos = Math.round(montoTotal * 0.05);

  return puntos;
}

async function updateRewardPoints(rewardId: string, puntos: number, notionToken: string) {
  await notionRequest(`/pages/${rewardId}`, 'PATCH', {
    properties: {
      'Puntos': {
        number: puntos
      }
    }
  }, notionToken);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const notionToken = Deno.env.get('NOTION_TOKEN');
    if (!notionToken) {
      throw new Error('NOTION_TOKEN not configured');
    }

    const payload = await req.json();
    console.log('Received payload:', JSON.stringify(payload, null, 2));

    // Handle Notion automation payload
    // Notion Automations send: { data: { id: "page-id" } } or { page_id: "..." }
    let ticketId = payload.data?.id || payload.page_id || payload.id || payload.ticket_id;

    // Also accept reward_id directly for manual updates
    let rewardId = payload.reward_id;

    if (!ticketId && !rewardId) {
      return new Response(JSON.stringify({
        error: 'Missing ticket_id or reward_id'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If we have a ticket ID, find the associated reward
    if (ticketId && !rewardId) {
      console.log(`Finding reward for ticket: ${ticketId}`);
      rewardId = await getRewardByRelation(ticketId, notionToken);

      if (!rewardId) {
        console.log('No reward found for this ticket');
        return new Response(JSON.stringify({
          status: 'skipped',
          reason: 'No Manny Reward associated with this ticket'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    console.log(`Calculating points for reward: ${rewardId}`);

    // Calculate total points from all linked tickets
    const puntos = await calculateTotalPoints(rewardId, notionToken);

    console.log(`Calculated points: ${puntos}`);

    // Update the Puntos field
    await updateRewardPoints(rewardId, puntos, notionToken);

    console.log(`Updated reward ${rewardId} with ${puntos} points`);

    return new Response(JSON.stringify({
      status: 'success',
      reward_id: rewardId,
      puntos: puntos,
      ticket_id: ticketId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
