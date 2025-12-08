import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  handleCors,
  getCorsHeaders,
  createSupabaseAdmin,
  getNotionToken,
  verifyAuth,
  queryNotionDatabase,
  createNotionPage,
  updateNotionPage,
  NOTION_DBS,
  errorResponse,
  successResponse,
} from '../_shared/index.ts';

interface SyncPayload {
  cliente_id?: string;
  telefono?: string;
  nombre?: string;
}

async function findContactoByPhone(telefono: string, notionToken: string): Promise<string | null> {
  // Try exact match
  let results = await queryNotionDatabase(
    NOTION_DBS.CONTACTOS,
    { property: 'Teléfono', phone_number: { equals: telefono } },
    notionToken,
    1
  );

  if (results.length > 0) return results[0].id;

  // Try with +52 prefix
  results = await queryNotionDatabase(
    NOTION_DBS.CONTACTOS,
    { property: 'Teléfono', phone_number: { equals: `+52${telefono}` } },
    notionToken,
    1
  );

  return results.length > 0 ? results[0].id : null;
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

    const { cliente_id, telefono, nombre }: SyncPayload = await req.json();
    console.log('Sync cliente to Notion:', { cliente_id, telefono });

    if (!cliente_id && !telefono) {
      return errorResponse('Missing cliente_id or telefono', corsHeaders, 400);
    }

    // Get cliente from Supabase
    let cliente;
    if (cliente_id) {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', cliente_id)
        .single();
      if (error || !data) throw new Error(`Cliente not found: ${cliente_id}`);
      cliente = data;
    } else {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('telefono', telefono)
        .single();
      if (error || !data) throw new Error(`Cliente not found with telefono: ${telefono}`);
      cliente = data;
    }

    let contactoId = cliente.notion_page_id;
    let mannyRewardId = cliente.notion_reward_id;
    const created = { contacto: false, reward: false };

    // Step 1: Find or create Contacto in Notion
    if (!contactoId) {
      contactoId = await findContactoByPhone(cliente.telefono, notionToken);

      if (!contactoId) {
        // Create new Contacto
        const contactoPage = await createNotionPage(NOTION_DBS.CONTACTOS, {
          '': { title: [{ text: { content: cliente.nombre || nombre || 'Nuevo Cliente' } }] },
          'Teléfono': { phone_number: `+52${cliente.telefono}` }
        }, notionToken);

        contactoId = contactoPage.id;
        created.contacto = true;
        console.log(`Created Contacto: ${contactoId}`);
      }

      // Update Supabase with notion_page_id
      await supabase
        .from('clientes')
        .update({ notion_page_id: contactoId })
        .eq('id', cliente.id);
    }

    // Step 2: Find or create Manny Reward
    if (!mannyRewardId) {
      const rewards = await queryNotionDatabase(
        NOTION_DBS.MANNY_REWARDS,
        { property: 'Cliente', relation: { contains: contactoId } },
        notionToken,
        1
      );

      if (rewards.length > 0) {
        mannyRewardId = rewards[0].id;
      }
    }

    if (!mannyRewardId) {
      // Create new Manny Reward
      const rewardPage = await createNotionPage(NOTION_DBS.MANNY_REWARDS, {
        'Nombre': { title: [{ text: { content: cliente.nombre || nombre || 'Nuevo Cliente' } }] },
        'Cliente': { relation: [{ id: contactoId }] },
        'Nivel': { select: { name: 'Partner' } },
        'Puntos': { number: 0 },
        'Supabase ID': { rich_text: [{ text: { content: cliente.id } }] }
      }, notionToken);

      mannyRewardId = rewardPage.id;
      created.reward = true;
      console.log(`Created Manny Reward: ${mannyRewardId}`);

      // Update Supabase with notion_reward_id
      await supabase
        .from('clientes')
        .update({ notion_reward_id: mannyRewardId })
        .eq('id', cliente.id);
    } else {
      // Ensure Supabase ID is set in Manny Reward
      await updateNotionPage(mannyRewardId, {
        'Supabase ID': { rich_text: [{ text: { content: cliente.id } }] }
      }, notionToken);
    }

    return successResponse({
      cliente_id: cliente.id,
      contacto_id: contactoId,
      manny_reward_id: mannyRewardId,
      created
    }, corsHeaders);

  } catch (error) {
    console.error('Error:', error);
    return errorResponse(error.message, corsHeaders, 500);
  }
});
