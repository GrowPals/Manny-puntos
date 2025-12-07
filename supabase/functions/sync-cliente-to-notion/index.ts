import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CONTACTOS_DB = '17ac6cfd-8c1e-8068-8bc0-d32488189164';
const MANNY_REWARDS_DB = '2bfc6cfd-8c1e-8026-9291-e4bc8c18ee01';

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
    console.error(`Notion API error: ${error}`);
    throw new Error(`Notion API error: ${error}`);
  }

  return response.json();
}

async function findContactoByPhone(telefono: string, notionToken: string): Promise<string | null> {
  // Try exact match
  const result = await notionRequest(`/databases/${CONTACTOS_DB}/query`, 'POST', {
    filter: {
      property: 'Teléfono',
      phone_number: { equals: telefono }
    },
    page_size: 1
  }, notionToken);

  if (result.results && result.results.length > 0) {
    return result.results[0].id;
  }

  // Try with +52 prefix
  const result2 = await notionRequest(`/databases/${CONTACTOS_DB}/query`, 'POST', {
    filter: {
      property: 'Teléfono',
      phone_number: { equals: `+52${telefono}` }
    },
    page_size: 1
  }, notionToken);

  if (result2.results && result2.results.length > 0) {
    return result2.results[0].id;
  }

  return null;
}

async function createContactoInNotion(nombre: string, telefono: string, notionToken: string): Promise<string> {
  const result = await notionRequest('/pages', 'POST', {
    parent: { database_id: CONTACTOS_DB },
    properties: {
      // El campo título en Contactos puede tener diferentes nombres
      '': { title: [{ text: { content: nombre } }] },
      'Teléfono': { phone_number: `+52${telefono}` }
    }
  }, notionToken);

  console.log(`Created Contacto in Notion: ${result.id}`);
  return result.id;
}

async function findMannyRewardByContacto(contactoId: string, notionToken: string): Promise<string | null> {
  const result = await notionRequest(`/databases/${MANNY_REWARDS_DB}/query`, 'POST', {
    filter: {
      property: 'Cliente',
      relation: { contains: contactoId }
    },
    page_size: 1
  }, notionToken);

  if (result.results && result.results.length > 0) {
    return result.results[0].id;
  }
  return null;
}

async function createMannyReward(contactoId: string, nombre: string, supabaseId: string, notionToken: string): Promise<string> {
  const result = await notionRequest('/pages', 'POST', {
    parent: { database_id: MANNY_REWARDS_DB },
    properties: {
      'Nombre': { title: [{ text: { content: nombre } }] },
      'Cliente': { relation: [{ id: contactoId }] },
      'Nivel': { select: { name: 'Partner' } },
      'Puntos': { number: 0 },
      'Supabase ID': { rich_text: [{ text: { content: supabaseId } }] }
    }
  }, notionToken);

  console.log(`Created Manny Reward: ${result.id} for ${nombre}`);
  return result.id;
}

async function updateMannyRewardSupabaseId(rewardId: string, supabaseId: string, notionToken: string) {
  await notionRequest(`/pages/${rewardId}`, 'PATCH', {
    properties: {
      'Supabase ID': { rich_text: [{ text: { content: supabaseId } }] }
    }
  }, notionToken);
  console.log(`Updated Manny Reward ${rewardId} with Supabase ID ${supabaseId}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const notionToken = Deno.env.get('NOTION_TOKEN');

    if (!notionToken) {
      throw new Error('NOTION_TOKEN not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const payload = await req.json();

    console.log('Sync cliente to Notion payload:', JSON.stringify(payload, null, 2));

    const { cliente_id, telefono, nombre } = payload;

    if (!cliente_id && !telefono) {
      return new Response(JSON.stringify({ error: 'Missing cliente_id or telefono' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get cliente from Supabase
    let cliente;
    if (cliente_id) {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', cliente_id)
        .single();

      if (error || !data) {
        throw new Error(`Cliente not found: ${cliente_id}`);
      }
      cliente = data;
    } else {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('telefono', telefono)
        .single();

      if (error || !data) {
        throw new Error(`Cliente not found with telefono: ${telefono}`);
      }
      cliente = data;
    }

    let contactoId = cliente.notion_page_id;
    let mannyRewardId = cliente.notion_reward_id;
    let created = { contacto: false, reward: false };

    // Step 1: Find or create Contacto in Notion
    if (!contactoId) {
      contactoId = await findContactoByPhone(cliente.telefono, notionToken);

      if (!contactoId) {
        // Create new Contacto
        contactoId = await createContactoInNotion(
          cliente.nombre || nombre || 'Nuevo Cliente',
          cliente.telefono,
          notionToken
        );
        created.contacto = true;
      }

      // Update Supabase with notion_page_id
      await supabase
        .from('clientes')
        .update({ notion_page_id: contactoId })
        .eq('id', cliente.id);
    }

    // Step 2: Find or create Manny Reward
    if (!mannyRewardId) {
      mannyRewardId = await findMannyRewardByContacto(contactoId, notionToken);
    }

    if (!mannyRewardId) {
      // Create new Manny Reward
      mannyRewardId = await createMannyReward(
        contactoId,
        cliente.nombre || nombre || 'Nuevo Cliente',
        cliente.id,
        notionToken
      );
      created.reward = true;

      // Update Supabase with notion_reward_id
      await supabase
        .from('clientes')
        .update({ notion_reward_id: mannyRewardId })
        .eq('id', cliente.id);
    } else {
      // Ensure Supabase ID is set in Manny Reward
      await updateMannyRewardSupabaseId(mannyRewardId, cliente.id, notionToken);
    }

    return new Response(JSON.stringify({
      status: 'success',
      cliente_id: cliente.id,
      contacto_id: contactoId,
      manny_reward_id: mannyRewardId,
      created
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
