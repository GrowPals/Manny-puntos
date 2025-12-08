import React from 'react';
import {
  Gift,
  Loader2,
  Coins,
  Wrench,
  Megaphone,
  ChevronDown,
  ImagePlus,
  X,
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { VALIDATION } from '@/config';

/**
 * Dialog for creating new gift links (single or campaign)
 */
const CreateGiftDialog = ({
  open,
  onOpenChange,
  newLink,
  setNewLink,
  configDefaults,
  bannerPreview,
  onBannerSelect,
  onRemoveBanner,
  onShowPreview,
  onCreate,
  isCreating,
  isUploadingBanner
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Nuevo Link de Regalo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tipo toggle compacto */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setNewLink({ ...newLink, es_campana: false })}
              className={`p-3 rounded-xl border-2 transition-all text-center ${
                !newLink.es_campana
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <Gift className={`w-5 h-5 mx-auto mb-1 ${!newLink.es_campana ? 'text-primary' : 'text-muted-foreground'}`} />
              <p className="font-medium text-sm">Link único</p>
            </button>
            <button
              type="button"
              onClick={() => setNewLink({ ...newLink, es_campana: true })}
              className={`p-3 rounded-xl border-2 transition-all text-center ${
                newLink.es_campana
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <Megaphone className={`w-5 h-5 mx-auto mb-1 ${newLink.es_campana ? 'text-primary' : 'text-muted-foreground'}`} />
              <p className="font-medium text-sm">Campaña</p>
            </button>
          </div>

          {/* Nombre campaña */}
          {newLink.es_campana && (
            <Input
              value={newLink.nombre_campana}
              onChange={(e) => setNewLink({ ...newLink, nombre_campana: e.target.value })}
              placeholder="Nombre de la campaña *"
            />
          )}

          {/* Tipo de regalo - inline */}
          <div className="flex items-center gap-2 p-1 bg-muted/50 rounded-lg">
            <button
              type="button"
              onClick={() => setNewLink({ ...newLink, tipo: 'servicio' })}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                newLink.tipo === 'servicio'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Wrench className="w-4 h-4" />
              Servicio
            </button>
            <button
              type="button"
              onClick={() => setNewLink({ ...newLink, tipo: 'puntos' })}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                newLink.tipo === 'puntos'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Coins className="w-4 h-4" />
              Puntos
            </button>
          </div>

          {/* Campos según tipo */}
          {newLink.tipo === 'servicio' ? (
            <Input
              value={newLink.nombre_beneficio}
              onChange={(e) => setNewLink({ ...newLink, nombre_beneficio: e.target.value })}
              placeholder="Nombre del servicio *"
            />
          ) : (
            <div className="space-y-2">
              <Input
                type="number"
                value={newLink.puntos_regalo}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setNewLink({ ...newLink, puntos_regalo: Math.max(1, val) });
                }}
                placeholder="Cantidad de puntos *"
                min={1}
              />
              <div className="flex gap-1.5">
                {configDefaults.presets_puntos.map(pts => (
                  <Button
                    key={pts}
                    type="button"
                    size="sm"
                    variant={newLink.puntos_regalo === pts ? 'default' : 'outline'}
                    onClick={() => setNewLink({ ...newLink, puntos_regalo: pts })}
                    className="flex-1 h-8"
                  >
                    {pts}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Vigencia - siempre visible, compacto */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Vigencia:</span>
            <div className="flex gap-1.5 flex-1">
              {configDefaults.presets_dias.map(dias => (
                <Button
                  key={dias}
                  type="button"
                  size="sm"
                  variant={newLink.dias_expiracion === dias ? 'default' : 'outline'}
                  onClick={() => setNewLink({ ...newLink, dias_expiracion: dias })}
                  className="flex-1 h-8"
                >
                  {dias} días
                </Button>
              ))}
            </div>
          </div>

          {/* Sección colapsable de opciones avanzadas */}
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors list-none">
              <span className="flex items-center gap-2">
                <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                Opciones avanzadas
              </span>
            </summary>
            <div className="space-y-3 pt-3 border-t border-border mt-2">
              {/* Teléfono o Max canjes */}
              {newLink.es_campana ? (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Máx. participantes (0 = sin límite)</label>
                  <Input
                    type="number"
                    value={newLink.max_canjes}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setNewLink({ ...newLink, max_canjes: Math.max(0, val) });
                    }}
                    placeholder="Sin límite"
                    min={0}
                  />
                </div>
              ) : (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Teléfono destinatario (opcional)</label>
                  <Input
                    type="tel"
                    value={newLink.destinatario_telefono}
                    onChange={(e) => setNewLink({
                      ...newLink,
                      destinatario_telefono: e.target.value.replace(/\D/g, '').slice(0, VALIDATION.PHONE.LENGTH)
                    })}
                    placeholder="Cualquiera puede usarlo"
                    maxLength={VALIDATION.PHONE.LENGTH}
                  />
                </div>
              )}

              {/* Descripción para servicios */}
              {newLink.tipo === 'servicio' && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Descripción</label>
                  <textarea
                    value={newLink.descripcion_beneficio}
                    onChange={(e) => setNewLink({ ...newLink, descripcion_beneficio: e.target.value })}
                    placeholder="Qué incluye el servicio..."
                    className="w-full h-16 p-2.5 rounded-lg bg-background border border-border text-foreground resize-none text-sm"
                  />
                </div>
              )}

              {/* Mensaje personalizado */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Mensaje personalizado</label>
                <textarea
                  value={newLink.mensaje_personalizado}
                  onChange={(e) => setNewLink({ ...newLink, mensaje_personalizado: e.target.value })}
                  placeholder="Un mensaje especial..."
                  className="w-full h-14 p-2.5 rounded-lg bg-background border border-border text-foreground resize-none text-sm"
                />
              </div>

              {/* Campos extra para campañas */}
              {newLink.es_campana && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Términos y condiciones</label>
                    <textarea
                      value={newLink.terminos_condiciones}
                      onChange={(e) => setNewLink({ ...newLink, terminos_condiciones: e.target.value })}
                      placeholder="• Condición 1&#10;• Condición 2"
                      className="w-full h-20 p-2.5 rounded-lg bg-background border border-border text-foreground resize-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Instrucciones de uso</label>
                    <Input
                      value={newLink.instrucciones_uso}
                      onChange={(e) => setNewLink({ ...newLink, instrucciones_uso: e.target.value })}
                      placeholder="Cómo usar el beneficio..."
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Color del tema</label>
                    <div className="flex gap-2">
                      {configDefaults.colores_tema.map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setNewLink({ ...newLink, color_tema: color })}
                          className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                            newLink.color_tema === color ? 'border-foreground scale-110' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Banner de campaña */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Banner de campaña</label>
                    {bannerPreview ? (
                      <div className="relative">
                        <img
                          src={bannerPreview}
                          alt="Preview del banner"
                          className="w-full h-32 object-cover rounded-lg border border-border"
                        />
                        <button
                          type="button"
                          onClick={onRemoveBanner}
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
                          onChange={onBannerSelect}
                          className="hidden"
                        />
                      </label>
                    )}
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Se mostrará en la página del regalo
                    </p>
                  </div>
                </>
              )}
            </div>
          </details>
        </div>

        <DialogFooter className="gap-2 mt-2">
          <DialogClose asChild>
            <Button variant="outline" size="sm">Cancelar</Button>
          </DialogClose>
          {/* Botón de vista previa solo para campañas */}
          {newLink.es_campana && (
            <Button
              variant="outline"
              size="sm"
              onClick={onShowPreview}
            >
              <Eye className="w-4 h-4 mr-1.5" />
              Vista previa
            </Button>
          )}
          <Button
            onClick={onCreate}
            disabled={isCreating || isUploadingBanner}
            size="sm"
          >
            {(isCreating || isUploadingBanner) && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
            {isUploadingBanner ? 'Subiendo imagen...' : newLink.es_campana ? 'Crear Campaña' : 'Crear Link'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateGiftDialog;
