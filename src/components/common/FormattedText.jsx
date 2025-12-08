import React from 'react';
import { Check, X } from 'lucide-react';

/**
 * Componente para renderizar texto con formato básico
 * Soporta:
 * - Líneas que empiezan con • o - como bullets
 * - Líneas que empiezan con ✓ o ✔ como checks verdes
 * - Líneas que empiezan con ✗ o × como X rojas
 * - Líneas que empiezan con número. como lista numerada
 * - **texto** como negrita
 * - Saltos de línea
 */
const FormattedText = ({ text, className = '' }) => {
  if (!text) return null;

  const lines = text.split('\n');

  const renderLine = (line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return <br key={index} />;

    // Detectar tipo de línea
    const isBullet = /^[•\-]\s/.test(trimmed);
    const isCheck = /^[✓✔]\s/.test(trimmed);
    const isX = /^[✗×]\s/.test(trimmed);
    const isNumbered = /^\d+\.\s/.test(trimmed);

    // Limpiar el prefijo
    let content = trimmed;
    if (isBullet || isCheck || isX) {
      content = trimmed.slice(2);
    } else if (isNumbered) {
      content = trimmed.replace(/^\d+\.\s/, '');
    }

    // Procesar negrita **texto**
    const parts = content.split(/(\*\*[^*]+\*\*)/g);
    const rendered = parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });

    // Renderizar según tipo
    if (isCheck) {
      return (
        <div key={index} className="flex items-start gap-2 py-1">
          <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
          <span>{rendered}</span>
        </div>
      );
    }

    if (isX) {
      return (
        <div key={index} className="flex items-start gap-2 py-1">
          <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <span>{rendered}</span>
        </div>
      );
    }

    if (isBullet) {
      return (
        <div key={index} className="flex items-start gap-2 py-1">
          <span className="text-primary mt-0.5">•</span>
          <span>{rendered}</span>
        </div>
      );
    }

    if (isNumbered) {
      const num = trimmed.match(/^(\d+)\./)[1];
      return (
        <div key={index} className="flex items-start gap-2 py-1">
          <span className="text-primary font-medium min-w-[1.25rem]">{num}.</span>
          <span>{rendered}</span>
        </div>
      );
    }

    // Línea normal
    return <p key={index} className="py-1">{rendered}</p>;
  };

  return (
    <div className={`text-sm leading-relaxed ${className}`}>
      {lines.map(renderLine)}
    </div>
  );
};

export default FormattedText;
