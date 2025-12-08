import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  handleCors,
  getCorsHeaders,
  createSupabaseAdmin,
  getNotionToken,
  notionRequest,
  getNotionPage,
  queryNotionDatabase,
  createNotionPage,
  updateNotionPage,
  extractNumber,
  extractRelation,
  extractTitle,
  extractPhoneNumber,
  extractEmail,
  extractRichText,
  handleNotionChallenge,
  verifyWebhookSecret,
  withRetry,
  NOTION_DBS,
  errorResponse,
  successResponse,
  skippedResponse,
  type WebhookPayload,
} from '../_shared/index.ts';

// Operation tracking for partial failure recovery
interface OperationResult {
  step: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

// Track completed operations for logging/debugging
const completedOps: OperationResult[] = [];

// Ticket-specific extractors
function extractTicketName(properties: Record<string, any>): string {
  // Try different possible title field names
  for (const fieldName of ['Ticket ', 'Ticket', 'title']) {
    const field = properties[fieldName];
    if (field?.title && field.title.length > 0) {
      return field.title.map((t: any) => t.plain_text).join('') || 'Ticket';
    }
  }
  return 'Ticket';
}

async function getContactoDetails(contactoId: string, notionToken: string) {
  const page = await getNotionPage(contactoId, notionToken);
  if (!page) throw new Error(`Contacto ${contactoId} not found`);

  return {
    nombre: extractTitle(page.properties),
    telefono: extractPhoneNumber(page.properties),
    email: extractEmail(page.properties),
    supabaseId: extractRichText(page.properties, 'Supabase ID'),
  };
}

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const notionToken = getNotionToken();

    const payload: WebhookPayload = await req.json();
    console.log('Ticket completed webhook:', JSON.stringify(payload, null, 2));

    // Handle Notion challenge
    const challengeResponse = handleNotionChallenge(payload, corsHeaders);
    if (challengeResponse) return challengeResponse;

    // Extract ticket page ID
    const ticketId = payload.data?.id || payload.id || (payload as any).page_id;
    if (!ticketId) {
      return errorResponse('No ticket ID found', corsHeaders, 400);
    }

    // Get ticket details
    const ticket = await getNotionPage(ticketId, notionToken);
    if (!ticket) {
      return errorResponse('Ticket not found', corsHeaders, 404);
    }

    const properties = ticket.properties;
    const ticketName = extractTicketName(properties);
    const monto = extractNumber(properties, 'Monto');
    const contactoId = extractRelation(properties, 'Contacto');
    const esMannyReward = properties['Manny Rewards']?.checkbox || false;

    console.log(`Ticket: ${ticketName}, Monto: ${monto}, Contacto: ${contactoId}, Es Manny Reward: ${esMannyReward}`);

    if (!contactoId) {
      return skippedResponse('No contacto linked to ticket', corsHeaders);
    }

    // Check idempotency
    const { data: existingEvent } = await supabase
      .from('ticket_events')
      .select('id')
      .eq('source', 'notion')
      .eq('source_id', ticketId)
      .eq('event_type', 'ticket_completed')
      .single();

    if (existingEvent) {
      console.log('Ticket already processed');
      return skippedResponse('already processed', corsHeaders);
    }

    // Find or create Manny Reward (with retry)
    let rewardId = extractRelation(properties, 'Rewards');

    if (!rewardId) {
      // Try to find existing reward by contacto
      rewardId = await withRetry(async () => {
        const rewards = await queryNotionDatabase(
          NOTION_DBS.MANNY_REWARDS,
          { property: 'Cliente', relation: { contains: contactoId } },
          notionToken,
          1
        );

        if (rewards.length > 0) {
          return rewards[0].id;
        }

        // Create new Manny Reward
        const { nombre } = await getContactoDetails(contactoId, notionToken);
        const rewardPage = await createNotionPage(NOTION_DBS.MANNY_REWARDS, {
          'Nombre': { title: [{ text: { content: nombre } }] },
          'Cliente': { relation: [{ id: contactoId }] },
          'Nivel': { select: { name: 'Partner' } },
          'Puntos': { number: 0 }
        }, notionToken);
        console.log(`Created Manny Reward: ${rewardPage.id}`);
        return rewardPage.id;
      }, { maxAttempts: 3 });

      // Link ticket to reward (with retry)
      await withRetry(async () => {
        await updateNotionPage(ticketId, {
          'Rewards': { relation: [{ id: rewardId }] }
        }, notionToken);
        console.log(`Linked ticket ${ticketId} to reward ${rewardId}`);
      }, { maxAttempts: 2 });
    }

    // Wait for Notion rollup to update, with polling instead of fixed delay
    let montoTotal = 0;
    let puntos = 0;

    await withRetry(async () => {
      const reward = await getNotionPage(rewardId, notionToken);
      montoTotal = reward?.properties['Monto Total']?.rollup?.number || 0;
      puntos = Math.round(montoTotal * 0.05);

      await updateNotionPage(rewardId, {
        'Puntos': { number: puntos }
      }, notionToken);
      console.log(`Updated reward ${rewardId}: Monto Total = ${montoTotal}, Puntos (5%) = ${puntos}`);
    }, { maxAttempts: 3, baseDelayMs: 800 });

    // Record event to prevent duplicates (with retry)
    await withRetry(async () => {
      const { error } = await supabase.from('ticket_events').insert({
        source: 'notion',
        source_id: ticketId,
        event_type: 'ticket_completed',
        payload: { ticket_name: ticketName, monto, contacto_id: contactoId, reward_id: rewardId, puntos },
        status: 'processed'
      });
      if (error) throw error;
    }, { maxAttempts: 2 });

