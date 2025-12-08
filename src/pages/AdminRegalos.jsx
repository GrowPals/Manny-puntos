import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import {
  Gift,
  Plus,
  RefreshCw,
  Megaphone,
  Users,
  CheckCircle2,
  Eye
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import useWhatsAppShare from '@/hooks/useWhatsAppShare';
import LoadingSpinner from '@/components/common/LoadingSpinner';

// Extracted components
import {
  CreateGiftDialog,
  GiftDetailsDialog,
  BeneficiariosDialog,
  GiftPreviewDialog,
  GiftLinkCard,
  getDefaultLinkForm,
  DEFAULT_CONFIG
} from '@/components/admin/regalos';

const AdminRegalos = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { shareViaWhatsApp, buildGiftMessage } = useWhatsAppShare();

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showBeneficiariosDialog, setShowBeneficiariosDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);

  // Selection and UI states
  const [selectedLink, setSelectedLink] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [expandedLinkId, setExpandedLinkId] = useState(null);

  // Banner upload states
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  // Beneficiarios state
  const [beneficiarios, setBeneficiarios] = useState([]);
  const [loadingBeneficiarios, setLoadingBeneficiarios] = useState(false);

  // Get global config
  const { data: globalConfig } = useQuery({
    queryKey: ['config-global'],
    queryFn: api.config.getConfigGlobal,
    staleTime: 5 * 60 * 1000,
  });

  // Config with defaults
  const configDefaults = {
    puntos_regalo: globalConfig?.puntos_regalo_default || DEFAULT_CONFIG.puntos_regalo,
    dias_expiracion: globalConfig?.dias_expiracion_link_default || DEFAULT_CONFIG.dias_expiracion,
    max_canjes: globalConfig?.max_canjes_campana_default || DEFAULT_CONFIG.max_canjes,
    vigencia_beneficio: globalConfig?.vigencia_beneficio_dias || DEFAULT_CONFIG.vigencia_beneficio,
    color_tema: globalConfig?.color_tema_default || DEFAULT_CONFIG.color_tema,
    presets_puntos: globalConfig?.presets_puntos || DEFAULT_CONFIG.presets_puntos,
    presets_dias: globalConfig?.presets_dias_regalo || DEFAULT_CONFIG.presets_dias,
    colores_tema: globalConfig?.colores_tema_opciones || DEFAULT_CONFIG.colores_tema,
  };

  // Form state
  const [newLink, setNewLink] = useState(() => getDefaultLinkForm(configDefaults));

  // Stats query
  const { data: stats = {}, isLoading: loadingStats } = useQuery({
    queryKey: ['admin-regalos-stats'],
    queryFn: api.gifts.getGiftStats,
  });

  // Links list query
  const { data: links = [], isLoading: loadingLinks, refetch: refetchLinks } = useQuery({
    queryKey: ['admin-regalos-list'],
    queryFn: api.gifts.getAllGiftLinks,
  });

  const loading = loadingStats || loadingLinks;

  // ============================================================================
  // MUTATIONS
  // ============================================================================

  const createMutation = useMutation({
    mutationFn: (data) => api.gifts.createGiftLink({
      ...data,
      creado_por: null
    }),
    onSuccess: (data) => {
      toast({
        title: "Link creado",
        description: `Código: ${data.codigo}`,
      });
      queryClient.invalidateQueries(['admin-regalos-list']);
      queryClient.invalidateQueries(['admin-regalos-stats']);
      setShowCreateDialog(false);
      resetForm();

      // Show created link
      setSelectedLink({
        ...newLink,
        codigo: data.codigo,
        url: data.url
      });
      setShowDetailsDialog(true);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const expireMutation = useMutation({
    mutationFn: api.gifts.expireGiftLink,
    onSuccess: () => {
      toast({ title: "Link expirado" });
      queryClient.invalidateQueries(['admin-regalos-list']);
      queryClient.invalidateQueries(['admin-regalos-stats']);
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: api.gifts.deleteGiftLink,
    onSuccess: () => {
      toast({ title: "Link eliminado" });
      queryClient.invalidateQueries(['admin-regalos-list']);
      queryClient.invalidateQueries(['admin-regalos-stats']);
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const resetForm = () => {
    setNewLink(getDefaultLinkForm(configDefaults));
    setBannerFile(null);
    setBannerPreview(null);
  };

  const handleBannerSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Tipo de archivo no válido",
        description: "Usa JPG, PNG, WebP o GIF",
        variant: "destructive"
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Archivo muy grande",
        description: "El tamaño máximo es 5MB",
        variant: "destructive"
      });
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
    setNewLink({ ...newLink, imagen_banner: '' });
  };

  const handleCreate = async () => {
    // Validations
    if (newLink.tipo === 'servicio' && !newLink.nombre_beneficio.trim()) {
      toast({
        title: "Error",
        description: "Ingresa el nombre del servicio/beneficio",
        variant: "destructive"
      });
      return;
    }
    if (newLink.tipo === 'puntos' && (!newLink.puntos_regalo || newLink.puntos_regalo < 1)) {
      toast({
        title: "Error",
        description: "Ingresa una cantidad de puntos válida",
        variant: "destructive"
      });
      return;
    }
    if (newLink.es_campana) {
      if (!newLink.nombre_campana.trim()) {
        toast({
          title: "Error",
          description: "Ingresa un nombre para la campaña",
          variant: "destructive"
        });
        return;
      }
      if (!newLink.max_canjes || newLink.max_canjes < 1) {
        toast({
          title: "Error",
          description: "Ingresa el número máximo de participantes",
          variant: "destructive"
        });
        return;
      }
    }

    // Upload banner if selected
    let linkData = { ...newLink };
    if (bannerFile) {
      try {
        setUploadingBanner(true);
        const bannerUrl = await api.gifts.subirImagenBanner(bannerFile);
        linkData.imagen_banner = bannerUrl;
      } catch (error) {
        toast({
          title: "Error al subir imagen",
          description: error.message,
          variant: "destructive"
        });
        setUploadingBanner(false);
        return;
      } finally {
        setUploadingBanner(false);
      }
    }

    createMutation.mutate(linkData);
  };

  const handleCopyLink = async (link) => {
    const url = `${window.location.origin}/g/${link.codigo}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(link.id);
      toast({ title: "Link copiado" });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ title: "Error al copiar", variant: "destructive" });
    }
  };

  const handleShareWhatsApp = (link) => {
    const message = buildGiftMessage(link, window.location.origin);
    shareViaWhatsApp(message);
  };

  const handleExpire = (linkId) => {
    if (!confirm('¿Expirar este link? Ya no podrá ser canjeado.')) return;
    expireMutation.mutate(linkId);
  };

  const handleDelete = (linkId) => {
    if (!confirm('¿Eliminar este link permanentemente?')) return;
    deleteMutation.mutate(linkId);
  };

  const handleLoadBeneficiarios = async (link) => {
    setSelectedLink(link);
    setLoadingBeneficiarios(true);
    setShowBeneficiariosDialog(true);
    try {
      const data = await api.gifts.getLinkBeneficiarios(link.id);
      setBeneficiarios(data);
    } catch {
      toast({
        title: "Error",
        description: "No se pudieron cargar los beneficiarios",
        variant: "destructive"
      });
    } finally {
      setLoadingBeneficiarios(false);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return <LoadingSpinner size="md" />;
  }

  return (
    <>
      <Helmet>
        <title>Links de Regalo - Admin Manny</title>
      </Helmet>

      {/* Dialogs */}
      <CreateGiftDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        newLink={newLink}
        setNewLink={setNewLink}
        configDefaults={configDefaults}
        bannerPreview={bannerPreview}
        onBannerSelect={handleBannerSelect}
        onRemoveBanner={handleRemoveBanner}
        onShowPreview={() => setShowPreviewDialog(true)}
        onCreate={handleCreate}
        isCreating={createMutation.isPending}
        isUploadingBanner={uploadingBanner}
      />

      <GiftDetailsDialog
        open={showDetailsDialog}
        onOpenChange={setShowDetailsDialog}
        selectedLink={selectedLink}
        onCopyLink={handleCopyLink}
        onShareWhatsApp={handleShareWhatsApp}
      />

      <BeneficiariosDialog
        open={showBeneficiariosDialog}
        onOpenChange={setShowBeneficiariosDialog}
        selectedLink={selectedLink}
        beneficiarios={beneficiarios}
        isLoading={loadingBeneficiarios}
      />

      <GiftPreviewDialog
        open={showPreviewDialog}
        onOpenChange={setShowPreviewDialog}
        newLink={newLink}
        bannerPreview={bannerPreview}
        onCreate={handleCreate}
        isCreating={createMutation.isPending}
        isUploadingBanner={uploadingBanner}
      />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl flex items-center gap-3">
              <Gift className="w-7 h-7 text-primary" />
              Links de Regalo
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Crea links que otorgan beneficios automáticamente
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchLinks()}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Actualizar
            </Button>
            <Button
              size="sm"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Crear Link
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <Megaphone className="w-5 h-5 text-purple-500" />
            <div>
              <p className="text-2xl font-bold">{stats.campanas || 0}</p>
              <p className="text-xs text-muted-foreground">Campañas</p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{stats.total_canjes || 0}</p>
              <p className="text-xs text-muted-foreground">Canjes totales</p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{stats.beneficios_activos || 0}</p>
              <p className="text-xs text-muted-foreground">Beneficios activos</p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <Eye className="w-5 h-5 text-amber-500" />
            <div>
              <p className="text-2xl font-bold">{stats.total_vistas || 0}</p>
              <p className="text-xs text-muted-foreground">Vistas totales</p>
            </div>
          </div>
        </div>
      </div>

      {/* Links List */}
      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="font-bold text-lg">
            Todos los Links ({links.length})
          </h2>
        </div>

        {links.length > 0 ? (
          <div className="divide-y divide-border">
            {links.map((link) => (
              <GiftLinkCard
                key={link.id}
                link={link}
                isExpanded={expandedLinkId === link.id}
                copiedId={copiedId}
                onToggleExpand={() => setExpandedLinkId(expandedLinkId === link.id ? null : link.id)}
                onCopyLink={handleCopyLink}
                onShareWhatsApp={handleShareWhatsApp}
                onViewBeneficiarios={() => handleLoadBeneficiarios(link)}
                onExpire={handleExpire}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Gift className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Sin links de regalo</p>
            <p className="text-sm mb-4">
              Crea un link para regalar servicios o puntos.
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Crear primer link
            </Button>
          </div>
        )}
      </div>

      {/* Info footer */}
      <div className="mt-6 p-4 bg-muted/30 rounded-xl border border-border/50">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">¿Cómo funciona?</strong><br />
          Los links de regalo son URLs únicas que al ser abiertas muestran una experiencia de "regalo".
          Cuando el usuario ingresa su teléfono, el beneficio se agrega automáticamente a su cuenta.
          Si es nuevo, se crea su cuenta.
        </p>
      </div>
    </>
  );
};

export default AdminRegalos;
