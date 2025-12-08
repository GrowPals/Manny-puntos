import { supabase } from '@/lib/customSupabaseClient';

/**
 * Encola una operación de sincronización para procesamiento con reintentos
 * Centralizado para evitar duplicación en clients.js y gifts.js
 *
 * @param {string} operationType - Tipo de operación ('sync_cliente', 'create_benefit_ticket', etc.)
 * @param {string} resourceId - ID del recurso relacionado
 * @param {object} payload - Datos adicionales
 * @param {string} source - Origen de la operación (para debugging)
 * @returns {Promise<object|null>} - ID de la operación o null si falló
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
    console.error('Failed to enqueue sync operation:', error);
    return null;
  }

  return data;
};
