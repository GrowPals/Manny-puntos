import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  handleCors,
  getCorsHeaders,
  createSupabaseAdmin,
  getNotionToken,
  createNotionPage,
  updateNotionPage,
  queryNotionDatabase,
  verifyAuth,
  NOTION_DBS,
  errorResponse,
  successResponse,
} from '../_shared/index.ts';

async function findContactoByPhone(telefono: string, notionToken: string): Promise<string | null> {
  // Try exact match first
  const results = await queryNotionDatabase(
    NOTION_DBS.CONTACTOS,
    { property: 'Teléfono', phone_number: { equals: telefono } },
    notionToken,
    1
  );

  if (results.length > 0) {
    return results[0].id;
  }

  // Try with +52 prefix
  const results2 = await queryNotionDatabase(
    NOTION_DBS.CONTACTOS,
    { property: 'Teléfono', phone_number: { equals: `+52${telefono}` } },
    notionToken,
    1
  );

  if (results2.length > 0) {
    return results2[0].id;
  }

  return null;
}

async function createContactoInNotion(nombre: string, telefono: string, notionToken: string): Promise<string> {
  const result = await createNotionPage(
    NOTION_DBS.CONTACTOS,
    {
      '': { title: [{ text: { content: nombre } }] },
      'Teléfono': { phone_number: `+52${telefono}` }
    },
    notionToken
  );

  console.log(`Created Contacto in Notion: ${result.id} for ${nombre}`);
  return result.id;
}

async function createMannyRewardForContacto(contactoId: string, nombre: string, notionToken: string): Promise<string> {
  const result = await createNotionPage(
    NOTION_DBS.MANNY_REWARDS,
    {
      'Nombre': { title: [{ text: { content: nombre } }] },
      'Cliente': { relation: [{ id: contactoId }] },
      'Nivel': { select: { name: 'Partner' } },
      'Puntos': { number: 0 }
    },
    notionToken
  );

  console.log(`Created Manny Reward: ${result.id} for ${nombre}`);
  return result.id;
}

async function findRewardByContacto(contactoId: string, notionToken: string): Promise<{ id: string; pendientes: string } | null> {
  const results = await queryNotionDatabase(
    NOTION_DBS.MANNY_REWARDS,
    { property: 'Cliente', relation: { contains: contactoId } },
    notionToken,
    1
  );

  if (results.length > 0) {
    const reward = results[0];
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

  await updateNotionPage(rewardId, {
    'Pendientes': {
      rich_text: [{ text: { content: updatedPendientes } }]
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
  esGuardable: boolean;  // true = beneficio guardable, false = canje urgente
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

  // Estado inicial del ticket:
  // - 'Guardado' para beneficios/regalos (cliente activa cuando quiera)
  // - 'Ticket' para canjes de servicios (entran directo al flujo)
  const statusInicial = data.esGuardable ? 'Guardado' : 'Ticket';

  const ticketProperties: Record<string, unknown> = {
    'Ticket ': { title: [{ text: { content: data.title } }] },
    'Contacto': { relation: [{ id: data.contactoId }] },
    'Status': { status: { name: statusInicial } },
    'Tipo de trabajo': { select: { name: data.tipoTrabajo } },
    'Manny Rewards': { checkbox: true },
    'Fecha': { date: { start: today } },
    'Observaciones ': { rich_text: [{ text: { content: observaciones } }] }
  };

  // Link to Manny Reward if exists
  if (data.rewardId) {
    ticketProperties['Rewards'] = { relation: [{ id: data.rewardId }] };
  }

  const ticketResult = await createNotionPage(NOTION_DBS.TICKETS, ticketProperties, notionToken);

  console.log(`Created ticket in Notion: ${ticketResult.id}`);
  return ticketResult.id;
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const supabase = createSupabaseAdmin();
    const notionToken = getNotionToken();

    // Validate caller is authenticated
    const auth = await verifyAuth(req, supabase);
    if (!auth.success) {
      return errorResponse(auth.error!, corsHeaders, auth.statusCode!);
    }

    const payload = await req.json();
    console.log('Create reward ticket/pendiente payload:', JSON.stringify(payload, null, 2));

    const { tipo, id } = payload;

    if (!tipo || !id) {
      return errorResponse('Missing tipo or id', corsHeaders, 400);
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
        return errorResponse(`Canje not found: ${id}`, corsHeaders, 404);
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

    } else if (tipo === 'beneficio') {
      // Get beneficio details
      const { data: beneficio, error } = await supabase
        .from('beneficios_cliente')
        .select(`
          *,
          clientes:cliente_id(id, nombre, telefono, email, nivel, notion_page_id)
        `)
        .eq('id', id)
        .single();

      if (error || !beneficio) {
        return errorResponse(`Beneficio not found: ${id}`, corsHeaders, 404);
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

    } else {
      return errorResponse(`Unknown tipo: ${tipo}`, corsHeaders, 400);
    }

    if (!clienteTelefono) {
      return errorResponse('Cliente sin teléfono', corsHeaders, 400);
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
        : tipo === 'beneficio'
          ? `Regalo: ${itemNombre}`
          : `Manny Rewards: ${itemNombre}`;

      const tipoRedencion = tipo === 'canje'
        ? 'Canje por puntos'
        : tipo === 'beneficio'
          ? 'Regalo de nivel'
          : 'Beneficio especial';

      // Beneficios son guardables (cliente activa cuando quiera)
      // Canjes de servicios son urgentes (entran directo al flujo)
      const esGuardable = tipo === 'beneficio';

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
        tipoRedencion,
        esGuardable
      }, notionToken);

      resultType = 'ticket_created';

      // Update canje/beneficio with notion_ticket_id
      if (tipo === 'canje') {
        // Canjes de servicios: solo guardar el ticket_id, NO cambiar estado
        // El estado ya es 'en_lista' desde registrar_canje_atomico
        await supabase
          .from('canjes')
          .update({ notion_ticket_id: notionId })
          .eq('id', id);
      } else if (tipo === 'beneficio') {
        // Beneficios: guardar ticket_id, estado sigue siendo 'activo'
        await supabase
          .from('beneficios_cliente')
          .update({ notion_ticket_id: notionId })
          .eq('id', id);
      }

    } else {
      // PRODUCTO: Agregar a campo Pendientes en Manny Rewards
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

    return successResponse({
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
    }, corsHeaders);

  } catch (error) {
    console.error('Error:', error);
    return errorResponse(error.message, corsHeaders, 500);
  }
});
