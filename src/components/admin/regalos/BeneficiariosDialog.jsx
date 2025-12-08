import React from 'react';
import { Users, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import StateBadge from '@/components/common/StateBadge';
import { formatDateTime } from './utils';

/**
 * Dialog showing beneficiaries of a campaign
 */
const BeneficiariosDialog = ({
  open,
  onOpenChange,
  selectedLink,
  beneficiarios,
  isLoading
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Beneficiarios
          </DialogTitle>
          {selectedLink && (
            <DialogDescription>
              {selectedLink.nombre_campana || selectedLink.nombre_beneficio} - Código: {selectedLink.codigo}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin w-6 h-6 text-primary" />
            </div>
          ) : beneficiarios.length > 0 ? (
            <div className="space-y-3">
              {beneficiarios.map((b) => (
                <div key={b.id} className="p-3 bg-muted/30 rounded-xl border border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{b.cliente?.nombre || 'Sin nombre'}</p>
                      <p className="text-sm text-muted-foreground">{b.cliente?.telefono}</p>
                    </div>
                    <StateBadge estado={b.estado} type="beneficio" size="sm" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Canjeado: {formatDateTime(b.fecha_canje)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Aún no hay beneficiarios</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cerrar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BeneficiariosDialog;
