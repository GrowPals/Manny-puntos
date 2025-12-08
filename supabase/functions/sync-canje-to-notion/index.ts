import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  handleCors,
  getCorsHeaders,
  createSupabaseAdmin,
  getNotionToken,
  verifyAuth,
  supabaseEstadoToNotion,
  createNotionPage,
  NOTION_DBS,
  errorResponse,
  successResponse,
  jsonResponse,
} from '../_shared/index.ts';

interface CanjeData {
  canje_id: string;
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const supabase = createSupabaseAdmin();
    const notionToken = getNotionToken();

    // Validate authentication
    const auth = await verifyAuth(req, supabase);
    if (!auth.success) {
      return errorResponse(auth.error!, corsHeaders, auth.statusCode!);
    }

    const { canje_id }: CanjeData = await req.json();
    console.log('Sync canje to Notion:', canje_id);

    if (!canje_id) {
      return errorResponse('canje_id is required', corsHeaders, 400);
    }

    // Get canje with related data
    const { data: canje, error: canjeError } = await supabase
      .from('canjes')
      .select(`
        id,
        puntos_usados,
        estado,
        notion_page_id,
        clientes(id, nombre, notion_page_id, nivel),
        productos(nombre)
      `)
      .eq('id', canje_id)
      .single();

    if (canjeError || !canje) {
      console.error('Canje not found:', canjeError);
      return errorResponse('Canje not found', corsHeaders, 404);
    }

    // If already synced, return existing ID
    if (canje.notion_page_id) {
      return jsonResponse({
        status: 'already_synced',
        notion_page_id: canje.notion_page_id
      }, corsHeaders);
    }

    const cliente = canje.clientes as { id: string; nombre: string; notion_page_id: string | null; nivel: string } | null;
    const producto = canje.productos as { nombre: string } | null;

    const today = new Date().toISOString().split('T')[0];
    const estadoNotion = supabaseEstadoToNotion(canje.estado);
    const nivelCapitalized = cliente?.nivel === 'vip' ? 'VIP' : 'Partner';
    const productoNombre = producto?.nombre || 'Producto';

    // Build Notion properties
    const properties: Record<string, unknown> = {
      'Registro': {
        title: [{ text: { content: `Canje: ${productoNombre}` } }]
      },
      'Tipo': {
        select: { name: 'Canje' }
      },
      'Puntos': {
        number: -canje.puntos_usados  // Negative because points are used
      },
      'Producto': {
        rich_text: [{ text: { content: productoNombre } }]
      },
      'Estado': {
        select: { name: estadoNotion }
      },
      'Nivel': {
        select: { name: nivelCapitalized }
      },
      'Fecha': {
        date: { start: today }
      },
      'Supabase ID': {
        rich_text: [{ text: { content: canje.id } }]
      }
    };

    // Add client relation if available
    if (cliente?.notion_page_id) {
      properties['Cliente'] = {
        relation: [{ id: cliente.notion_page_id }]
      };
    }

    // Create page in Notion
    const notionPage = await createNotionPage(NOTION_DBS.MANNY_REWARDS, properties, notionToken);

    // Save notion_page_id to canje
    await supabase
      .from('canjes')
      .update({ notion_page_id: notionPage.id })
      .eq('id', canje_id);

    console.log(`Canje ${canje_id} synced to Notion: ${notionPage.id}`);

    return successResponse({
      canje_id: canje_id,
      notion_page_id: notionPage.id
    }, corsHeaders);

  } catch (error) {
    console.error('Error syncing canje to Notion:', error);
    return errorResponse(error.message, corsHeaders, 500);
  }
});
