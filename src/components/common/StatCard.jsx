/**
 * Standardized StatCard component for displaying statistics
 *
 * @param {React.ComponentType} icon - Lucide icon component
 * @param {string} label - Descriptive label
 * @param {string|number} value - The statistic value to display
 * @param {string} color - Color theme: 'primary' | 'green' | 'amber' | 'red' | 'purple' (default: 'primary')
 * @param {string} className - Additional classes
 */
const StatCard = ({
  icon: Icon,
  label,
  value,
  color = 'primary',
  className = '',
}) => {
  // Map color names to Tailwind classes
  const colorClasses = {
    primary: {
      bg: 'bg-primary/10',
      text: 'text-primary',
    },
    green: {
      bg: 'bg-green-500/10',
      text: 'text-green-500',
    },
    amber: {
      bg: 'bg-amber-500/10',
      text: 'text-amber-500',
    },
    red: {
      bg: 'bg-red-500/10',
      text: 'text-red-500',
    },
    purple: {
      bg: 'bg-purple-500/10',
      text: 'text-purple-500',
    },
  };

  const colors = colorClasses[color] || colorClasses.primary;

  return (
    <div className={`bg-card rounded-xl p-4 border border-border ${className}`}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors.bg}`}
          >
            <Icon className={`w-5 h-5 ${colors.text}`} />
          </div>
        )}
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
};

export default StatCard;
