import React from 'react';
import {
  Megaphone,
  Coins,
  Wrench,
  Copy,
  Share2,
  ExternalLink,
  XCircle,
  Trash2,
  Users,
  Eye,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDateTime } from './utils';

/**
 * Card component for displaying a single gift link
 */
const GiftLinkCard = ({
  link,
  isExpanded,
  copiedId,
  onToggleExpand,
  onCopyLink,
  onShareWhatsApp,
  onViewBeneficiarios,
  onExpire,
  onDelete
}) => {
  const getEstadoBadge = (estado, esCampana = false, canjesRealizados = 0, maxCanjes = 0) => {
    const badges = {
      pendiente: { color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', icon: Clock, label: 'Activo' },
      canjeado: { color: 'bg-green-500/10 text-green-500 border-green-500/20', icon: CheckCircle2, label: 'Canjeado' },
      expirado: { color: 'bg-red-500/10 text-red-500 border-red-500/20', icon: XCircle, label: 'Expirado' },
      agotado: { color: 'bg-orange-500/10 text-orange-500 border-orange-500/20', icon: Users, label: 'Agotado' },
    };
    const badge = badges[estado] || badges.pendiente;
    const Icon = badge.icon;

    // Para campañas activas, mostrar progreso
    if (esCampana && estado === 'pendiente' && maxCanjes) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-blue-500/10 text-blue-500 border-blue-500/20">
          <Users className="w-3 h-3" />
          {canjesRealizados}/{maxCanjes}
        </span>
      );
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    );
  };

  const canShare = link.estado === 'pendiente' || (link.es_campana && link.estado !== 'expirado' && link.estado !== 'agotado');
  const canDelete = link.estado !== 'canjeado' && (!link.es_campana || link.canjes_realizados === 0);

  return (
    <div>
      <div
        className="p-4 hover:bg-muted/30 transition-colors cursor-pointer"
        onClick={() => link.es_campana && onToggleExpand()}
      >
        {/* Header: Código + Badges + Expand button */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-mono font-bold text-primary text-sm">
              {link.codigo}
            </span>
            {link.es_campana && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/10 text-purple-500 border border-purple-500/20">
                Campaña
              </span>
            )}
            {getEstadoBadge(link.estado, link.es_campana, link.canjes_realizados, link.max_canjes)}
          </div>
          {link.es_campana && (
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
              className="h-7 w-7 shrink-0"
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          )}
        </div>

        {/* Content: Icon + Info */}
        <div className="flex items-start gap-3">
          {/* Icono tipo */}
          <div className={`p-2 rounded-lg shrink-0 ${
            link.es_campana
              ? 'bg-purple-500/10'
              : link.tipo === 'puntos'
              ? 'bg-yellow-500/10'
              : 'bg-blue-500/10'
          }`}>
            {link.es_campana ? (
              <Megaphone className="w-4 h-4 text-purple-500" />
            ) : link.tipo === 'puntos' ? (
              <Coins className="w-4 h-4 text-yellow-500" />
            ) : (
              <Wrench className="w-4 h-4 text-blue-500" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm line-clamp-2">
              {link.es_campana && link.nombre_campana
                ? link.nombre_campana
                : link.tipo === 'puntos'
                ? `${link.puntos_regalo?.toLocaleString()} puntos`
                : link.nombre_beneficio
              }
            </p>

            {link.es_campana && link.nombre_beneficio && (
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                {link.nombre_beneficio}
              </p>
            )}

            <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
              <span>{formatDateTime(link.created_at)}</span>
              {link.veces_visto > 0 && (
                <span className="flex items-center gap-0.5">
                  <Eye className="w-3 h-3" /> {link.veces_visto}
                </span>
              )}
              {link.es_campana && (
                <span className="flex items-center gap-0.5">
                  <Users className="w-3 h-3" />
                  {link.canjes_realizados || 0} canjes
                </span>
              )}
            </div>

            {!link.es_campana && link.estado === 'canjeado' && link.canjeador && (
              <p className="text-xs text-green-600 mt-1">
                Canjeado: {link.canjeador.nombre}
              </p>
            )}
          </div>
        </div>

        {/* Actions - Full width row on mobile */}
        <div
          className="flex items-center justify-end gap-1 mt-3 pt-2 border-t border-border/50"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Ver beneficiarios (campañas) */}
          {link.es_campana && link.canjes_realizados > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onViewBeneficiarios}
              className="h-8 px-2"
            >
              <Users className="w-4 h-4 mr-1" />
              <span className="text-xs">Ver</span>
            </Button>
          )}

          {canShare && (
            <>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onCopyLink(link)}
                title="Copiar link"
                className="h-8 w-8"
              >
                {copiedId === link.id ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onShareWhatsApp(link)}
                title="Compartir"
                className="h-8 w-8"
              >
                <Share2 className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => window.open(`/g/${link.codigo}`, '_blank')}
                title="Ver página"
                className="h-8 w-8"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onExpire(link.id)}
                title="Expirar"
                className="h-8 w-8 text-orange-500 hover:text-orange-600"
              >
                <XCircle className="w-4 h-4" />
              </Button>
            </>
          )}

          {canDelete && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onDelete(link.id)}
              title="Eliminar"
              className="h-8 w-8 text-red-500 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Panel expandido para campañas */}
      {link.es_campana && isExpanded && (
        <div className="px-4 pb-4 bg-muted/20">
          <div className="p-4 rounded-xl border border-border bg-background space-y-3">
            {link.terminos_condiciones && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Términos y Condiciones:</p>
                <p className="text-sm whitespace-pre-wrap">{link.terminos_condiciones}</p>
              </div>
            )}
            {link.instrucciones_uso && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Instrucciones de uso:</p>
                <p className="text-sm">{link.instrucciones_uso}</p>
              </div>
            )}
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>Vigencia del beneficio: {link.vigencia_beneficio || 365} días</span>
              <span>Max participantes: {link.max_canjes || 'Sin límite'}</span>
            </div>
            {link.imagen_banner && (
              <img
                src={link.imagen_banner}
                alt="Banner"
                className="w-full h-24 object-cover rounded-lg"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GiftLinkCard;
