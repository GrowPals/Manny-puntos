import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const NOTION_TOKEN = Deno.env.get('NOTION_TOKEN');
const CONTACTOS_DB = '17ac6cfd-8c1e-8068-8bc0-d32488189164';
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
async function getAllContactos() {
  const all = [];
  let cursor;
  do {
    const response = await notionRequest(`/databases/${CONTACTOS_DB}/query`, 'POST', {
      start_cursor: cursor,
      page_size: 100
    });
    all.push(...response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  }while (cursor)
  return all;
}
async function getAllMannyRewards() {
  const map = new Map();
  let cursor;
  do {
    const response = await notionRequest(`/databases/${MANNY_REWARDS_DB}/query`, 'POST', {
      start_cursor: cursor,
      page_size: 100
    });
    for (const page of response.results){
      // Get the Cliente relation ID
      const clienteRelation = page.properties['Cliente']?.relation;
      if (clienteRelation && clienteRelation.length > 0) {
        map.set(clienteRelation[0].id, page);
      }
    }
    cursor = response.has_more ? response.next_cursor : undefined;
  }while (cursor)
  return map;
}
function getContactName(properties) {
  const titleField = properties[''] || properties['title'] || properties['Name'] || properties['Nombre'];
  if (!titleField?.title?.length) return 'Sin nombre';
  return titleField.title.map((t)=>t.plain_text).join('');
}
function getContactPhone(properties) {
  return properties['Teléfono']?.phone_number || null;
}
async function createMannyReward(contactoId, nombre) {
  return notionRequest('/pages', 'POST', {
    parent: {
      database_id: MANNY_REWARDS_DB
    },
    properties: {
      'Nombre': {
        title: [
          {
            text: {
              content: nombre
            }
          }
        ]
      },
      'Cliente': {
        relation: [
          {
            id: contactoId
          }
        ]
      },
      'Puntos': {
        number: 0
      },
      'Nivel': {
        select: {
          name: 'Partner'
        }
      },
      'Fecha': {
        date: {
          start: new Date().toISOString().split('T')[0]
        }
      }
    }
  });
}
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const { dry_run = false, limit } = await req.json().catch(()=>({}));
    console.log('Fetching all contactos...');
    const contactos = await getAllContactos();
    console.log(`Found ${contactos.length} contactos`);
    console.log('Fetching existing Manny Rewards...');
    const existingRewards = await getAllMannyRewards();
    console.log(`Found ${existingRewards.size} existing Manny Rewards`);
    // Filter contactos that don't have a Manny Reward yet
    const contactosSinReward = contactos.filter((c)=>!existingRewards.has(c.id));
    console.log(`Found ${contactosSinReward.length} contactos without Manny Reward`);
    const toProcess = limit ? contactosSinReward.slice(0, limit) : contactosSinReward;
    const results = {
      total_contactos: contactos.length,
      existing_rewards: existingRewards.size,
      missing: contactosSinReward.length,
      processed: 0,
      created: 0,
      errors: 0,
      details: []
    };
    for (const contacto of toProcess){
      const nombre = getContactName(contacto.properties);
      const telefono = getContactPhone(contacto.properties);
      results.processed++;
      if (dry_run) {
        results.details.push({
          contacto_id: contacto.id,
          nombre,
          telefono,
          action: 'would_create'
        });
        results.created++;
      } else {
        try {
          await createMannyReward(contacto.id, nombre);
          results.created++;
          results.details.push({
            contacto_id: contacto.id,
            nombre,
            telefono,
            action: 'created'
          });
          // Small delay to avoid rate limiting
          await new Promise((r)=>setTimeout(r, 350));
        } catch (error) {
          results.errors++;
          results.details.push({
            contacto_id: contacto.id,
            nombre,
            error: error.message
          });
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
