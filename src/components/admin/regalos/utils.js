/**
 * Shared utilities for admin regalos components
 */

/**
 * Format a date with time for display
 */
export const formatDateTime = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Default form values for creating a new gift link
 */
export const getDefaultLinkForm = (configDefaults) => ({
  tipo: 'servicio',
  nombre_beneficio: '',
  descripcion_beneficio: '',
  puntos_regalo: configDefaults.puntos_regalo,
  mensaje_personalizado: '',
  destinatario_telefono: '',
  dias_expiracion: configDefaults.dias_expiracion,
  es_campana: false,
  nombre_campana: '',
  max_canjes: configDefaults.max_canjes,
  terminos_condiciones: '',
  instrucciones_uso: '',
  vigencia_beneficio: configDefaults.vigencia_beneficio,
  imagen_banner: '',
  color_tema: configDefaults.color_tema
});

/**
 * Default config values (fallback)
 */
export const DEFAULT_CONFIG = {
  puntos_regalo: 100,
  dias_expiracion: 30,
  max_canjes: 100,
  vigencia_beneficio: 365,
  color_tema: '#E91E63',
  presets_puntos: [50, 100, 200, 500],
  presets_dias: [7, 30, 90],
  colores_tema: ['#E91E63', '#9C27B0', '#2196F3', '#4CAF50', '#FF9800']
};
