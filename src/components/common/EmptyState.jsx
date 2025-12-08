import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

/**
 * Standardized EmptyState component for consistent empty data display
 *
 * @param {React.ReactNode} icon - Lucide icon component to display
 * @param {string} title - Main heading text
 * @param {string} description - Descriptive text below the title
 * @param {string} actionLabel - Optional button text
 * @param {string} actionTo - Optional Link destination (use with actionLabel)
 * @param {function} onAction - Optional click handler (use with actionLabel, takes precedence over actionTo)
 * @param {string} actionVariant - Button variant (default: 'default')
 * @param {boolean} animate - Whether to animate entry (default: true)
 */
const EmptyState = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionTo,
  onAction,
  actionVariant = 'default',
  animate = true,
}) => {
  const content = (
    <div className="text-center py-12 bg-card rounded-xl shadow-sm border border-border">
      {Icon && (
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground/50">
          <Icon className="w-8 h-8" />
        </div>
      )}
      {title && (
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      )}
      {description && (
        <p className="text-muted-foreground text-sm mt-1 max-w-xs mx-auto">
          {description}
        </p>
      )}
      {actionLabel && (onAction || actionTo) && (
        onAction ? (
          <Button
            onClick={onAction}
            variant={actionVariant}
            className="mt-5"
            size="sm"
          >
            {actionLabel}
          </Button>
        ) : (
          <Link to={actionTo}>
            <Button variant={actionVariant} className="mt-5" size="sm">
              {actionLabel}
            </Button>
          </Link>
        )
      )}
    </div>
  );

  if (!animate) {
    return content;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      {content}
    </motion.div>
  );
};

export default EmptyState;
