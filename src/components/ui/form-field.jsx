import React from 'react';
import { Label } from './label';
import { cn } from '@/lib/utils';

/**
 * FormField - Wrapper for form inputs with validation feedback
 *
 * @param {string} label - Label text
 * @param {string} error - Error message to display
 * @param {string} hint - Helper text below the input
 * @param {boolean} required - Show required indicator
 * @param {string} className - Additional classes
 * @param {React.ReactNode} children - Input element(s)
 */
const FormField = ({
  label,
  error,
  hint,
  required,
  className,
  htmlFor,
  children
}) => {
  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label htmlFor={htmlFor} className={cn(error && "text-red-500")}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      {children}
      {error && (
        <p className="text-sm text-red-500 flex items-center gap-1" role="alert">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4 flex-shrink-0"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="text-sm text-muted-foreground">{hint}</p>
      )}
    </div>
  );
};

export { FormField };
