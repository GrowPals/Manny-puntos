import { supabase } from '@/lib/customSupabaseClient';
import { logger, EventType } from '@/lib/logger';

/**
 * Encola una operación de sincronización para procesamiento con reintentos
 * Centralizado para evitar duplicación en clients.js y gifts.js
 *
 * @param {string} operationType - Tipo de operación ('sync_cliente', 'create_benefit_ticket', etc.)
 * @param {string} resourceId - ID del recurso relacionado
 * @param {object} payload - Datos adicionales
 * @param {string} source - Origen de la operación (para debugging)
 * @returns {Promise<object>} - ID de la operación
 * @throws {Error} - Si falla el encolamiento
 */
export const enqueueSyncOperation = async (operationType, resourceId, payload = {}, source = 'app') => {
  const { data, error } = await supabase.rpc('enqueue_sync_operation', {
    p_operation_type: operationType,
    p_resource_id: resourceId,
    p_payload: payload,
    p_source: source,
    p_source_context: { timestamp: new Date().toISOString() }
  });

  if (error) {
    logger.error('Failed to enqueue sync operation', { operationType, resourceId, error: error.message }, EventType.SYNC);
    throw new Error(`Error al encolar operación de sincronización: ${error.message}`);
  }

  logger.info('Sync operation enqueued', { operationType, resourceId, operationId: data }, EventType.SYNC);
  return data;
};
