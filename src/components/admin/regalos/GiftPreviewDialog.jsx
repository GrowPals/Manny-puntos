import React from 'react';
import { Gift, Smartphone, Sparkles, Loader2 } from 'lucide-react';
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

/**
 * Dialog showing a mobile preview of the campaign landing page
 */
const GiftPreviewDialog = ({
  open,
  onOpenChange,
  newLink,
  bannerPreview,
  onCreate,
  isCreating,
  isUploadingBanner
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b border-border">
          <DialogTitle className="text-lg flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            Vista previa
          </DialogTitle>
          <DialogDescription>
            Así se verá tu campaña en el celular
          </DialogDescription>
        </DialogHeader>

        {/* Simulación de pantalla móvil */}
        <div className="bg-gradient-to-br from-background via-background to-primary/5 p-6 max-h-[60vh] overflow-y-auto">
          <div className="text-center">
            {/* Banner preview */}
            {bannerPreview ? (
              <div className="mb-6 rounded-2xl overflow-hidden shadow-xl">
                <img
                  src={bannerPreview}
                  alt="Preview"
                  className="w-full h-40 object-cover"
                />
              </div>
            ) : (
              <div
                className="mb-6 w-32 h-32 mx-auto rounded-3xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(to bottom right, ${newLink.color_tema || '#E91E63'}, #9C27B0)`
                }}
              >
                <Gift className="w-16 h-16 text-white" />
              </div>
            )}

            {/* Título */}
            <h2 className="text-2xl font-bold mb-2">
              {newLink.es_campana && newLink.nombre_campana
                ? newLink.nombre_campana
                : '¡Tienes un regalo!'}
            </h2>

            {/* Mensaje */}
            <p className="text-muted-foreground mb-6">
              {newLink.mensaje_personalizado || 'Alguien especial te envió algo...'}
            </p>

            {/* Beneficio */}
            <div
              className="rounded-xl p-4 mb-4 border"
              style={{
                background: `linear-gradient(to right, ${newLink.color_tema || '#E91E63'}15, #9C27B015)`,
                borderColor: `${newLink.color_tema || '#E91E63'}30`
              }}
            >
              {newLink.tipo === 'puntos' ? (
                <>
                  <p className="text-3xl font-black" style={{ color: newLink.color_tema || '#E91E63' }}>
                    {newLink.puntos_regalo?.toLocaleString() || '0'}
                  </p>
                  <p className="text-sm text-foreground">Puntos Manny</p>
                </>
              ) : (
                <>
                  <p className="font-bold text-foreground">
                    {newLink.nombre_beneficio || 'Nombre del servicio'}
                  </p>
                  {newLink.descripcion_beneficio && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {newLink.descripcion_beneficio}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Botón simulado */}
            <div
              className="py-3 px-6 rounded-xl text-white font-medium"
              style={{
                background: `linear-gradient(to right, ${newLink.color_tema || '#E91E63'}, #9C27B0)`
              }}
            >
              <Sparkles className="w-4 h-4 inline mr-2" />
              {newLink.es_campana ? 'Ver mi regalo' : 'Abrir regalo'}
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 border-t border-border">
          <DialogClose asChild>
            <Button variant="outline" size="sm">Cerrar</Button>
          </DialogClose>
          <Button
            size="sm"
            onClick={() => {
              onOpenChange(false);
              onCreate();
            }}
            disabled={isCreating || isUploadingBanner}
          >
            {(isCreating || isUploadingBanner) && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
            Crear campaña
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GiftPreviewDialog;
