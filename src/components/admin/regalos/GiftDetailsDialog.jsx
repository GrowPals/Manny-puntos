import React from 'react';
import { Gift, Megaphone, Copy, Share2, Download } from 'lucide-react';
import QRCodeSVG from 'react-qr-code';
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
 * Dialog showing gift link details with QR code and sharing options
 */
const GiftDetailsDialog = ({
  open,
  onOpenChange,
  selectedLink,
  onCopyLink,
  onShareWhatsApp
}) => {
  const handleDownloadQR = () => {
    if (!selectedLink) return;

    const svg = document.querySelector(`#qr-${selectedLink.codigo} svg`);
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const link = document.createElement('a');
      link.download = `qr-${selectedLink.codigo}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            {selectedLink?.es_campana ? (
              <Megaphone className="w-5 h-5 text-primary" />
            ) : (
              <Gift className="w-5 h-5 text-primary" />
            )}
            {selectedLink?.es_campana ? 'Campaña Creada' : 'Link de Regalo Creado'}
          </DialogTitle>
          <DialogDescription>
            Comparte este link para otorgar el beneficio
          </DialogDescription>
        </DialogHeader>

        {selectedLink && (
          <div className="space-y-4 py-4">
            {selectedLink.es_campana && selectedLink.nombre_campana && (
              <p className="text-center font-medium text-lg">{selectedLink.nombre_campana}</p>
            )}

            {/* QR Code */}
            <div className="flex justify-center">
              <div id={`qr-${selectedLink.codigo}`} className="bg-white p-4 rounded-xl">
                <QRCodeSVG
                  value={`${window.location.origin}/g/${selectedLink.codigo}`}
                  size={180}
                  level="H"
                  includeMargin={false}
                />
              </div>
            </div>

            <div className="bg-primary/5 rounded-xl p-4 border border-primary/20 text-center">
              <p className="text-xs text-muted-foreground mb-1">Código</p>
              <p className="text-2xl font-mono font-bold text-primary">
                {selectedLink.codigo}
              </p>
            </div>

            <div className="bg-muted/30 rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">Link completo</p>
              <p className="text-sm font-mono break-all">
                {selectedLink.url || `${window.location.origin}/g/${selectedLink.codigo}`}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button onClick={() => onCopyLink(selectedLink)}>
                <Copy className="w-4 h-4 mr-2" />
                Copiar
              </Button>
              <Button
                variant="outline"
                onClick={() => onShareWhatsApp(selectedLink)}
              >
                <Share2 className="w-4 h-4 mr-2" />
                WhatsApp
              </Button>
              <Button
                variant="outline"
                onClick={handleDownloadQR}
              >
                <Download className="w-4 h-4 mr-2" />
                QR
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cerrar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GiftDetailsDialog;
