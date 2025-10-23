import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSupabaseAPI } from '@/context/SupabaseContext';

const AuthContext = createContext(null);
const ADMIN_PHONE = "4624844148";

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const api = useSupabaseAPI();

  useEffect(() => {
    let isMounted = true;
    const initializeAuth = () => {
      try {
        setLoading(true);
        const storedUser = localStorage.getItem('manny_user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          if (isMounted && parsed && typeof parsed === 'object') {
            setUser(parsed);
          }
        }
      } catch (e) {
        console.error("Invalid user data in localStorage, removing.", e);
        localStorage.removeItem('manny_user');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    initializeAuth();
    return () => { isMounted = false; };
  }, []);

  const login = useCallback(async (telefono) => {
    try {
      if (!api || !api.getClienteByTelefono) {
        throw new Error('Sistema de autenticación no disponible.');
      }
      
      setLoading(true);
      
      const cliente = await api.getClienteByTelefono(telefono);
      
      if (!cliente || !cliente.id) {
        throw new Error('Error en los datos de usuario recibidos del servidor.');
      }
      
      setUser(cliente);
      localStorage.setItem('manny_user', JSON.stringify(cliente));
      
      const from = location.state?.from?.pathname || 
                   (cliente.telefono === ADMIN_PHONE ? '/admin' : '/dashboard');
      navigate(from, { replace: true });
      
    } catch (error) {
      console.error('Error en login:', error);
      // Re-throw the error so the calling component (Login.jsx) can handle it (e.g., show a toast)
      throw error;
    } finally {
      setLoading(false);
    }
  }, [api, navigate, location.state]);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('manny_user');
    navigate('/login', { replace: true });
  }, [navigate]);

  const updateUser = useCallback((updatedUserData) => {
    setUser(prevUser => {
        if (!prevUser) return null;
        const newUser = { ...prevUser, ...updatedUserData };
        localStorage.setItem('manny_user', JSON.stringify(newUser));
        return newUser;
    });
  }, []);
  
  const isAdmin = useMemo(() => user?.es_admin === true, [user?.es_admin]);

  const value = useMemo(() => ({
    user,
    isAdmin,
    loading,
    login,
    logout,
    updateUser,
  }), [user, isAdmin, loading, login, logout, updateUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};