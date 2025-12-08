import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  handleCors,
  getCorsHeaders,
  createSupabaseAdmin,
  getNotionToken,
  extractWebhookPage,
  extractPhoneNumber,
  extractTitle,
  extractEmail,
  handleNotionChallenge,
  verifyWebhookSecret,
  queryNotionDatabase,
  createNotionPage,
  safeParseJson,
  NOTION_DBS,
  errorResponse,
  successResponse,
  skippedResponse,
  jsonResponse,
  type WebhookPayload,
} from '../_shared/index.ts';

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Verify webhook authenticity
    if (!verifyWebhookSecret(req)) {
      console.warn('Webhook verification failed');
      return errorResponse('Unauthorized', corsHeaders, 401);
    }

    const supabase = createSupabaseAdmin();
    const notionToken = getNotionToken();

    const { data: payload, errorResponse: parseError } = await safeParseJson<WebhookPayload>(req, corsHeaders);
    if (parseError) return parseError;
    if (!payload) return errorResponse('Empty request body', corsHeaders, 400);

    console.log('Contact webhook received:', JSON.stringify(payload, null, 2));

    // Handle Notion challenge
    const challengeResponse = handleNotionChallenge(payload, corsHeaders);
    if (challengeResponse) return challengeResponse;

    // Extract page from payload
    const extracted = await extractWebhookPage(payload, notionToken);
    if (!extracted) {
      return errorResponse('Could not extract page from payload', corsHeaders, 400);
    }

    const { pageId: notionPageId, page } = extracted;
    const properties = page.properties;

    const telefono = extractPhoneNumber(properties);
    const nombre = extractTitle(properties);
    const email = extractEmail(properties);

    if (!telefono) {
      console.log('No valid phone number found');
      return skippedResponse('no phone', corsHeaders);
    }

    console.log(`Processing contact: ${nombre} (${telefono})`);

    // Idempotency check - prevent duplicate processing within short window
    // Uses phone + page ID to allow updates if data changes significantly
    const idempotencyKey = `contact_sync_${notionPageId}`;
    const { data: existingEvent } = await supabase
      .from('ticket_events')
      .select('id, created_at')
      .eq('source', 'notion')
      .eq('source_id', idempotencyKey)
      .eq('event_type', 'contact_sync')
      .single();

    // Skip if processed within last 5 minutes (debounce rapid webhook calls)
    if (existingEvent) {
      const createdAt = new Date(existingEvent.created_at);
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (createdAt > fiveMinutesAgo) {
        console.log('Contact already processed recently');
        return skippedResponse('recently processed', corsHeaders);
      }
      // Delete old event to allow reprocessing
      await supabase.from('ticket_events').delete().eq('id', existingEvent.id);
    }

    // Check if client exists by phone
    const { data: existing } = await supabase
      .from('clientes')
      .select('id, notion_page_id')
      .eq('telefono', telefono)
      .single();

    let clienteId: string;

    if (existing) {
      clienteId = existing.id;

      // Link to Notion if not already linked
      if (!existing.notion_page_id) {
        await supabase
          .from('clientes')
          .update({
            notion_page_id: notionPageId,
            last_sync_at: new Date().toISOString()
          })
          .eq('id', existing.id);
        console.log(`Linked existing client ${existing.id} to Notion page ${notionPageId}`);
      } else {
        console.log(`Client already exists and linked: ${existing.id}`);
      }
    } else {
      // Create new client
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

    // Find or create Manny Reward
    let mannyRewardId: string | null = null;

    // Check if Manny Reward exists for this contact
    const rewards = await queryNotionDatabase(
      NOTION_DBS.MANNY_REWARDS,
      { property: 'Cliente', relation: { contains: notionPageId } },
      notionToken,
      1
    );

    if (rewards.length > 0) {
      mannyRewardId = rewards[0].id;
      console.log(`Manny Reward already exists: ${mannyRewardId}`);
    } else {
      // Create new Manny Reward
      const rewardPage = await createNotionPage(NOTION_DBS.MANNY_REWARDS, {
        'Nombre': { title: [{ text: { content: nombre.trim() } }] },
        'Cliente': { relation: [{ id: notionPageId }] },
        'Nivel': { select: { name: 'Partner' } },
        'Puntos': { number: 0 }
      }, notionToken);

      mannyRewardId = rewardPage.id;
      console.log(`Created Manny Reward: ${mannyRewardId}`);
    }

    // Record event for idempotency
    await supabase.from('ticket_events').insert({
      source: 'notion',
      source_id: idempotencyKey,
      event_type: 'contact_sync',
      payload: { cliente_id: clienteId, telefono, notion_page_id: notionPageId },
      status: 'processed'
    });

    return jsonResponse({
      status: existing ? (existing.notion_page_id ? 'exists' : 'linked') : 'created',
      cliente_id: clienteId,
      nombre: nombre.trim(),
      telefono: telefono,
      nivel: 'partner',
      manny_reward_id: mannyRewardId
    }, corsHeaders);

  } catch (error) {
    console.error('Error processing webhook:', error);
    return errorResponse(error.message, corsHeaders, 500);
  }
});
