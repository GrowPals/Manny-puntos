
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Admin from '@/pages/Admin';
import AdminProductos from '@/pages/AdminProductos';
import AdminEntregas from '@/pages/AdminEntregas';
import ConfirmarCanje from '@/pages/ConfirmarCanje';
import MisCanjes from '@/pages/MisCanjes';
import SobreNosotros from '@/pages/SobreNosotros';
import AccesoDenegado from '@/pages/AccesoDenegado';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { NotionAPIProvider } from '@/context/NotionAPIContext';
import WhatsAppButton from '@/components/WhatsAppButton';

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, isAdmin } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (adminOnly && !isAdmin) {
    return <Navigate to="/acceso-denegado" replace />;
  }
  
  return children;
}

function App() {
  return (
    <NotionAPIProvider>
      <AuthProvider>
        <div className="min-h-screen bg-secondary-dark font-sans">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
             <Route 
              path="/sobre-manny" 
              element={
                <ProtectedRoute>
                  <SobreNosotros />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/canjear/:productoId" 
              element={
                <ProtectedRoute>
                  <ConfirmarCanje />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/mis-canjes" 
              element={
                <ProtectedRoute>
                  <MisCanjes />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute adminOnly>
                  <Admin />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/productos" 
              element={
                <ProtectedRoute adminOnly>
                  <AdminProductos />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/entregas" 
              element={
                <ProtectedRoute adminOnly>
                  <AdminEntregas />
                </ProtectedRoute>
              } 
            />
            <Route path="/acceso-denegado" element={<AccesoDenegado />} />
            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
          <Toaster />
          <WhatsAppButton />
        </div>
      </AuthProvider>
    </NotionAPIProvider>
  );
}

export default App;
