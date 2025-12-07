import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MANNY_REWARDS_DB = '2bfc6cfd-8c1e-8026-9291-e4bc8c18ee01';
const CONTACTOS_DB = '17ac6cfd-8c1e-8068-8bc0-d32488189164';

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
    console.error(`Notion API error: ${error}`);
    throw new Error(`Notion API error: ${error}`);
  }

  return response.json();
}

function extractMonto(properties: any): number {
  const montoField = properties['Monto'];
  if (!montoField) return 0;
  if (montoField.number !== undefined) return montoField.number;
  if (montoField.formula?.number !== undefined) return montoField.formula.number;
  if (montoField.rollup?.number !== undefined) return montoField.rollup.number;
  return 0;
}

function extractContactoId(properties: any): string | null {
  const contactoField = properties['Contacto'];
  if (!contactoField?.relation || contactoField.relation.length === 0) return null;
  return contactoField.relation[0].id;
}

function extractRewardsId(properties: any): string | null {
  const rewardsField = properties['Rewards'];
  if (!rewardsField?.relation || rewardsField.relation.length === 0) return null;
  return rewardsField.relation[0].id;
}

function extractTicketName(properties: any): string {
  const titleField = properties['Ticket '] || properties['Ticket'] || properties['title'];
  if (!titleField?.title) return 'Ticket';
  return titleField.title.map((t: any) => t.plain_text).join('') || 'Ticket';
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

async function getContactoDetails(contactoId: string, notionToken: string): Promise<{ nombre: string; telefono: string | null; email: string | null; supabaseId: string | null }> {
  const page = await notionRequest(`/pages/${contactoId}`, 'GET', null, notionToken);

  // Extraer nombre
  const titleField = page.properties[''] || page.properties['title'] || page.properties['Name'] || page.properties['Nombre'];
  let nombre = 'Sin nombre';
  if (titleField?.title && titleField.title.length > 0) {
    nombre = titleField.title.map((t: any) => t.plain_text).join('');
  }

  // Extraer teléfono
  const phoneField = page.properties['Teléfono'];
  let telefono = null;
  if (phoneField?.phone_number) {
    telefono = phoneField.phone_number.replace(/\D/g, '');
    if (telefono.startsWith('52') && telefono.length > 10) telefono = telefono.slice(2);
    if (telefono.startsWith('1') && telefono.length > 10) telefono = telefono.slice(1);
    if (telefono.length < 10) telefono = null;
  }

  // Extraer email
  const emailField = page.properties['E-mail'];
  const email = emailField?.email || null;

  // Extraer Supabase ID si existe
  const supabaseIdField = page.properties['Supabase ID'];
  let supabaseId = null;
  if (supabaseIdField?.rich_text?.[0]?.plain_text) {
    supabaseId = supabaseIdField.rich_text[0].plain_text;
  }

  return { nombre, telefono, email, supabaseId };
}

async function updateContactoSupabaseId(contactoId: string, supabaseId: string, notionToken: string) {
  await notionRequest(`/pages/${contactoId}`, 'PATCH', {
    properties: {
      'Supabase ID': { rich_text: [{ text: { content: supabaseId } }] }
    }
  }, notionToken);
  console.log(`Updated Contacto ${contactoId} with Supabase ID ${supabaseId}`);
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

async function linkTicketToReward(ticketId: string, rewardId: string, notionToken: string) {
  await notionRequest(`/pages/${ticketId}`, 'PATCH', {
    properties: {
      'Rewards': { relation: [{ id: rewardId }] }
    }
  }, notionToken);
  console.log(`Linked ticket ${ticketId} to reward ${rewardId}`);
}

async function updateRewardPoints(rewardId: string, notionToken: string): Promise<number> {
  // Get the reward to read Monto Total rollup
  const reward = await notionRequest(`/pages/${rewardId}`, 'GET', null, notionToken);
  const montoTotal = reward.properties['Monto Total']?.rollup?.number || 0;
  // 5% del monto total = puntos
  const puntos = Math.round(montoTotal * 0.05);

  // Update Puntos
  await notionRequest(`/pages/${rewardId}`, 'PATCH', {
    properties: {
      'Puntos': { number: puntos }
    }
  }, notionToken);

  console.log(`Updated reward ${rewardId}: Monto Total = ${montoTotal}, Puntos (5%) = ${puntos}`);
  return puntos;
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

    console.log('Ticket completed webhook:', JSON.stringify(payload, null, 2));

    // Handle Notion challenge
    if (payload.challenge) {
      return new Response(JSON.stringify({ challenge: payload.challenge }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract ticket page ID
    const ticketId = payload.data?.id || payload.id || payload.page_id;
    if (!ticketId) {
      return new Response(JSON.stringify({ error: 'No ticket ID found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get ticket details
    const ticket = await notionRequest(`/pages/${ticketId}`, 'GET', null, notionToken);
    const properties = ticket.properties;
    const ticketName = extractTicketName(properties);
    const monto = extractMonto(properties);
    const contactoId = extractContactoId(properties);

    console.log(`Ticket: ${ticketName}, Monto: ${monto}, Contacto: ${contactoId}`);

    if (!contactoId) {
      return new Response(JSON.stringify({
        status: 'skipped',
        reason: 'No contacto linked to ticket'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if already processed (idempotency)
    const { data: existingEvent } = await supabase
      .from('ticket_events')
      .select('id')
      .eq('source', 'notion')
      .eq('source_id', ticketId)
      .eq('event_type', 'ticket_completed')
      .single();

    if (existingEvent) {
      console.log('Ticket already processed');
      return new Response(JSON.stringify({ status: 'skipped', reason: 'already processed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find or create Manny Reward
    let rewardId = extractRewardsId(properties);

    if (!rewardId) {
      // Try to find existing reward by contacto
      rewardId = await findMannyRewardByContacto(contactoId, notionToken);

      if (!rewardId) {
        // Create new Manny Reward
        const { nombre } = await getContactoDetails(contactoId, notionToken);
        rewardId = await createMannyReward(contactoId, nombre, notionToken);
      }

      // Link ticket to reward
      await linkTicketToReward(ticketId, rewardId, notionToken);
    }

    // Small delay to let Notion update the rollup
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Update points based on new Monto Total
    const puntos = await updateRewardPoints(rewardId, notionToken);

    // Record event to prevent duplicates
    await supabase.from('ticket_events').insert({
      source: 'notion',
      source_id: ticketId,
      event_type: 'ticket_completed',
      payload: {
        ticket_name: ticketName,
        monto,
        contacto_id: contactoId,
        reward_id: rewardId,
        puntos
      },
      status: 'processed'
    });

    // Get contact details and find/create Supabase client
    const { nombre, telefono, email, supabaseId } = await getContactoDetails(contactoId, notionToken);

    let clienteId: string | null = null;
    let clienteCreated = false;

    if (telefono) {
      // Try to find client by Supabase ID first, then by phone
      let cliente;

      if (supabaseId) {
        const { data } = await supabase
          .from('clientes')
          .select('id, puntos_actuales, notion_page_id')
          .eq('id', supabaseId)
          .single();
        cliente = data;
      }

      if (!cliente) {
        const { data } = await supabase
          .from('clientes')
          .select('id, puntos_actuales, notion_page_id')
          .eq('telefono', telefono)
          .single();
        cliente = data;
      }

      if (!cliente) {
        // Create new client in Supabase
        const { data: newCliente, error: insertError } = await supabase
          .from('clientes')
          .insert({
            nombre: nombre,
            telefono: telefono,
            puntos_actuales: 0,
            nivel: 'partner',
            es_admin: false,
            notion_page_id: contactoId,
            notion_reward_id: rewardId,
            last_sync_at: new Date().toISOString()
          })
          .select()
          .single();

        if (!insertError && newCliente) {
          cliente = newCliente;
          clienteCreated = true;
          console.log(`Created new client in Supabase: ${newCliente.id}`);

          // Update Notion Contacto with Supabase ID
          await updateContactoSupabaseId(contactoId, newCliente.id, notionToken);
        }
      } else {
        // Update existing client with Notion references if missing
        const updates: any = { last_sync_at: new Date().toISOString() };
        if (!cliente.notion_page_id) updates.notion_page_id = contactoId;

        await supabase
          .from('clientes')
          .update(updates)
          .eq('id', cliente.id);

        // Update Notion Contacto with Supabase ID if not set
        if (!supabaseId) {
          await updateContactoSupabaseId(contactoId, cliente.id, notionToken);
        }
      }

      if (cliente) {
        clienteId = cliente.id;

        // Calculate points for this ticket only (for Supabase) - 5% del monto
        const puntosTicket = Math.round(monto * 0.05);

        if (puntosTicket > 0) {
          await supabase.rpc('asignar_puntos_atomico', {
            p_cliente_telefono: telefono,
            p_puntos_a_sumar: puntosTicket,
            p_concepto: `Ticket completado: ${ticketName} - $${monto} (5%)`
          });

          // Send push notification
          try {
            await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                tipo: 'puntos_recibidos',
                cliente_id: cliente.id,
                data: { puntos: puntosTicket, concepto: ticketName },
                url: '/dashboard'
              }),
            });
          } catch (e) {
            console.warn('Push notification failed:', e);
          }
        }
      }
    }

    return new Response(JSON.stringify({
      status: 'success',
      ticket_id: ticketId,
      ticket_name: ticketName,
      monto,
      reward_id: rewardId,
      puntos_totales: puntos,
      cliente_id: clienteId,
      cliente_created: clienteCreated,
      contacto_id: contactoId
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
