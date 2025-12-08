import React, { useState, useEffect } from 'react';
import {
  Loader2,
  ImagePlus,
  X,
  Pencil
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

const COLORES_TEMA = ['#E91E63', '#9C27B0', '#3F51B5', '#2196F3', '#009688', '#FF9800'];

/**
 * Dialog for editing existing gift links/campaigns
 */
const EditGiftDialog = ({
  open,
  onOpenChange,
  link,
  onSave,
  isSaving,
  isUploadingBanner
}) => {
  const [formData, setFormData] = useState({});
  const [bannerPreview, setBannerPreview] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);

  // Initialize form when link changes
  useEffect(() => {
    if (link) {
      setFormData({
        nombre_beneficio: link.nombre_beneficio || '',
        descripcion_beneficio: link.descripcion_beneficio || '',
        mensaje_personalizado: link.mensaje_personalizado || '',
        nombre_campana: link.nombre_campana || '',
        terminos_condiciones: link.terminos_condiciones || '',
        instrucciones_uso: link.instrucciones_uso || '',
        imagen_banner: link.imagen_banner || '',
        color_tema: link.color_tema || '#E91E63',
        max_canjes: link.max_canjes || 0,
      });
      setBannerPreview(link.imagen_banner || null);
      setBannerFile(null);
    }
  }, [link]);

  const handleBannerSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      alert('Tipo de archivo no válido. Usa JPG, PNG, WebP o GIF');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('El archivo es muy grande. Máximo 5MB');
      return;
    }

    setBannerFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setBannerPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleRemoveBanner = () => {
    setBannerFile(null);
    setBannerPreview(null);
    setFormData({ ...formData, imagen_banner: '' });
  };

  const handleSave = () => {
    onSave(formData, bannerFile);
  };

  if (!link) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Pencil className="w-5 h-5" />
            Editar {link.es_campana ? 'Campaña' : 'Link'}
          </DialogTitle>
          <DialogDescription>
            Código: <span className="font-mono font-bold text-primary">{link.codigo}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Nombre campaña (solo campañas) */}
          {link.es_campana && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nombre de la campaña</label>
              <Input
                value={formData.nombre_campana}
                onChange={(e) => setFormData({ ...formData, nombre_campana: e.target.value })}
                placeholder="Nombre de la campaña"
              />
            </div>
          )}

          {/* Nombre beneficio (servicios) */}
          {link.tipo === 'servicio' && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nombre del servicio</label>
              <Input
                value={formData.nombre_beneficio}
                onChange={(e) => setFormData({ ...formData, nombre_beneficio: e.target.value })}
                placeholder="Nombre del servicio"
              />
            </div>
          )}

          {/* Descripción (servicios) */}
          {link.tipo === 'servicio' && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Descripción</label>
              <textarea
                value={formData.descripcion_beneficio}
                onChange={(e) => setFormData({ ...formData, descripcion_beneficio: e.target.value })}
                placeholder="Qué incluye el servicio..."
                className="w-full h-20 p-2.5 rounded-lg bg-background border border-border text-foreground resize-none text-sm"
              />
            </div>
          )}

          {/* Mensaje personalizado */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Mensaje personalizado</label>
            <textarea
              value={formData.mensaje_personalizado}
              onChange={(e) => setFormData({ ...formData, mensaje_personalizado: e.target.value })}
              placeholder="Un mensaje especial..."
              className="w-full h-16 p-2.5 rounded-lg bg-background border border-border text-foreground resize-none text-sm"
            />
          </div>

          {/* Campos extra para campañas */}
          {link.es_campana && (
            <>
              {/* Max canjes */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Máx. participantes</label>
                <Input
                  type="number"
                  value={formData.max_canjes}
                  onChange={(e) => setFormData({ ...formData, max_canjes: Math.max(0, parseInt(e.target.value) || 0) })}
                  min={link.canjes_realizados || 0}
                />
                {link.canjes_realizados > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Ya hay {link.canjes_realizados} canjes, no puedes poner un límite menor.
                  </p>
                )}
              </div>

              {/* Términos y condiciones */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Términos y condiciones</label>
                <textarea
                  value={formData.terminos_condiciones}
                  onChange={(e) => setFormData({ ...formData, terminos_condiciones: e.target.value })}
                  placeholder="• Condición 1&#10;• Condición 2"
                  className="w-full h-20 p-2.5 rounded-lg bg-background border border-border text-foreground resize-none text-sm"
                />
              </div>

              {/* Instrucciones de uso */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Instrucciones de uso</label>
                <Input
                  value={formData.instrucciones_uso}
                  onChange={(e) => setFormData({ ...formData, instrucciones_uso: e.target.value })}
                  placeholder="Cómo usar el beneficio..."
                />
              </div>

              {/* Color del tema */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Color del tema</label>
                <div className="flex gap-2">
                  {COLORES_TEMA.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color_tema: color })}
                      className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                        formData.color_tema === color ? 'border-foreground scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Banner de campaña */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  Banner de campaña
                  <span className="text-muted-foreground/70 ml-1">(recomendado: menos de 500KB para previews de WhatsApp)</span>
                </label>
                {bannerPreview ? (
                  <div className="relative">
                    <img
                      src={bannerPreview}
                      alt="Preview del banner"
                      className="w-full h-32 object-cover rounded-lg border border-border"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveBanner}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                    <ImagePlus className="w-8 h-8 text-muted-foreground mb-2" />
                    <span className="text-xs text-muted-foreground">Clic para subir imagen</span>
                    <span className="text-xs text-muted-foreground/70">JPG, PNG, WebP o GIF (máx 5MB)</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleBannerSelect}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 mt-4">
          <DialogClose asChild>
            <Button variant="outline" size="sm">Cancelar</Button>
          </DialogClose>
          <Button
            onClick={handleSave}
            disabled={isSaving || isUploadingBanner}
            size="sm"
          >
            {(isSaving || isUploadingBanner) && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
            {isUploadingBanner ? 'Subiendo imagen...' : 'Guardar cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditGiftDialog;
