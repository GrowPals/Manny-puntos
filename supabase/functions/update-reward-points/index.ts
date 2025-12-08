import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  handleCors,
  getCorsHeaders,
  getNotionToken,
  getNotionPage,
  queryNotionDatabase,
  updateNotionPage,
  extractRelation,
  verifyWebhookSecret,
  NOTION_DBS,
  errorResponse,
  successResponse,
  skippedResponse,
} from '../_shared/index.ts';

// NOTE: This function is called by Notion Automations, not by frontend
Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Verify webhook authenticity for Notion automations
    if (!verifyWebhookSecret(req)) {
      console.warn('Webhook verification failed');
      return errorResponse('Unauthorized', corsHeaders, 401);
    }

    const notionToken = getNotionToken();
    const payload = await req.json();
    console.log('Received payload:', JSON.stringify(payload, null, 2));

    // Handle Notion automation payload formats
    let ticketId = payload.data?.id || payload.page_id || payload.id || payload.ticket_id;
    let rewardId = payload.reward_id;

    if (!ticketId && !rewardId) {
      return errorResponse('Missing ticket_id or reward_id', corsHeaders, 400);
    }

    // If we have a ticket ID, find the associated reward
    if (ticketId && !rewardId) {
      console.log(`Finding reward for ticket: ${ticketId}`);

      const ticket = await getNotionPage(ticketId, notionToken);
      if (!ticket) {
        return skippedResponse('Ticket not found', corsHeaders);
      }

      // Check direct Rewards relation
      rewardId = extractRelation(ticket.properties, 'Rewards');

      if (!rewardId) {
        // Try to find via Contacto relation
        const contactoId = extractRelation(ticket.properties, 'Contacto');
        if (contactoId) {
          const rewards = await queryNotionDatabase(
            NOTION_DBS.MANNY_REWARDS,
            { property: 'Cliente', relation: { contains: contactoId } },
            notionToken,
            1
          );
          if (rewards.length > 0) {
            rewardId = rewards[0].id;
          }
        }
      }

      if (!rewardId) {
        return skippedResponse('No Manny Reward associated with this ticket', corsHeaders);
      }
    }

    console.log(`Calculating points for reward: ${rewardId}`);

    // Get the Manny Reward page to read the Monto Total rollup
    const reward = await getNotionPage(rewardId!, notionToken);
    if (!reward) {
      return errorResponse('Reward not found', corsHeaders, 404);
    }

    const montoTotal = reward.properties['Monto Total']?.rollup?.number || 0;
    const puntos = Math.round(montoTotal * 0.05);

    console.log(`Calculated points: ${puntos}`);

    // Update the Puntos field
    await updateNotionPage(rewardId!, {
      'Puntos': { number: puntos }
    }, notionToken);

    console.log(`Updated reward ${rewardId} with ${puntos} points`);

    return successResponse({
      reward_id: rewardId,
      puntos,
      ticket_id: ticketId
    }, corsHeaders);

  } catch (error) {
    console.error('Error:', error);
    return errorResponse(error.message, corsHeaders, 500);
  }
});
