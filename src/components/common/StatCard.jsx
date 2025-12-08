import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

/**
 * Unified StatCard component for displaying statistics
 *
 * @param {React.ComponentType} icon - Lucide icon component
 * @param {string} label - Descriptive label
 * @param {string|number} value - The statistic value to display
 * @param {string} color - Color theme: 'primary' | 'green' | 'amber' | 'red' | 'purple' | 'blue' (default: 'primary')
 * @param {string} className - Additional classes
 * @param {number} trend - Optional percentage trend (shows up/down arrow)
 * @param {string} subtitle - Optional subtitle text below value
 * @param {string} to - Optional link destination (makes card clickable)
 * @param {string} subtext - Optional subtext with dot indicator
 * @param {'default' | 'compact' | 'accent'} variant - Visual variant
 */
const StatCard = ({
  icon: Icon,
  label,
  value,
  color = 'primary',
  className = '',
  trend,
  subtitle,
  to,
  subtext,
  variant = 'default',
}) => {
  // Map color names to Tailwind classes
  const colorClasses = {
    primary: {
      bg: 'bg-primary/10',
      text: 'text-primary',
      accent: 'bg-primary',
    },
    green: {
      bg: 'bg-green-500/10',
      text: 'text-green-500',
      accent: 'bg-green-500',
    },
    amber: {
      bg: 'bg-amber-500/10',
      text: 'text-amber-500',
      accent: 'bg-amber-500',
    },
    red: {
      bg: 'bg-red-500/10',
      text: 'text-red-500',
      accent: 'bg-red-500',
    },
    purple: {
      bg: 'bg-purple-500/10',
      text: 'text-purple-500',
      accent: 'bg-purple-500',
    },
    blue: {
      bg: 'bg-blue-500/10',
      text: 'text-blue-500',
      accent: 'bg-blue-500',
    },
    gray: {
      bg: 'bg-gray-500/10',
      text: 'text-foreground',
      accent: 'bg-gray-500',
    },
  };

  const colors = colorClasses[color] || colorClasses.primary;

  // Accent variant (used in AdminClientes)
  if (variant === 'accent') {
    return (
      <div className={`relative bg-card rounded-xl p-4 border border-border overflow-hidden group hover:border-border/80 transition-colors ${className}`}>
        {/* Subtle gradient accent */}
        <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-10 -translate-y-1/2 translate-x-1/2 ${colors.accent}`} />

        <div className="relative flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">{label}</p>
            <p className={`text-3xl font-bold ${colors.text} tabular-nums`}>{value}</p>
            {subtext && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-current opacity-50" />
                {subtext}
              </p>
            )}
          </div>
          {Icon && (
            <div className={`p-2.5 rounded-xl ${colors.text} bg-current/10 flex-shrink-0`}>
              <Icon className="w-5 h-5" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Default variant with optional motion, trend, subtitle, and link
  const content = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-card rounded-xl p-4 border border-border hover:shadow-md hover:border-primary/30 transition-all duration-200 h-full ${to ? 'cursor-pointer' : ''} ${className}`}
    >
      <div className="flex items-center gap-2 mb-2">
        {Icon && (
          variant === 'compact' ? (
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors.bg}`}>
              <Icon className={`w-5 h-5 ${colors.text}`} />
            </div>
          ) : (
            <Icon className={`w-5 h-5 ${colors.text}`} />
          )
        )}
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
          {(subtitle || subtext) && (
            <p className="text-xs text-muted-foreground mt-0.5 min-h-[1rem]">
              {subtitle || subtext || '\u00A0'}
            </p>
          )}
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-0.5 text-sm font-medium ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {trend >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
    </motion.div>
  );

  return to ? <Link to={to}>{content}</Link> : content;
};

export default StatCard;
