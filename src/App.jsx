
import React, { Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider } from "@/context/ThemeContext";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WhatsAppButton from '@/components/features/WhatsAppButton';
import Footer from '@/components/layout/Footer';
import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';
import { AnimatePresence } from 'framer-motion';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import SEOHelmet from '@/components/common/SEOHelmet';
import OfflineIndicator from '@/components/common/OfflineIndicator';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import OnboardingModal from '@/components/features/OnboardingModal';
import MannyLogo from '@/assets/images/manny-logo-new.svg';
import { CACHE_CONFIG } from '@/config';

// Lazy load pages
const Login = React.lazy(() => import('@/pages/Login'));
const Dashboard = React.lazy(() => import('@/pages/Dashboard'));
const Admin = React.lazy(() => import('@/pages/Admin'));
const AdminProductos = React.lazy(() => import('@/pages/AdminProductos'));
const AdminEntregas = React.lazy(() => import('@/pages/AdminEntregas'));
const AdminClientes = React.lazy(() => import('@/pages/AdminClientes'));
const AdminGestion = React.lazy(() => import('@/pages/AdminGestion'));
const AdminClienteDetalle = React.lazy(() => import('@/pages/AdminClienteDetalle'));
const AdminRecordatorios = React.lazy(() => import('@/pages/AdminRecordatorios'));
const ConfirmarCanje = React.lazy(() => import('@/pages/ConfirmarCanje'));
const MisCanjes = React.lazy(() => import('@/pages/MisCanjes'));
const MisServicios = React.lazy(() => import('@/pages/MisServicios'));

const AccesoDenegado = React.lazy(() => import('@/pages/AccesoDenegado'));

// Referidos y Regalos
const MisReferidos = React.lazy(() => import('@/pages/MisReferidos'));
const ReferralLanding = React.lazy(() => import('@/pages/ReferralLanding'));
const GiftLanding = React.lazy(() => import('@/pages/GiftLanding'));
const AdminReferidos = React.lazy(() => import('@/pages/AdminReferidos'));
const AdminRegalos = React.lazy(() => import('@/pages/AdminRegalos'));

// Configuración y Ayuda
const Configuracion = React.lazy(() => import('@/pages/Configuracion'));
const Ayuda = React.lazy(() => import('@/pages/Ayuda'));

const LoadingFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background text-foreground z-[200]">
    <div className="flex flex-col items-center gap-4">
      <img src={MannyLogo} alt="Manny Rewards Logo" className="h-16 w-auto animate-pulse" />
      <p className="text-muted-foreground">Cargando tu experiencia...</p>
    </div>
  </div>
);

const PageLayout = ({ children, seoTitle, seoDescription, isAdminRoute = false }) => {
  // Add bottom padding for bottom nav on mobile/tablet (only for non-admin users)
  const mainPadding = isAdminRoute ? "py-6 lg:py-8" : "py-6 lg:py-8 pb-24 lg:pb-8";

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <SEOHelmet title={seoTitle} description={seoDescription} />
      <Header />
      <main className={`flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 ${mainPadding} flex flex-col`}>
        {children}
      </main>
      <Footer />
    </div>
  );
};


const ProtectedRoute = React.memo(({ children, adminOnly = false }) => {
  const { user, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingFallback />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/acceso-denegado" replace />;
  }

  return children;
});

// Component to handle root redirect based on auth status
const RootRedirect = () => {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return <LoadingFallback />;
  }

  if (user) {
    return <Navigate to={isAdmin ? '/admin' : '/dashboard'} replace />;
  }

  return <Navigate to="/login" replace />;
};

const AppRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<LoadingFallback />}>
        <Routes location={location} key={location.pathname}>
          <Route path="/login" element={<Login />} />
          <Route path="/acceso-denegado" element={<AccesoDenegado />} />
          <Route path="/" element={<RootRedirect />} />

          {/* Rutas públicas de referidos y regalos */}
          <Route path="/r/:codigo" element={<ReferralLanding />} />
          <Route path="/g/:codigo" element={<GiftLanding />} />

          <Route path="/dashboard" element={<ProtectedRoute><PageLayout seoTitle="Mis Recompensas"><Dashboard /></PageLayout></ProtectedRoute>} />

          <Route path="/canjear/:productoId" element={<ProtectedRoute><PageLayout seoTitle="Confirmar Canje"><ConfirmarCanje /></PageLayout></ProtectedRoute>} />
          <Route path="/mis-canjes" element={<ProtectedRoute><PageLayout seoTitle="Mi Historial"><MisCanjes /></PageLayout></ProtectedRoute>} />
          <Route path="/mis-servicios" element={<ProtectedRoute><PageLayout seoTitle="Mis Servicios"><MisServicios /></PageLayout></ProtectedRoute>} />
          <Route path="/mis-referidos" element={<ProtectedRoute><PageLayout seoTitle="Mis Referidos"><MisReferidos /></PageLayout></ProtectedRoute>} />
          <Route path="/configuracion" element={<ProtectedRoute><PageLayout seoTitle="Configuración"><Configuracion /></PageLayout></ProtectedRoute>} />
          <Route path="/ayuda" element={<ProtectedRoute><PageLayout seoTitle="Ayuda"><Ayuda /></PageLayout></ProtectedRoute>} />

          <Route path="/admin" element={<ProtectedRoute adminOnly><PageLayout seoTitle="Panel de Administrador" isAdminRoute><Admin /></PageLayout></ProtectedRoute>} />
          <Route path="/admin/productos" element={<ProtectedRoute adminOnly><PageLayout seoTitle="Gestión de Productos" isAdminRoute><AdminProductos /></PageLayout></ProtectedRoute>} />
          <Route path="/admin/clientes" element={<ProtectedRoute adminOnly><PageLayout seoTitle="Gestión de Clientes" isAdminRoute><AdminClientes /></PageLayout></ProtectedRoute>} />
          <Route path="/admin/clientes/:clienteId" element={<ProtectedRoute adminOnly><PageLayout seoTitle="Detalle de Cliente" isAdminRoute><AdminClienteDetalle /></PageLayout></ProtectedRoute>} />
          <Route path="/admin/entregas" element={<ProtectedRoute adminOnly><PageLayout seoTitle="Gestión de Entregas" isAdminRoute><AdminEntregas /></PageLayout></ProtectedRoute>} />
          <Route path="/admin/gestion" element={<ProtectedRoute adminOnly><PageLayout seoTitle="Importar/Exportar" isAdminRoute><AdminGestion /></PageLayout></ProtectedRoute>} />
          <Route path="/admin/recordatorios" element={<ProtectedRoute adminOnly><PageLayout seoTitle="Recordatorios" isAdminRoute><AdminRecordatorios /></PageLayout></ProtectedRoute>} />
          <Route path="/admin/referidos" element={<ProtectedRoute adminOnly><PageLayout seoTitle="Programa de Referidos" isAdminRoute><AdminReferidos /></PageLayout></ProtectedRoute>} />
          <Route path="/admin/regalos" element={<ProtectedRoute adminOnly><PageLayout seoTitle="Links de Regalo" isAdminRoute><AdminRegalos /></PageLayout></ProtectedRoute>} />
          
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </AnimatePresence>
  );
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: CACHE_CONFIG.STALE_TIME,
      gcTime: CACHE_CONFIG.GC_TIME,
      refetchOnWindowFocus: CACHE_CONFIG.REFETCH_ON_WINDOW_FOCUS,
      refetchOnMount: CACHE_CONFIG.REFETCH_ON_MOUNT,
    },
  },
});

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ErrorBoundary>
            <OfflineIndicator />
            <AppRoutes />
          </ErrorBoundary>
          <Toaster />
          <WhatsAppButton />
          <PWAInstallPrompt />
          <OnboardingModal />
          <BottomNav />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
