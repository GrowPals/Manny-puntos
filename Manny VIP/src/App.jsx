
import React, { Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { SupabaseProvider } from '@/context/SupabaseContext';
import { ThemeProvider } from "@/context/ThemeContext";
import WhatsAppButton from '@/components/WhatsAppButton';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { AnimatePresence } from 'framer-motion';
import ErrorBoundary from '@/components/ErrorBoundary';
import SEOHelmet from '@/components/SEOHelmet';

// Lazy load pages
const Login = React.lazy(() => import('@/pages/Login'));
const Dashboard = React.lazy(() => import('@/pages/Dashboard'));
const Admin = React.lazy(() => import('@/pages/Admin'));
const AdminProductos = React.lazy(() => import('@/pages/AdminProductos'));
const AdminEntregas = React.lazy(() => import('@/pages/AdminEntregas'));
const AdminClientes = React.lazy(() => import('@/pages/AdminClientes'));
const AdminGestion = React.lazy(() => import('@/pages/AdminGestion')); 
const ConfirmarCanje = React.lazy(() => import('@/pages/ConfirmarCanje'));
const MisCanjes = React.lazy(() => import('@/pages/MisCanjes'));
const SobreNosotros = React.lazy(() => import('@/pages/SobreNosotros'));
const AccesoDenegado = React.lazy(() => import('@/pages/AccesoDenegado'));

const LoadingFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background text-foreground z-[200]">
    <div className="flex flex-col items-center gap-4">
      <img src="https://i.ibb.co/LDLWZhkj/Recurso-1.png" alt="Manny VIP Logo" className="h-16 w-auto animate-pulse" />
      <p className="text-muted-foreground">Cargando tu experiencia...</p>
    </div>
  </div>
);

const PageLayout = ({ children, seoTitle, seoDescription }) => (
  <div className="min-h-screen flex flex-col bg-background text-foreground">
    <SEOHelmet title={seoTitle} description={seoDescription} />
    <Header />
    <main className="flex-1 container mx-auto px-4 py-6 md:py-8 flex flex-col">
      <Suspense fallback={<LoadingFallback />}>
        {children}
      </Suspense>
    </main>
    <Footer />
  </div>
);


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
          <Route path="/sobre-manny" element={<ProtectedRoute><PageLayout seoTitle="Sobre Manny"><SobreNosotros /></PageLayout></ProtectedRoute>} />
          <Route path="/canjear/:productoId" element={<ProtectedRoute><PageLayout seoTitle="Confirmar Canje"><ConfirmarCanje /></PageLayout></ProtectedRoute>} />
          <Route path="/mis-canjes" element={<ProtectedRoute><PageLayout seoTitle="Mi Historial"><MisCanjes /></PageLayout></ProtectedRoute>} />

          <Route path="/admin" element={<ProtectedRoute adminOnly><PageLayout seoTitle="Panel de Administrador"><Admin /></PageLayout></ProtectedRoute>} />
          <Route path="/admin/productos" element={<ProtectedRoute adminOnly><PageLayout seoTitle="Gestión de Productos"><AdminProductos /></PageLayout></ProtectedRoute>} />
          <Route path="/admin/clientes" element={<ProtectedRoute adminOnly><PageLayout seoTitle="Gestión de Clientes"><AdminClientes /></PageLayout></ProtectedRoute>} />
          <Route path="/admin/entregas" element={<ProtectedRoute adminOnly><PageLayout seoTitle="Gestión de Entregas"><AdminEntregas /></PageLayout></ProtectedRoute>} />
          <Route path="/admin/gestion" element={<ProtectedRoute adminOnly><PageLayout seoTitle="Importar/Exportar"><AdminGestion /></PageLayout></ProtectedRoute>} />
          
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
        </AuthProvider>
      </SupabaseProvider>
    </ThemeProvider>
  );
}

export default App;
