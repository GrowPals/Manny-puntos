import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useNotionAPI } from '@/context/NotionAPIContext';

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
  const api = useNotionAPI();

  useEffect(() => {
    let isMounted = true;
    const initializeAuth = () => {
      try {
        const storedUser = localStorage.getItem('manny_user');
        if (storedUser) {
          if (isMounted) setUser(JSON.parse(storedUser));
        }
      } catch (e) {
        console.error("Failed to parse user from localStorage", e);
        localStorage.removeItem('manny_user');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    initializeAuth();
    return () => { isMounted = false; };
  }, []);

  const login = useCallback(async (telefono) => {
    if (!api) return;
    const cliente = await api.getClienteByTelefono(telefono);
    setUser(cliente);
    localStorage.setItem('manny_user', JSON.stringify(cliente));
    
    const from = location.state?.from?.pathname || (cliente.telefono === ADMIN_PHONE ? '/admin' : '/dashboard');
    navigate(from, { replace: true });
  }, [navigate, api, location.state]);

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
  
  const isAdmin = useMemo(() => user?.telefono === ADMIN_PHONE, [user]);

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