    // Get contact details and find/create Supabase client
    const { nombre, telefono, email, supabaseId } = await getContactoDetails(contactoId, notionToken);

    let clienteId: string | null = null;
    let clienteCreated = false;

    if (telefono) {
      // Try to find client by Supabase ID first, then by phone (with retry)
      let cliente = await withRetry(async () => {
        if (supabaseId) {
          const { data, error } = await supabase
            .from('clientes')
            .select('id, puntos_actuales, notion_page_id')
            .eq('id', supabaseId)
            .single();
          if (data) return data;
        }

        const { data } = await supabase
          .from('clientes')
          .select('id, puntos_actuales, notion_page_id')
          .eq('telefono', telefono)
          .single();
        return data;
      }, { maxAttempts: 2 });

      if (!cliente) {
        // Create new client in Supabase (with retry)
        const newCliente = await withRetry(async () => {
          const { data, error } = await supabase
            .from('clientes')
            .insert({
              nombre,
              telefono,
              puntos_actuales: 0,
              nivel: 'partner',
              es_admin: false,
              notion_page_id: contactoId,
              notion_reward_id: rewardId,
              last_sync_at: new Date().toISOString()
            })
            .select()
            .single();

          if (error) throw error;
          return data;
        }, { maxAttempts: 2 });

        if (newCliente) {
          cliente = newCliente;
          clienteCreated = true;
          console.log(`Created new client in Supabase: ${newCliente.id}`);

          // Update Notion Contacto with Supabase ID (fire and forget with retry)
          withRetry(async () => {
            await updateNotionPage(contactoId, {
              'Supabase ID': { rich_text: [{ text: { content: newCliente.id } }] }
            }, notionToken);
          }, { maxAttempts: 2 }).catch(e => console.warn('Failed to update Notion with Supabase ID:', e));
        }
      } else {
        // Update existing client with Notion references if missing
        const updates: Record<string, unknown> = { last_sync_at: new Date().toISOString() };
        if (!cliente.notion_page_id) updates.notion_page_id = contactoId;

        await withRetry(async () => {
          const { error } = await supabase.from('clientes').update(updates).eq('id', cliente.id);
          if (error) throw error;
        }, { maxAttempts: 2 });

        // Update Notion Contacto with Supabase ID if not set (fire and forget)
        if (!supabaseId) {
          withRetry(async () => {
            await updateNotionPage(contactoId, {
              'Supabase ID': { rich_text: [{ text: { content: cliente.id } }] }
            }, notionToken);
          }, { maxAttempts: 2 }).catch(e => console.warn('Failed to update Notion with Supabase ID:', e));
        }
      }

      if (cliente) {
        clienteId = cliente.id;

        // Only accumulate points if NOT a Manny Rewards ticket (canje)
        if (!esMannyReward) {
          const puntosTicket = Math.round(monto * 0.05);

          if (puntosTicket > 0) {
            // Asignar puntos with retry (critical operation)
            await withRetry(async () => {
              const { error } = await supabase.rpc('asignar_puntos_atomico', {
                p_cliente_telefono: telefono,
                p_puntos_a_sumar: puntosTicket,
                p_concepto: `Ticket completado: ${ticketName} - $${monto} (5%)`
              });
              if (error) throw error;
            }, { maxAttempts: 3 });

            // Send push notification (fire and forget)
            fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                tipo: 'puntos_recibidos',
                cliente_id: cliente.id,
                data: { puntos: puntosTicket, concepto: ticketName },
                url: '/dashboard'
              }),
            }).catch(e => console.warn('Push notification failed:', e));
          }
        } else {
          console.log(`Ticket ${ticketId} es Manny Reward - NO se acumulan puntos`);
        }
      }
    }

    // Check if this ticket is linked to a beneficio_cliente and mark it as used
    let beneficioUsado = false;
    if (esMannyReward) {
      // Check beneficios_cliente table (with retry)
      const beneficio = await withRetry(async () => {
        const { data } = await supabase
          .from('beneficios_cliente')
          .select('id, estado')
          .eq('notion_ticket_id', ticketId)
          .eq('estado', 'activo')
          .single();
        return data;
      }, { maxAttempts: 2 });

      if (beneficio) {
        await withRetry(async () => {
          const { error } = await supabase
            .from('beneficios_cliente')
            .update({
              estado: 'usado',
              fecha_uso: new Date().toISOString()
            })
            .eq('id', beneficio.id);
          if (error) throw error;
        }, { maxAttempts: 2 });

        beneficioUsado = true;
        console.log(`Marked beneficio ${beneficio.id} as used`);
      }

      // Also check canjes table for service canjes (with retry)
      const canje = await withRetry(async () => {
        const { data } = await supabase
          .from('canjes')
          .select('id, estado')
          .eq('notion_ticket_id', ticketId)
          .in('estado', ['guardado', 'en_lista', 'agendado'])
          .single();
        return data;
      }, { maxAttempts: 2 });

      if (canje) {
        await withRetry(async () => {
          const { error } = await supabase
            .from('canjes')
            .update({
              estado: 'completado',
              fecha_entrega: new Date().toISOString()
            })
            .eq('id', canje.id);
          if (error) throw error;
        }, { maxAttempts: 2 });

        console.log(`Marked canje ${canje.id} as completado`);
      }
    }

    return successResponse({
      ticket_id: ticketId,
      ticket_name: ticketName,
      monto,
      reward_id: rewardId,
      puntos_totales: puntos,
      cliente_id: clienteId,
      cliente_created: clienteCreated,
      contacto_id: contactoId,
      beneficio_usado: beneficioUsado
    }, corsHeaders);

  } catch (error) {
    console.error('Error:', error);
    return errorResponse(error.message, corsHeaders, 500);
  }
});
