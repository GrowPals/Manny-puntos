import {
  CheckCircle,
  Clock,
  XCircle,
  Hourglass,
  PackageCheck,
  Calendar,
  AlertCircle,
  Gift,
  Loader2,
  Bookmark
} from 'lucide-react';

/**
 * Centralized StateBadge component for consistent status display
 *
 * @param {string} estado - The state to display
 * @param {string} type - Badge type: 'referral' | 'canje' | 'beneficio' | 'general'
 * @param {string} size - Size variant: 'sm' | 'md' | 'lg'
 * @param {boolean} showIcon - Whether to show the icon
 * @param {string} className - Additional CSS classes
 */
const StateBadge = ({
  estado,
  type = 'general',
  size = 'md',
  showIcon = true,
  className = ''
}) => {
  // Configuration for different state types
  const stateConfigs = {
    // Referral states
    referral: {
      activo: {
        label: 'Activo',
        icon: CheckCircle,
        bg: 'bg-green-500/10',
        text: 'text-green-600',
        darkText: 'dark:text-green-400'
      },
      pendiente: {
        label: 'Pendiente',
        icon: Clock,
        bg: 'bg-amber-500/10',
        text: 'text-amber-600',
        darkText: 'dark:text-amber-400'
      },
      expirado: {
        label: 'Expirado',
        icon: XCircle,
        bg: 'bg-red-500/10',
        text: 'text-red-600',
        darkText: 'dark:text-red-400'
      },
      cancelado: {
        label: 'Cancelado',
        icon: XCircle,
        bg: 'bg-gray-500/10',
        text: 'text-gray-600',
        darkText: 'dark:text-gray-400'
      },
    },
    // Canje (redemption) states
    canje: {
      guardado: {
        label: 'Disponible',
        icon: Bookmark,
        bg: 'bg-indigo-500/10',
        text: 'text-indigo-600',
        darkText: 'dark:text-indigo-400'
      },
      pendiente_entrega: {
        label: 'Próximo servicio',
        icon: Hourglass,
        bg: 'bg-yellow-500/10',
        text: 'text-yellow-600',
        darkText: 'dark:text-yellow-400'
      },
      entregado: {
        label: 'Entregado',
        icon: PackageCheck,
        bg: 'bg-green-500/10',
        text: 'text-green-600',
        darkText: 'dark:text-green-400'
      },
      en_lista: {
        label: 'Te contactaremos',
        icon: Hourglass,
        bg: 'bg-blue-500/10',
        text: 'text-blue-600',
        darkText: 'dark:text-blue-400'
      },
      agendado: {
        label: 'Agendado',
        icon: Calendar,
        bg: 'bg-purple-500/10',
        text: 'text-purple-600',
        darkText: 'dark:text-purple-400'
      },
      completado: {
        label: 'Completado',
        icon: CheckCircle,
        bg: 'bg-green-500/10',
        text: 'text-green-600',
        darkText: 'dark:text-green-400'
      },
      cancelado: {
        label: 'Cancelado',
        icon: XCircle,
        bg: 'bg-gray-500/10',
        text: 'text-gray-600',
        darkText: 'dark:text-gray-400'
      },
    },
    // Beneficio (benefit) states
    beneficio: {
      activo: {
        label: 'Activo',
        icon: Gift,
        bg: 'bg-green-500/10',
        text: 'text-green-600',
        darkText: 'dark:text-green-400'
      },
      usado: {
        label: 'Usado',
        icon: CheckCircle,
        bg: 'bg-blue-500/10',
        text: 'text-blue-600',
        darkText: 'dark:text-blue-400'
      },
      expirado: {
        label: 'Expirado',
        icon: XCircle,
        bg: 'bg-red-500/10',
        text: 'text-red-600',
        darkText: 'dark:text-red-400'
      },
      cancelado: {
        label: 'Cancelado',
        icon: XCircle,
        bg: 'bg-gray-500/10',
        text: 'text-gray-600',
        darkText: 'dark:text-gray-400'
      },
      pendiente: {
        label: 'Pendiente',
        icon: Clock,
        bg: 'bg-amber-500/10',
        text: 'text-amber-600',
        darkText: 'dark:text-amber-400'
      },
    },
    // General states (fallback)
    general: {
      activo: {
        label: 'Activo',
        icon: CheckCircle,
        bg: 'bg-green-500/10',
        text: 'text-green-600',
        darkText: 'dark:text-green-400'
      },
      pendiente: {
        label: 'Pendiente',
        icon: Clock,
        bg: 'bg-amber-500/10',
        text: 'text-amber-600',
        darkText: 'dark:text-amber-400'
      },
      completado: {
        label: 'Completado',
        icon: CheckCircle,
        bg: 'bg-green-500/10',
        text: 'text-green-600',
        darkText: 'dark:text-green-400'
      },
      error: {
        label: 'Error',
        icon: AlertCircle,
        bg: 'bg-red-500/10',
        text: 'text-red-600',
        darkText: 'dark:text-red-400'
      },
      loading: {
        label: 'Cargando',
        icon: Loader2,
        bg: 'bg-blue-500/10',
        text: 'text-blue-600',
        darkText: 'dark:text-blue-400',
        animate: true
      },
    },
  };

  // Get config for the current state
  const typeConfig = stateConfigs[type] || stateConfigs.general;
  const config = typeConfig[estado] || {
    label: estado || 'Desconocido',
    icon: AlertCircle,
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    darkText: ''
  };

  // Size variants
  const sizeClasses = {
    sm: {
      container: 'px-1.5 py-0.5 text-[10px]',
      icon: 'w-2.5 h-2.5',
      gap: 'gap-1'
    },
    md: {
      container: 'px-2 py-1 text-xs',
      icon: 'w-3 h-3',
      gap: 'gap-1.5'
    },
    lg: {
      container: 'px-3 py-1.5 text-sm',
      icon: 'w-4 h-4',
      gap: 'gap-2'
    }
  };

  const sizeConfig = sizeClasses[size] || sizeClasses.md;
  const Icon = config.icon;

  return (
    <span
      className={`
        inline-flex items-center ${sizeConfig.gap} ${sizeConfig.container}
        rounded-full font-medium
        ${config.bg} ${config.text} ${config.darkText}
        ${className}
      `}
      role="status"
      aria-label={`Estado: ${config.label}`}
    >
      {showIcon && Icon && (
        <Icon
          className={`${sizeConfig.icon} ${config.animate ? 'animate-spin' : ''}`}
          aria-hidden="true"
        />
      )}
      <span>{config.label}</span>
    </span>
  );
};

