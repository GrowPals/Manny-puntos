import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TICKETS_MANNY_DB = '17ac6cfd-8c1e-8162-b724-d4047a7e7635';
const MANNY_REWARDS_DB = '2bfc6cfd-8c1e-8026-9291-e4bc8c18ee01';
const CONTACTOS_DB = '17ac6cfd-8c1e-8068-8bc0-d32488189164';

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
  // Try exact match first
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
      '': { title: [{ text: { content: nombre } }] },
      'Teléfono': { phone_number: `+52${telefono}` }
    }
  }, notionToken);

  console.log(`Created Contacto in Notion: ${result.id} for ${nombre}`);
  return result.id;
}

async function createMannyRewardForContacto(contactoId: string, nombre: string, notionToken: string): Promise<string> {
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

async function findRewardByContacto(contactoId: string, notionToken: string): Promise<{ id: string; pendientes: string } | null> {
  const result = await notionRequest(`/databases/${MANNY_REWARDS_DB}/query`, 'POST', {
    filter: {
      property: 'Cliente',
      relation: { contains: contactoId }
    },
    page_size: 1
  }, notionToken);

  if (result.results && result.results.length > 0) {
    const reward = result.results[0];
    const pendientesField = reward.properties['Pendientes']?.rich_text;
    const pendientes = pendientesField?.map((t: any) => t.plain_text).join('') || '';
    return { id: reward.id, pendientes };
  }
  return null;
}

async function addPendienteToReward(rewardId: string, currentPendientes: string, nuevoPendiente: string, notionToken: string) {
  const today = new Date().toLocaleDateString('es-MX');
  const newEntry = `• ${nuevoPendiente} (${today})`;
  const updatedPendientes = currentPendientes
    ? `${currentPendientes}\n${newEntry}`
    : newEntry;

  await notionRequest(`/pages/${rewardId}`, 'PATCH', {
    properties: {
      'Pendientes': {
        rich_text: [{ text: { content: updatedPendientes } }]
      }
    }
  }, notionToken);

  console.log(`Added pendiente to reward ${rewardId}: ${nuevoPendiente}`);
}

interface TicketData {
  title: string;
  description: string;
  contactoId: string;
  rewardId: string | null;
  tipoTrabajo: string;
  clienteNombre: string;
  clienteNivel: string | null;
  puntosUsados: number;
  fechaCanje: string | null;
  tipoRedencion: string;
}

async function createTicketInNotion(
  data: TicketData,
  notionToken: string
): Promise<string> {
  const today = new Date().toISOString().split('T')[0];

  // Construir observaciones detalladas
  const nivelDisplay = data.clienteNivel === 'vip' ? '⭐ VIP' : 'Partner';
  const fechaDisplay = data.fechaCanje ? new Date(data.fechaCanje).toLocaleDateString('es-MX') : today;

  let observaciones = `🎁 CANJE MANNY REWARDS\n`;
  observaciones += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  observaciones += `👤 Cliente: ${data.clienteNombre}\n`;
  observaciones += `🏅 Nivel: ${nivelDisplay}\n`;
  if (data.puntosUsados > 0) {
    observaciones += `💰 Puntos usados: ${data.puntosUsados}\n`;
  }
  observaciones += `📅 Fecha de canje: ${fechaDisplay}\n`;
  observaciones += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  if (data.description) {
    observaciones += `📝 ${data.description}\n`;
  }
  observaciones += `\n🔄 Tipo: ${data.tipoRedencion}`;

  const ticketProperties: any = {
    'Ticket ': { title: [{ text: { content: data.title } }] },
    'Contacto': { relation: [{ id: data.contactoId }] },
    'Status': { status: { name: 'Ticket' } },
    'Tipo de trabajo': { select: { name: data.tipoTrabajo } },
    'Manny Rewards': { checkbox: true },
    'Fecha': { date: { start: today } },
    'Observaciones ': { rich_text: [{ text: { content: observaciones } }] }
  };

  // Link to Manny Reward if exists
  if (data.rewardId) {
    ticketProperties['Rewards'] = { relation: [{ id: data.rewardId }] };
  }

  const ticketResult = await notionRequest('/pages', 'POST', {
    parent: { database_id: TICKETS_MANNY_DB },
    properties: ticketProperties
  }, notionToken);

  console.log(`Created ticket in Notion: ${ticketResult.id}`);
  return ticketResult.id;
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

    console.log('Create reward ticket/pendiente payload:', JSON.stringify(payload, null, 2));

    const { tipo, id } = payload;

    if (!tipo || !id) {
      return new Response(JSON.stringify({ error: 'Missing tipo or id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let clienteTelefono: string;
    let clienteNombre: string;
    let clienteEmail: string | null = null;
    let clienteNivel: string | null = null;
    let puntosUsados: number = 0;
    let itemNombre: string;
    let itemDescripcion: string;
    let esServicio: boolean = false;
    let tipoTrabajo: string = 'Especializado';
    let fechaCanje: string | null = null;

    if (tipo === 'canje') {
      // Get canje details with producto info
      const { data: canje, error } = await supabase
        .from('canjes')
        .select(`
          *,
          clientes(id, nombre, telefono, email, nivel, notion_page_id),
          productos(nombre, puntos_requeridos, tipo, descripcion)
        `)
        .eq('id', id)
        .single();

      if (error || !canje) {
        throw new Error(`Canje not found: ${id}`);
      }

      clienteTelefono = canje.clientes?.telefono;
      clienteNombre = canje.clientes?.nombre || 'Cliente';
      clienteEmail = canje.clientes?.email || null;
      clienteNivel = canje.clientes?.nivel || null;
      puntosUsados = canje.puntos_usados || 0;
      itemNombre = canje.productos?.nombre || 'Producto';
      itemDescripcion = canje.productos?.descripcion || '';
      fechaCanje = canje.created_at;

      // Determinar si es servicio o producto
      const tipoProducto = canje.productos?.tipo?.toLowerCase() || '';
      esServicio = tipoProducto === 'servicio' || tipoProducto === 'service';

      if (esServicio) {
        tipoTrabajo = 'Especializado'; // O mapear según el tipo de servicio
      }

    } else if (tipo === 'beneficio') {
      // Get beneficio details - puede ser de links_regalo o beneficios_cliente
      const { data: beneficio, error } = await supabase
        .from('beneficios_cliente')
        .select(`
          *,
          clientes:cliente_id(id, nombre, telefono, email, nivel, notion_page_id)
        `)
        .eq('id', id)
        .single();

      if (error || !beneficio) {
        throw new Error(`Beneficio not found: ${id}`);
      }

      clienteTelefono = beneficio.clientes?.telefono;
      clienteNombre = beneficio.clientes?.nombre || 'Cliente';
      clienteEmail = beneficio.clientes?.email || null;
      clienteNivel = beneficio.clientes?.nivel || null;
      itemNombre = beneficio.nombre || 'Beneficio';
      itemDescripcion = beneficio.descripcion || '';
      fechaCanje = beneficio.created_at;

      // Beneficios de tipo servicio siempre crean ticket
      const tipoBeneficio = beneficio.tipo?.toLowerCase() || '';
      esServicio = tipoBeneficio === 'servicio' || tipoBeneficio === 'service';

    } else if (tipo === 'beneficio_reclamado') {
      // Beneficio reclamado desde la tabla beneficios_reclamados (legacy)
      const { data: beneficio, error } = await supabase
        .from('beneficios_reclamados')
        .select(`
          *,
          clientes(id, nombre, telefono, email, nivel, notion_page_id)
        `)
        .eq('id', id)
        .single();

      if (error || !beneficio) {
        throw new Error(`Beneficio reclamado not found: ${id}`);
      }

      clienteTelefono = beneficio.clientes?.telefono;
      clienteNombre = beneficio.clientes?.nombre || 'Cliente';
      clienteEmail = beneficio.clientes?.email || null;
      clienteNivel = beneficio.clientes?.nivel || null;
      itemNombre = beneficio.nombre_beneficio || 'Beneficio';
      itemDescripcion = beneficio.descripcion_beneficio || '';
      fechaCanje = beneficio.created_at;
      esServicio = true; // Beneficios reclamados siempre son servicios

    } else {
      return new Response(JSON.stringify({ error: `Unknown tipo: ${tipo}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!clienteTelefono) {
      return new Response(JSON.stringify({ error: 'Cliente sin teléfono' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find or create contacto in Notion
    let contactoId = await findContactoByPhone(clienteTelefono, notionToken);
    let contactoCreated = false;

    if (!contactoId) {
      console.log(`Contacto not found for phone: ${clienteTelefono}, creating...`);
      contactoId = await createContactoInNotion(clienteNombre, clienteTelefono, notionToken);
      contactoCreated = true;

      // Update Supabase client with notion_page_id
      if (tipo === 'canje') {
        const { data: canje } = await supabase
          .from('canjes')
          .select('cliente_id')
          .eq('id', id)
          .single();

        if (canje?.cliente_id) {
          await supabase
            .from('clientes')
            .update({ notion_page_id: contactoId })
            .eq('id', canje.cliente_id);
        }
      }
    }

    // Find or create Manny Reward
    let reward = await findRewardByContacto(contactoId, notionToken);
    let rewardId = reward?.id || null;
    let rewardCreated = false;

    if (!rewardId) {
      console.log(`No Manny Reward found, creating...`);
      rewardId = await createMannyRewardForContacto(contactoId, clienteNombre, notionToken);
      rewardCreated = true;
      reward = { id: rewardId, pendientes: '' };

      // Update Supabase client with notion_reward_id
      if (tipo === 'canje') {
        const { data: canje } = await supabase
          .from('canjes')
          .select('cliente_id')
          .eq('id', id)
          .single();

        if (canje?.cliente_id) {
          await supabase
            .from('clientes')
            .update({ notion_reward_id: rewardId })
            .eq('id', canje.cliente_id);
        }
      }
    }

    let resultType: string;
    let notionId: string | null = null;

    if (esServicio) {
      // SERVICIO: Crear ticket en Tickets Manny con checkbox marcado
      const ticketTitle = tipo === 'canje'
        ? `Canje Servicio: ${itemNombre}`
        : tipo === 'beneficio' || tipo === 'beneficio_reclamado'
          ? `Regalo: ${itemNombre}`
          : `Manny Rewards: ${itemNombre}`;

      const tipoRedencion = tipo === 'canje'
        ? 'Canje por puntos'
        : tipo === 'beneficio'
          ? 'Regalo de nivel'
          : 'Beneficio especial';

      notionId = await createTicketInNotion({
        title: ticketTitle,
        description: itemDescripcion,
        contactoId,
        rewardId,
        tipoTrabajo,
        clienteNombre,
        clienteNivel,
        puntosUsados,
        fechaCanje,
        tipoRedencion
      }, notionToken);

      resultType = 'ticket_created';

      // Update canje/beneficio with notion_ticket_id
      if (tipo === 'canje') {
        await supabase
          .from('canjes')
          .update({ notion_ticket_id: notionId })
          .eq('id', id);
      } else if (tipo === 'beneficio') {
        await supabase
          .from('beneficios_cliente')
          .update({ notion_ticket_id: notionId })
          .eq('id', id);
      } else if (tipo === 'beneficio_reclamado') {
        await supabase
          .from('beneficios_reclamados')
          .update({ notion_ticket_id: notionId })
          .eq('id', id);
      }

    } else {
      // PRODUCTO: Agregar a campo Pendientes en Manny Rewards
      // Ahora siempre tenemos rewardId porque lo creamos arriba si no existía
      const currentPendientes = reward?.pendientes || '';
      const nuevoPendiente = `${itemNombre} - Canje #${id.slice(0, 8)}`;

      await addPendienteToReward(rewardId!, currentPendientes, nuevoPendiente, notionToken);

      resultType = 'pendiente_added';
      notionId = rewardId;

      // Update canje with notion reference
      if (tipo === 'canje') {
        await supabase
          .from('canjes')
          .update({ notion_reward_id: rewardId })
          .eq('id', id);
      }
    }

    return new Response(JSON.stringify({
      status: 'success',
      result_type: resultType,
      notion_id: notionId,
      tipo,
      es_servicio: esServicio,
      cliente: clienteNombre,
      item: itemNombre,
      contacto_id: contactoId,
      reward_id: rewardId,
      contacto_created: contactoCreated,
      reward_created: rewardCreated
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
