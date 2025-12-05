
import React, { Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { SupabaseProvider } from '@/context/SupabaseContext';
import { ThemeProvider } from "@/context/ThemeContext";
import WhatsAppButton from '@/components/features/WhatsAppButton';
import Footer from '@/components/layout/Footer';
import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';
import { AnimatePresence } from 'framer-motion';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import SEOHelmet from '@/components/common/SEOHelmet';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import MannyLogo from '@/assets/images/manny-logo.svg';

// Lazy load pages
const Login = React.lazy(() => import('@/pages/Login'));
const Dashboard = React.lazy(() => import('@/pages/Dashboard'));
const Admin = React.lazy(() => import('@/pages/Admin'));
const AdminProductos = React.lazy(() => import('@/pages/AdminProductos'));
const AdminEntregas = React.lazy(() => import('@/pages/AdminEntregas'));
const AdminClientes = React.lazy(() => import('@/pages/AdminClientes'));
const AdminGestion = React.lazy(() => import('@/pages/AdminGestion'));
const AdminClienteDetalle = React.lazy(() => import('@/pages/AdminClienteDetalle'));
const ConfirmarCanje = React.lazy(() => import('@/pages/ConfirmarCanje'));
const MisCanjes = React.lazy(() => import('@/pages/MisCanjes'));

const AccesoDenegado = React.lazy(() => import('@/pages/AccesoDenegado'));

const LoadingFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background text-foreground z-[200]">
    <div className="flex flex-col items-center gap-4">
      <img src={MannyLogo} alt="Manny Rewards Logo" className="h-16 w-auto animate-pulse" />
      <p className="text-muted-foreground">Cargando tu experiencia...</p>
    </div>
  </div>
);

const PageLayout = ({ children, seoTitle, seoDescription, isAdminRoute = false }) => {
  // Add bottom padding for bottom nav on mobile (only for non-admin users)
  const mainPadding = isAdminRoute ? "py-6 md:py-8" : "py-6 md:py-8 pb-24 md:pb-8";

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <SEOHelmet title={seoTitle} description={seoDescription} />
      <Header />
      <main className={`flex-1 container mx-auto px-4 ${mainPadding} flex flex-col`}>
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

const AppRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<LoadingFallback />}>
        <Routes location={location} key={location.pathname}>
          <Route path="/login" element={<Login />} />
          <Route path="/acceso-denegado" element={<AccesoDenegado />} />
          <Route path="/" element={<Navigate to="/login" replace />} />

          <Route path="/dashboard" element={<ProtectedRoute><PageLayout seoTitle="Mis Recompensas"><Dashboard /></PageLayout></ProtectedRoute>} />

          <Route path="/canjear/:productoId" element={<ProtectedRoute><PageLayout seoTitle="Confirmar Canje"><ConfirmarCanje /></PageLayout></ProtectedRoute>} />
          <Route path="/mis-canjes" element={<ProtectedRoute><PageLayout seoTitle="Mi Historial"><MisCanjes /></PageLayout></ProtectedRoute>} />

          <Route path="/admin" element={<ProtectedRoute adminOnly><PageLayout seoTitle="Panel de Administrador" isAdminRoute><Admin /></PageLayout></ProtectedRoute>} />
          <Route path="/admin/productos" element={<ProtectedRoute adminOnly><PageLayout seoTitle="Gestión de Productos" isAdminRoute><AdminProductos /></PageLayout></ProtectedRoute>} />
          <Route path="/admin/clientes" element={<ProtectedRoute adminOnly><PageLayout seoTitle="Gestión de Clientes" isAdminRoute><AdminClientes /></PageLayout></ProtectedRoute>} />
          <Route path="/admin/clientes/:clienteId" element={<ProtectedRoute adminOnly><PageLayout seoTitle="Detalle de Cliente" isAdminRoute><AdminClienteDetalle /></PageLayout></ProtectedRoute>} />
          <Route path="/admin/entregas" element={<ProtectedRoute adminOnly><PageLayout seoTitle="Gestión de Entregas" isAdminRoute><AdminEntregas /></PageLayout></ProtectedRoute>} />
          <Route path="/admin/gestion" element={<ProtectedRoute adminOnly><PageLayout seoTitle="Importar/Exportar" isAdminRoute><AdminGestion /></PageLayout></ProtectedRoute>} />
          
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </AnimatePresence>
  );
};

function App() {
  return (
    <ThemeProvider>
      <SupabaseProvider>
        <AuthProvider>
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
          <Toaster />
          <WhatsAppButton />
          <PWAInstallPrompt />
          <BottomNav />
        </AuthProvider>
      </SupabaseProvider>
    </ThemeProvider>
  );
}

export default App;
