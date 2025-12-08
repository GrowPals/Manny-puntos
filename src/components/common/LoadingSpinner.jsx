import { Loader2 } from 'lucide-react';

/**
 * Standardized LoadingSpinner component for consistent loading states
 *
 * @param {string} size - Size variant: 'sm' | 'md' | 'lg' (default: 'md')
 * @param {boolean} fullPage - If true, centers in viewport with more padding
 * @param {string} className - Additional classes to apply
 */
const LoadingSpinner = ({ size = 'md', fullPage = false, className = '' }) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  const paddingClasses = {
    sm: 'py-8',
    md: 'py-12',
    lg: 'py-20',
  };

  const containerClass = fullPage
    ? 'flex justify-center items-center min-h-[50vh]'
    : `text-center ${paddingClasses[size]}`;

  return (
    <div className={`${containerClass} ${className}`}>
      <Loader2
        className={`${sizeClasses[size]} animate-spin text-primary mx-auto`}
      />
    </div>
  );
};

export default LoadingSpinner;