/**
 * Helper function to get state info without rendering
 * Useful for custom implementations
 */
export const getStateInfo = (estado, type = 'general') => {
  const configs = {
    referral: {
      activo: { label: 'Activo', color: 'green' },
      pendiente: { label: 'Pendiente', color: 'amber' },
      expirado: { label: 'Expirado', color: 'red' },
      cancelado: { label: 'Cancelado', color: 'gray' },
    },
    canje: {
      guardado: { label: 'Disponible', color: 'indigo' },
      pendiente_entrega: { label: 'Próximo servicio', color: 'yellow' },
      entregado: { label: 'Entregado', color: 'green' },
      en_lista: { label: 'Te contactaremos', color: 'blue' },
      agendado: { label: 'Agendado', color: 'purple' },
      completado: { label: 'Completado', color: 'green' },
      cancelado: { label: 'Cancelado', color: 'gray' },
    },
    beneficio: {
      activo: { label: 'Activo', color: 'green' },
      usado: { label: 'Usado', color: 'blue' },
      expirado: { label: 'Expirado', color: 'red' },
      cancelado: { label: 'Cancelado', color: 'gray' },
      pendiente: { label: 'Pendiente', color: 'amber' },
    },
  };

  const typeConfig = configs[type] || configs.referral;
  return typeConfig[estado] || { label: estado || 'Desconocido', color: 'gray' };
};

export default StateBadge;
