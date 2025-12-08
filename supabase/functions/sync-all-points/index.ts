import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  handleCors,
  getCorsHeaders,
  createSupabaseAdmin,
  getNotionToken,
  verifyAuth,
  notionRequest,
  updateNotionPage,
  NOTION_DBS,
  errorResponse,
  jsonResponse,
} from '../_shared/index.ts';

/**
 * Admin-only function for batch point sync in Notion.
 *
 * IMPORTANT: This function ONLY updates the "Puntos" field in Notion's Manny Rewards database.
 * It does NOT update Supabase's puntos_actuales - that's handled by:
 * - notion-ticket-completed webhook (asignar_puntos_atomico RPC)
 * - Direct RPC calls from the app
 *
 * This ensures NO double counting:
 * - Notion Puntos = calculated from "Monto Total" rollup (5%)
 * - Supabase puntos_actuales = accumulated via atomic RPC on each ticket completion
 *
 * Use cases:
 * - Fix discrepancies in Notion's Puntos field after manual ticket edits
 * - Recalculate after bulk imports
 * - Always run with dry_run=true first!
 */
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

    const payload = await req.json().catch(() => ({}));
    const limit = payload.limit || 50;
    const dryRun = payload.dry_run ?? false;
    const startCursor = payload.start_cursor || undefined;

    console.log(`Syncing points - limit: ${limit}, dry_run: ${dryRun}`);

    // Query Manny Rewards database
    const queryBody: Record<string, unknown> = { page_size: Math.min(limit, 100) };
    if (startCursor) {
      queryBody.start_cursor = startCursor;
    }

    const rewardsResponse = await notionRequest<{
      results: Array<{ id: string; properties: Record<string, any> }>;
      has_more: boolean;
      next_cursor: string | null;
    }>(
      `/databases/${NOTION_DBS.MANNY_REWARDS}/query`,
      'POST',
      queryBody,
      notionToken
    );

    const results: Array<Record<string, unknown>> = [];
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const reward of rewardsResponse.results) {
      const rewardId = reward.id;
      const nombre = reward.properties['Nombre']?.title?.[0]?.plain_text || 'Sin nombre';
      const montoTotal = reward.properties['Monto Total']?.rollup?.number || 0;
      const currentPuntos = reward.properties['Puntos']?.number || 0;
      const calculatedPuntos = Math.round(montoTotal * 0.05);

      if (currentPuntos === calculatedPuntos) {
        results.push({
          nombre,
          status: 'no_change',
          puntos: currentPuntos
        });
        skipped++;
        continue;
      }

      if (dryRun) {
        results.push({
          nombre,
          status: 'would_update',
          from: currentPuntos,
          to: calculatedPuntos,
          monto_total: montoTotal
        });
        updated++;
      } else {
        try {
          await updateNotionPage(rewardId, {
            'Puntos': { number: calculatedPuntos }
          }, notionToken);

          results.push({
            nombre,
            status: 'updated',
            from: currentPuntos,
            to: calculatedPuntos
          });
          updated++;

          // Rate limiting delay
          await new Promise(resolve => setTimeout(resolve, 350));
        } catch (e) {
          results.push({
            nombre,
            status: 'error',
            error: (e as Error).message
          });
          errors++;
        }
      }
    }

    return jsonResponse({
      status: dryRun ? 'dry_run' : 'completed',
      total_processed: rewardsResponse.results.length,
      updated,
      skipped,
      errors,
      has_more: rewardsResponse.has_more,
      next_cursor: rewardsResponse.next_cursor,
      results: results.slice(0, 20) // Only show first 20 for brevity
    }, corsHeaders);

  } catch (error) {
    console.error('Error:', error);
    return errorResponse((error as Error).message, corsHeaders, 500);
  }
});
