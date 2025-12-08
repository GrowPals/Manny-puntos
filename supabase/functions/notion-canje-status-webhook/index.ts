import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  handleCors,
  getCorsHeaders,
  createSupabaseAdmin,
  getNotionToken,
  notionEstadoToSupabase,
  extractWebhookPage,
  extractSelect,
  extractRichText,
  extractDate,
  handleNotionChallenge,
  verifyWebhookSecret,
  jsonResponse,
  errorResponse,
  skippedResponse,
  successResponse,
  type WebhookPayload,
} from '../_shared/index.ts';

Deno.serve(async (req: Request) => {
  // Handle CORS
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

    const payload: WebhookPayload = await req.json();
    console.log('Canje status webhook received:', JSON.stringify(payload, null, 2));

    // Handle Notion challenge
    const challengeResponse = handleNotionChallenge(payload, corsHeaders);
    if (challengeResponse) return challengeResponse;

    // Extract page from payload
    const extracted = await extractWebhookPage(payload, notionToken);
    if (!extracted) {
      return errorResponse('Could not extract page from payload', corsHeaders, 400);
    }

    const { pageId: canjeNotionPageId, page } = extracted;
    const properties = page.properties;

    const notionEstado = extractSelect(properties, 'Estado');
    const supabaseId = extractRichText(properties, 'Supabase ID');
    const fechaEntrega = extractDate(properties, 'Fecha Entrega');

    console.log(`Canje Notion ID: ${canjeNotionPageId}, Supabase ID: ${supabaseId}, Estado: ${notionEstado}, Fecha Entrega: ${fechaEntrega}`);

    // Find canje in Supabase
    let canjeId = supabaseId;

    if (!canjeId) {
      const { data: canje } = await supabase
        .from('canjes')
        .select('id')
        .eq('notion_page_id', canjeNotionPageId)
        .single();

      if (!canje) {
        return skippedResponse('canje not found in Supabase', corsHeaders);
      }
      canjeId = canje.id;
    }

    // Map estado
    const supabaseEstado = notionEstado ? notionEstadoToSupabase(notionEstado) : null;

    if (!supabaseEstado) {
      return skippedResponse('unknown estado', corsHeaders, { notion_estado: notionEstado });
    }

    // Update canje in Supabase
    const updateData: Record<string, unknown> = { estado: supabaseEstado };
    if (fechaEntrega) {
      updateData.fecha_entrega = fechaEntrega;
    }

    const { error: updateError } = await supabase
      .from('canjes')
      .update(updateData)
      .eq('id', canjeId);

    if (updateError) {
      console.error('Error updating canje:', updateError);
      return errorResponse(`Failed to update canje: ${updateError.message}`, corsHeaders, 500);
    }

    return successResponse({
      canje_id: canjeId,
      nuevo_estado: supabaseEstado,
      fecha_entrega: fechaEntrega
    }, corsHeaders);

  } catch (error) {
    console.error('Error processing canje webhook:', error);
    return errorResponse(error.message, corsHeaders, 500);
  }
});
