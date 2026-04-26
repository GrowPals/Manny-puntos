import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const NOTION_TOKEN = Deno.env.get('NOTION_TOKEN');
const MANNY_REWARDS_DB = '2bfc6cfd-8c1e-8026-9291-e4bc8c18ee01';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
async function notionRequest(endpoint, method = 'GET', body) {
  const response = await fetch(`https://api.notion.com/v1${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) {
    const error = await response.text();
    console.error(`Notion API error: ${error}`);
    throw new Error(`Notion API error: ${response.status}`);
  }
  return response.json();
}
async function getAllMannyRewards() {
  const all = [];
  let cursor;
  do {
    const response = await notionRequest(`/databases/${MANNY_REWARDS_DB}/query`, 'POST', {
      start_cursor: cursor,
      page_size: 100
    });
    all.push(...response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  }while (cursor)
  return all;
}
async function archivePage(pageId) {
  await notionRequest(`/pages/${pageId}`, 'PATCH', {
    archived: true
  });
}
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const { dry_run = true } = await req.json().catch(()=>({}));
    console.log('Fetching all Manny Rewards...');
    const allRewards = await getAllMannyRewards();
    console.log(`Found ${allRewards.length} total Manny Rewards`);
    // Group by Cliente relation ID
    const byCliente = new Map();
    const noCliente = [];
    for (const reward of allRewards){
      const clienteRelation = reward.properties['Cliente']?.relation;
      if (clienteRelation && clienteRelation.length > 0) {
        const clienteId = clienteRelation[0].id;
        if (!byCliente.has(clienteId)) {
          byCliente.set(clienteId, []);
        }
        byCliente.get(clienteId).push(reward);
      } else {
        noCliente.push(reward);
      }
    }
    // Find duplicates (entries with same cliente)
    const duplicatesToRemove = [];
    for (const [clienteId, rewards] of byCliente){
      if (rewards.length > 1) {
        // Sort by created_time to keep the oldest one (or by puntos to keep the one with most points)
        rewards.sort((a, b)=>{
          // Keep the one with most puntos
          const puntosA = a.properties['Puntos']?.number || 0;
          const puntosB = b.properties['Puntos']?.number || 0;
          if (puntosA !== puntosB) return puntosB - puntosA; // Higher first
          // Or the oldest
          return new Date(a.created_time).getTime() - new Date(b.created_time).getTime();
        });
        // Keep the first, mark rest as duplicates
        for(let i = 1; i < rewards.length; i++){
          duplicatesToRemove.push({
            id: rewards[i].id,
            nombre: rewards[i].properties['Nombre']?.title?.[0]?.plain_text || 'Sin nombre',
            puntos: rewards[i].properties['Puntos']?.number || 0,
            cliente_id: clienteId,
            kept: rewards[0].id
          });
        }
      }
    }
    console.log(`Found ${duplicatesToRemove.length} duplicates to remove`);
    const results = {
      total_rewards: allRewards.length,
      unique_clientes: byCliente.size,
      rewards_without_cliente: noCliente.length,
      duplicates_found: duplicatesToRemove.length,
      archived: 0,
      errors: 0,
      duplicates: duplicatesToRemove.slice(0, 20) // Show first 20
    };
    if (!dry_run) {
      for (const dup of duplicatesToRemove){
        try {
          await archivePage(dup.id);
          results.archived++;
          await new Promise((r)=>setTimeout(r, 350));
        } catch (error) {
          results.errors++;
          console.error(`Error archiving ${dup.id}:`, error);
        }
      }
    }
    return new Response(JSON.stringify({
      status: dry_run ? 'dry_run' : 'completed',
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
