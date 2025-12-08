import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  handleCors,
  getCorsHeaders,
  createSupabaseAdmin,
  getNotionToken,
  verifyAuth,
  updateNotionPage,
  errorResponse,
  successResponse,
} from '../_shared/index.ts';

/**
 * Activa un beneficio guardado - cambia el ticket de "Guardado" a "Ticket"
 * Esto indica que el cliente quiere usar su recompensa ahora
 *
 * NOTA: Solo para beneficios/regalos. Los canjes de servicios entran directo al flujo.
 *
 * Payload:
 * - tipo: 'beneficio' (requerido)
 * - id: UUID del beneficio
 */
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
    const { tipo, id } = payload;

    // Support legacy parameter name
    const itemId = id || payload.beneficio_id;
    const itemTipo = tipo || 'beneficio';

    if (!itemId) {
      return errorResponse('Missing id', corsHeaders, 400);
    }

    // Solo soportamos beneficios - canjes van directo al flujo
    if (itemTipo !== 'beneficio') {
      return errorResponse('Solo se pueden activar beneficios. Los canjes de servicios entran directo al flujo.', corsHeaders, 400);
    }

    // Get beneficio with client info
    const { data: beneficio, error } = await supabase
      .from('beneficios_cliente')
      .select(`
        id,
        cliente_id,
        nombre,
        estado,
        notion_ticket_id
      `)
      .eq('id', itemId)
      .single();

    if (error || !beneficio) {
      return errorResponse(`Beneficio not found: ${itemId}`, corsHeaders, 404);
    }

    const clienteId = beneficio.cliente_id;
    const notionTicketId = beneficio.notion_ticket_id;
    const itemNombre = beneficio.nombre;
    const currentEstado = beneficio.estado;

    // Check if beneficio is in correct state
    if (currentEstado !== 'activo') {
      return errorResponse(`Beneficio no está activo (estado: ${currentEstado})`, corsHeaders, 400);
    }

    // Verify ownership (client can only activate their own items)
    if (!auth.isAdmin && auth.clienteId !== clienteId) {
      return errorResponse('Access denied', corsHeaders, 403);
    }

    if (!notionTicketId) {
      return errorResponse('Beneficio no tiene ticket en Notion', corsHeaders, 400);
    }

    // Update ticket status in Notion from "Guardado" to "Ticket"
    await updateNotionPage(notionTicketId, {
      'Status': { status: { name: 'Ticket' } }
    }, notionToken);

    console.log(`Activated beneficio ${itemId} - ticket ${notionTicketId} moved to Ticket status`);

    // For beneficios, we keep 'activo' until the ticket is completed by notion-ticket-completed

    return successResponse({
      tipo: 'beneficio',
      id: itemId,
      nombre: itemNombre,
      notion_ticket_id: notionTicketId,
      status: 'activated',
      message: 'Beneficio activado - ticket movido a estado Ticket'
    }, corsHeaders);

  } catch (error) {
    console.error('Error:', error);
    return errorResponse((error as Error).message, corsHeaders, 500);
  }
});
