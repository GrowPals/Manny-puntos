import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  handleCors,
  getCorsHeaders,
  createSupabaseAdmin,
  getNotionToken,
  verifyAuth,
  supabaseEstadoToNotion,
  updateNotionPage,
  errorResponse,
  successResponse,
  skippedResponse,
} from '../_shared/index.ts';

interface UpdateData {
  canje_id: string;
  nuevo_estado: string;
  fecha_entrega?: string;
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const supabase = createSupabaseAdmin();
    const notionToken = getNotionToken();

    // Require admin auth
    const auth = await verifyAuth(req, supabase, true);
    if (!auth.success) {
      return errorResponse(auth.error!, corsHeaders, auth.statusCode!);
    }

    const { canje_id, nuevo_estado, fecha_entrega }: UpdateData = await req.json();
    console.log('Update canje status in Notion:', canje_id, nuevo_estado);

    if (!canje_id || !nuevo_estado) {
      return errorResponse('canje_id and nuevo_estado are required', corsHeaders, 400);
    }

    // Get notion_page_id from canje
    const { data: canje, error: canjeError } = await supabase
      .from('canjes')
      .select('notion_page_id')
      .eq('id', canje_id)
      .single();

    if (canjeError || !canje) {
      return errorResponse('Canje not found', corsHeaders, 404);
    }

    if (!canje.notion_page_id) {
      return skippedResponse('Canje not synced to Notion yet', corsHeaders);
    }

    // Map estado using centralized mapping (fixes the agendado bug!)
    const estadoNotion = supabaseEstadoToNotion(nuevo_estado);

    // Build properties to update
    const properties: Record<string, unknown> = {
      'Estado': {
        select: { name: estadoNotion }
      }
    };

    if (fecha_entrega) {
      properties['Fecha Entrega'] = {
        date: { start: fecha_entrega.split('T')[0] }
      };
    }

    // Update Notion page
    await updateNotionPage(canje.notion_page_id, properties, notionToken);

    return successResponse({
      canje_id: canje_id,
      notion_page_id: canje.notion_page_id,
      nuevo_estado: nuevo_estado,
      estado_notion: estadoNotion
    }, corsHeaders);

  } catch (error) {
    console.error('Error updating canje status in Notion:', error);
    return errorResponse(error.message, corsHeaders, 500);
  }
});
