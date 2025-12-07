
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '@/services/api';

const AuthContext = createContext(null);

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

  useEffect(() => {
    try {
      setLoading(true);
      const storedUser = localStorage.getItem('manny_user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser && typeof parsedUser === 'object' && parsedUser.id && parsedUser.telefono) {
          setUser(parsedUser);
        } else {
          localStorage.removeItem('manny_user');
        }
      }
    } catch (error) {
      console.error("Failed to parse user from localStorage.", error);
      localStorage.removeItem('manny_user');
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (telefono, pin) => {
    setLoading(true);
    try {
      const clienteData = await api.auth.login(telefono, pin);
      
      setUser(clienteData);
      localStorage.setItem('manny_user', JSON.stringify(clienteData));
      
      const destination = clienteData.es_admin ? '/admin' : '/dashboard';
      const from = location.state?.from?.pathname || destination;
      navigate(from, { replace: true });

    } catch (error) {
      console.error('Login failed:', error);
      setUser(null);
      localStorage.removeItem('manny_user');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [navigate, location.state]);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('manny_user');
    navigate('/login', { replace: true });
  }, [navigate]);

  const updateUser = useCallback((updatedData) => {
    setUser(currentUser => {
      if (!currentUser) return null;
      const newUser = { ...currentUser, ...updatedData };
      localStorage.setItem('manny_user', JSON.stringify(newUser));
      return newUser;
    });
  }, []);

  const isAdmin = useMemo(() => user?.es_admin === true, [user]);
  const isPartner = useMemo(() => user?.nivel === 'partner', [user]);
  const isVIP = useMemo(() => user?.nivel === 'vip', [user]);

  const value = useMemo(() => ({
    user,
    isAdmin,
    isPartner,
    isVIP,
    loading,
    login,
    logout,
    updateUser,
  }), [user, isAdmin, isPartner, isVIP, loading, login, logout, updateUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
