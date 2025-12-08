import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * PageHeader - Componente de diseño unificado para encabezados de página
 *
 * Principios UX/UI aplicados:
 * - Jerarquía visual clara con tamaños tipográficos consistentes
 * - Espaciado equilibrado para mejor legibilidad
 * - Iconografía integrada para reforzar contexto
 * - Animaciones sutiles para mejorar percepción de rendimiento
 * - Responsive design mobile-first
 * - Soporte para acciones secundarias (botones)
 */

const PageHeader = ({
  icon: Icon,
  title,
  subtitle,
  children, // Para acciones/botones adicionales
  className,
  iconClassName,
  animated = true,
}) => {
  const Wrapper = animated ? motion.div : 'div';
  const animationProps = animated ? {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, ease: 'easeOut' }
  } : {};

  return (
    <Wrapper
      {...animationProps}
      className={cn(
        'flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6',
        className
      )}
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <div className={cn(
            'w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0',
            iconClassName
          )}>
            <Icon className="w-6 h-6 text-primary" />
          </div>
        )}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {children && (
        <div className="w-full md:w-auto flex-shrink-0">
          {children}
        </div>
      )}
    </Wrapper>
  );
};

export { PageHeader };
