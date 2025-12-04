import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MANNY_REWARDS_DATABASE_ID = '2bfc6cfd-8c1e-8026-9291-e4bc8c18ee01';

interface NotionPage {
  id: string;
  properties: {
    [key: string]: any;
  };
}

function extractMonto(properties: any): number | null {
  const montoField = properties['Monto'];
  if (!montoField) return null;

  if (montoField.number !== undefined) return montoField.number;
  if (montoField.formula?.number !== undefined) return montoField.formula.number;
  if (montoField.rollup?.number !== undefined) return montoField.rollup.number;

  return null;
}

function extractStatus(properties: any): string | null {
  const statusField = properties['Status'];
  if (!statusField) return null;

  if (statusField.status?.name) return statusField.status.name;
  if (statusField.select?.name) return statusField.select.name;

  return null;
}

function extractContactoRelation(properties: any): string | null {
  const contactoField = properties['Contacto'];
  if (!contactoField || !contactoField.relation || contactoField.relation.length === 0) {
    return null;
  }
  return contactoField.relation[0].id;
}

function extractTicketId(properties: any): string | null {
  const titleField = properties['Ticket '] || properties['Ticket'] || properties['title'];
  if (!titleField || !titleField.title) return null;

  return titleField.title.map((t: any) => t.plain_text).join('');
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

async function getContactPhoneFromNotion(contactPageId: string, notionToken: string): Promise<string | null> {
  const page = await getPageFromNotion(contactPageId, notionToken);
  if (!page) return null;

  const phoneField = page.properties['Teléfono'];

  if (!phoneField || !phoneField.phone_number) return null;

  let phone = phoneField.phone_number.replace(/\D/g, '');
  if (phone.startsWith('52') && phone.length > 10) phone = phone.slice(2);
  if (phone.startsWith('1') && phone.length > 10) phone = phone.slice(1);

  return phone.length >= 10 ? phone : null;
}

async function createMannyRewardsEntry(
  clienteNotionId: string,
  ticketNotionId: string,
  ticketName: string,
  monto: number,
  puntosGanados: number,
  historialId: string,
  notionToken: string
): Promise<string | null> {
  const today = new Date().toISOString().split('T')[0];

  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${notionToken}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      parent: { database_id: MANNY_REWARDS_DATABASE_ID },
      properties: {
        'Registro': {
          title: [{ text: { content: `Puntos por ${ticketName || 'Ticket'}` } }]
        },
        'Tipo': {
          select: { name: 'Puntos Ganados' }
        },
        'Cliente': {
          relation: [{ id: clienteNotionId }]
        },
        'Ticket': {
          relation: [{ id: ticketNotionId }]
        },
        'Puntos': {
          number: puntosGanados
        },
        'Monto Ticket': {
          number: monto
        },
        'Fecha': {
          date: { start: today }
        },
        'Supabase ID': {
          rich_text: [{ text: { content: historialId } }]
        },
        'Ticket ID': {
          rich_text: [{ text: { content: ticketName || ticketNotionId } }]
        }
      }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to create Manny Rewards entry:', errorText);
    return null;
  }

  const page = await response.json();
  return page.id;
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
    console.log('Ticket completed webhook received:', JSON.stringify(payload, null, 2));

    // Notion webhook verification
    if (payload.challenge) {
      return new Response(JSON.stringify({ challenge: payload.challenge }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Notion Automations pueden enviar el payload de diferentes formas
    let page: NotionPage | null = null;
    let ticketPageId: string | null = null;

    // Intentar extraer página de diferentes estructuras de payload
    if (payload.data?.properties) {
      page = payload.data;
      ticketPageId = page.id;
    } else if (payload.properties) {
      page = payload;
      ticketPageId = page.id;
    } else if (payload.page?.properties) {
      page = payload.page;
      ticketPageId = page.id;
    } else {
      // Notion Automations envía solo el page_id, necesitamos consultar Notion API
      // Buscar page_id en diferentes lugares del payload
      ticketPageId = payload.data?.id || payload.id || payload.page_id || payload.page?.id;

      console.log('No properties in payload, extracted page_id:', ticketPageId);
      console.log('Available top-level keys:', Object.keys(payload));

      if (ticketPageId && notionToken) {
        console.log('Fetching page data from Notion API...');
        page = await getPageFromNotion(ticketPageId, notionToken);

        if (!page) {
          return new Response(JSON.stringify({
            status: 'error',
            reason: 'failed to fetch page from Notion',
            page_id: ticketPageId
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        console.log('Successfully fetched page from Notion');
      } else if (!notionToken) {
        return new Response(JSON.stringify({
          status: 'error',
          reason: 'NOTION_TOKEN not configured - required for webhook processing',
          keys: Object.keys(payload)
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        return new Response(JSON.stringify({
          status: 'error',
          reason: 'could not extract page_id from payload',
          keys: Object.keys(payload)
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const properties = page!.properties;

    console.log('Page ID:', ticketPageId);
    console.log('Properties keys:', Object.keys(properties));

    if (!properties) {
      return new Response(JSON.stringify({ status: 'skipped', reason: 'no properties' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const status = extractStatus(properties);
    const monto = extractMonto(properties);
    const contactoNotionId = extractContactoRelation(properties);
    const ticketName = extractTicketId(properties);

    // Verificar si viene de una automatización de Notion
    const isFromAutomation = payload.source?.type === 'automation';

    console.log(`Ticket: ${ticketName}, Status: ${status}, Monto: ${monto}, Contacto: ${contactoNotionId}, FromAutomation: ${isFromAutomation}`);

    // Solo procesar si el status es "Terminadas" O si viene de una automatización
    // (las automatizaciones ya filtran por Status = Terminadas como trigger)
    if (status !== 'Terminadas' && !isFromAutomation) {
      console.log(`Status is "${status}", not "Terminadas" and not from automation. Skipping.`);
      return new Response(JSON.stringify({
        status: 'skipped',
        reason: 'status not Terminadas',
        current_status: status
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!monto || monto <= 0) {
      console.log('No valid monto found');
      return new Response(JSON.stringify({ status: 'skipped', reason: 'no monto' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!contactoNotionId) {
      console.log('No contacto relation found');
      return new Response(JSON.stringify({ status: 'skipped', reason: 'no contacto' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar si ya procesamos este ticket
    const { data: existingEvent } = await supabase
      .from('ticket_events')
      .select('id')
      .eq('source', 'notion')
      .eq('source_id', ticketPageId)
      .eq('event_type', 'ticket_completed')
      .single();

    if (existingEvent) {
      console.log('Ticket already processed');
      return new Response(JSON.stringify({ status: 'skipped', reason: 'already processed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar cliente por notion_page_id del contacto
    let { data: cliente } = await supabase
      .from('clientes')
      .select('id, nombre, puntos_actuales, telefono')
      .eq('notion_page_id', contactoNotionId)
      .single();

    // Si no se encuentra por notion_page_id, buscar por teléfono desde Notion
    if (!cliente && notionToken) {
      const phone = await getContactPhoneFromNotion(contactoNotionId, notionToken);
      if (phone) {
        const { data: clienteByPhone } = await supabase
          .from('clientes')
          .select('id, nombre, puntos_actuales, telefono')
          .eq('telefono', phone)
          .single();

        if (clienteByPhone) {
          // Actualizar notion_page_id
          await supabase
            .from('clientes')
            .update({ notion_page_id: contactoNotionId })
            .eq('id', clienteByPhone.id);

          cliente = clienteByPhone;
        }
      }
    }

    if (!cliente) {
      console.log('Cliente not found in Supabase');
      return new Response(JSON.stringify({
        status: 'error',
        reason: 'cliente not found',
        contacto_notion_id: contactoNotionId
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calcular puntos: 5% del monto, redondeado hacia abajo
    const puntosGanados = Math.floor(monto * 0.05);
    const nuevosPuntos = cliente.puntos_actuales + puntosGanados;

    console.log(`Cliente: ${cliente.nombre}, Tel: ${cliente.telefono}, Monto: ${monto}, Puntos ganados: ${puntosGanados}, Total: ${nuevosPuntos}`);

    // Usar la función atómica para asignar puntos (usa teléfono)
    const { data: resultado, error: rpcError } = await supabase.rpc('asignar_puntos_atomico', {
      p_cliente_telefono: cliente.telefono,
      p_puntos_a_sumar: puntosGanados,
      p_concepto: `Ticket completado: ${ticketName || ticketPageId} - Monto: $${monto.toFixed(2)}`
    });

    if (rpcError) throw rpcError;

    // Obtener el ID del historial recién creado
    const { data: historialReciente } = await supabase
      .from('historial_puntos')
      .select('id')
      .eq('cliente_id', cliente.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const historialId = historialReciente?.id || '';

    // Registrar el evento para evitar duplicados
    await supabase.from('ticket_events').insert({
      source: 'notion',
      source_id: ticketPageId,
      event_type: 'ticket_completed',
      payload: { monto, puntos_ganados: puntosGanados, cliente_id: cliente.id, ticket_name: ticketName },
      status: 'processed'
    });

    // Crear registro en Manny Rewards (NO actualizamos Contactos - es solo interno)
    if (notionToken) {
      const rewardsEntryId = await createMannyRewardsEntry(
        contactoNotionId,
        ticketPageId!,
        ticketName || '',
        monto,
        puntosGanados,
        historialId,
        notionToken
      );
      console.log(`Manny Rewards entry: ${rewardsEntryId ? 'created ' + rewardsEntryId : 'failed'}`);
    }

    // Notificar al cliente que ganó puntos (fire and forget)
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
          data: {
            puntos: puntosGanados,
            concepto: ticketName || 'servicio de mantenimiento',
            saldo: nuevosPuntos
          },
          url: '/dashboard'
        }),
      });
      console.log('Push notification sent to cliente');
    } catch (notifError) {
      console.warn('Could not send push notification:', notifError);
    }

    return new Response(JSON.stringify({
      status: 'success',
      cliente_id: cliente.id,
      cliente_nombre: cliente.nombre,
      monto: monto,
      puntos_ganados: puntosGanados,
      puntos_totales: nuevosPuntos,
      ticket_id: ticketPageId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing ticket webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
