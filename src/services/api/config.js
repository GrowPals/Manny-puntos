import { supabase } from '@/lib/customSupabaseClient';
import { logger } from '@/lib/logger';

// Cache local para config (evita múltiples queries)
let configCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Obtiene toda la configuración global
 * @returns {Promise<Object>} Mapa clave -> valor
 */
export const getConfigGlobal = async () => {
  // Usar cache si es válido
  if (configCache && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_TTL) {
    return configCache;
  }

  const { data, error } = await supabase
    .from('config_global')
    .select('clave, valor');

  if (error) {
    logger.error('Error loading global config', { error: error.message });
    // Retornar cache viejo si existe, o defaults
    if (configCache) return configCache;
    return getDefaultConfig();
  }

  // Convertir array a objeto
  const config = {};
  for (const row of data || []) {
    try {
      // El valor ya es JSONB, parsearlo si es string
      config[row.clave] = typeof row.valor === 'string' ? JSON.parse(row.valor) : row.valor;
    } catch {
      config[row.clave] = row.valor;
    }
  }

  // Merge con defaults para asegurar que todas las claves existen
  configCache = { ...getDefaultConfig(), ...config };
  cacheTimestamp = Date.now();

  return configCache;
};


/**
 * Valores por defecto (fallback si BD no disponible)
 */
function getDefaultConfig() {
  return {
    // Puntos
    puntos_referidor_default: 100,
    puntos_referido_default: 50,
    puntos_regalo_default: 100,

    // Vigencias
    vigencia_beneficio_dias: 365,
    vigencia_puntos_meses: 12,
    vigencia_canje_dias: 30,
    alerta_vencimiento_dias: 30,

    // Límites
    max_canjes_campana_default: 100,
    dias_expiracion_link_default: 30,

    // Presets UI
    presets_puntos: [50, 100, 200, 500],
    presets_dias_regalo: [7, 30, 90],

    // Colores
    color_tema_default: '#E91E63',
    colores_tema_opciones: ['#E91E63', '#9C27B0', '#2196F3', '#4CAF50', '#FF9800']
  };
}
