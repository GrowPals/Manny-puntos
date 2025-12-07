import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MANNY_REWARDS_DB = '2bfc6cfd-8c1e-8026-9291-e4bc8c18ee01';

interface NotionPage {
  id: string;
  properties: {
    [key: string]: any;
  };
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
    console.error(`Notion API error: ${error}`);
    throw new Error(`Notion API error: ${error}`);
  }

  return response.json();
}

function extractPhoneNumber(properties: any): string | null {
  const phoneField = properties['Teléfono'];
  if (!phoneField || !phoneField.phone_number) return null;

  let phone = phoneField.phone_number.replace(/\D/g, '');

  if (phone.startsWith('52') && phone.length > 10) {
    phone = phone.slice(2);
  }
  if (phone.startsWith('1') && phone.length > 10) {
    phone = phone.slice(1);
  }

  return phone.length >= 10 ? phone : null;
}

function extractName(properties: any): string {
  const titleField = properties[''] || properties['title'] || properties['Name'] || properties['Nombre'];
  if (!titleField) return 'Sin nombre';

  if (titleField.title && titleField.title.length > 0) {
    return titleField.title.map((t: any) => t.plain_text).join('');
  }
  return 'Sin nombre';
}

function extractEmail(properties: any): string | null {
  const emailField = properties['E-mail'];
  return emailField?.email || null;
}

async function getPageFromNotion(pageId: string, notionToken: string): Promise<NotionPage | null> {
  const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    headers: {
      'Authorization': `Bearer ${notionToken}`,
      'Notion-Version': '2022-06-28',
    },
  });

  if (!response.ok) {
    console.error('Failed to fetch page from Notion:', await response.text());
    return null;
  }

  return await response.json();
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

async function createMannyReward(contactoId: string, nombre: string, notionToken: string): Promise<string> {
  const result = await notionRequest('/pages', 'POST', {
    parent: { database_id: MANNY_REWARDS_DB },
    properties: {
      'Nombre': { title: [{ text: { content: nombre } }] },
      'Cliente': { relation: [{ id: contactoId }] },
      'Nivel': { select: { name: 'Partner' } },
      'Puntos': { number: 0 }
    }
  }, notionToken);

  console.log(`Created Manny Reward: ${result.id} for ${nombre}`);
  return result.id;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const notionToken = Deno.env.get('NOTION_TOKEN');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log('Webhook received:', JSON.stringify(payload, null, 2));

    // Notion webhook verification
    if (payload.challenge) {
      return new Response(JSON.stringify({ challenge: payload.challenge }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extraer página de diferentes estructuras de payload
    let page: NotionPage | null = null;
    let notionPageId: string | null = null;

    if (payload.data?.properties) {
      page = payload.data;
      notionPageId = page.id;
    } else if (payload.properties) {
      page = payload;
      notionPageId = page.id;
    } else {
      notionPageId = payload.data?.id || payload.id || payload.page_id || payload.page?.id;

      if (notionPageId && notionToken) {
        console.log('Fetching page from Notion API...');
        page = await getPageFromNotion(notionPageId, notionToken);
        if (!page) {
          return new Response(JSON.stringify({
            status: 'error',
            reason: 'failed to fetch page from Notion'
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else {
        return new Response(JSON.stringify({
          status: 'error',
          reason: 'no page data and no NOTION_TOKEN'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const properties = page!.properties;

    if (!properties) {
      console.log('No properties found in payload');
      return new Response(JSON.stringify({ status: 'skipped', reason: 'no properties' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const telefono = extractPhoneNumber(properties);
    const nombre = extractName(properties);
    const email = extractEmail(properties);

    if (!telefono) {
      console.log('No valid phone number found');
      return new Response(JSON.stringify({ status: 'skipped', reason: 'no phone' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing contact: ${nombre} (${telefono})`);

    // Verificar si ya existe por teléfono
    const { data: existing } = await supabase
      .from('clientes')
      .select('id, notion_page_id')
      .eq('telefono', telefono)
      .single();

    let clienteId: string;

    if (existing) {
      clienteId = existing.id;

      // Si existe pero no tiene notion_page_id, actualizarlo
      if (!existing.notion_page_id) {
        const { error: updateError } = await supabase
          .from('clientes')
          .update({
            notion_page_id: notionPageId,
            last_sync_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (updateError) throw updateError;
        console.log(`Linked existing client ${existing.id} to Notion page ${notionPageId}`);
      } else {
        console.log(`Client already exists and linked: ${existing.id}`);
      }
    } else {
      // Crear nuevo cliente con nivel 'partner' por defecto
      const { data: newClient, error: insertError } = await supabase
        .from('clientes')
        .insert({
          nombre: nombre.trim(),
          telefono: telefono,
          puntos_actuales: 0,
          nivel: 'partner',
          es_admin: false,
          notion_page_id: notionPageId,
          last_sync_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) throw insertError;
      clienteId = newClient.id;
      console.log(`Created new client: ${newClient.id}`);
    }

    // CREAR MANNY REWARD SI NO EXISTE
    let mannyRewardId: string | null = null;
    if (notionToken && notionPageId) {
      // Verificar si ya existe Manny Reward para este contacto
      mannyRewardId = await findMannyRewardByContacto(notionPageId, notionToken);

      if (!mannyRewardId) {
        // Crear nuevo Manny Reward
        mannyRewardId = await createMannyReward(notionPageId, nombre.trim(), notionToken);
        console.log(`Created Manny Reward: ${mannyRewardId}`);
      } else {
        console.log(`Manny Reward already exists: ${mannyRewardId}`);
      }
    }

    return new Response(JSON.stringify({
      status: existing ? (existing.notion_page_id ? 'exists' : 'linked') : 'created',
      cliente_id: clienteId,
      nombre: nombre.trim(),
      telefono: telefono,
      nivel: 'partner',
      manny_reward_id: mannyRewardId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
