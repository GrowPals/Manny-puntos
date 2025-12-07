
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
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Cargar sesión guardada
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

  // Verificar si cliente existe y tiene PIN
  const checkCliente = useCallback(async (telefono) => {
    const result = await api.auth.checkClienteExists(telefono);
    return result; // { exists, has_pin, cliente? }
  }, []);

  // Login con PIN (usuarios que ya tienen PIN)
  const loginWithPin = useCallback(async (telefono, pin) => {
    setLoading(true);
    try {
      const clienteData = await api.auth.loginWithPin(telefono, pin);

      setUser(clienteData);
      setNeedsOnboarding(false);

      localStorage.setItem('manny_user', JSON.stringify(clienteData));

      const destination = clienteData.es_admin ? '/admin' : '/dashboard';
      const from = location.state?.from?.pathname || destination;
      navigate(from, { replace: true });

      return clienteData;
    } catch (error) {
      console.error('Login failed:', error);
      setUser(null);
      localStorage.removeItem('manny_user');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [navigate, location.state]);

  // Login primera vez (sin PIN - para onboarding)
  const loginFirstTime = useCallback(async (telefono) => {
    setLoading(true);
    try {
      const clienteData = await api.auth.loginFirstTime(telefono);

      setUser(clienteData);
      setNeedsOnboarding(true);

      // NO guardamos en localStorage hasta que complete onboarding

      const destination = clienteData.es_admin ? '/admin' : '/dashboard';
      navigate(destination, { replace: true });

      return clienteData;
    } catch (error) {
      console.error('First time login failed:', error);
      setUser(null);
      setNeedsOnboarding(false);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // Registrar PIN (onboarding)
  const registerPin = useCallback(async (newPin) => {
    if (!user?.telefono) {
      throw new Error('No hay usuario activo');
    }

    setLoading(true);
    try {
      await api.auth.registerPin(user.telefono, newPin);

      // Actualizar usuario sin needsOnboarding
      const updatedUser = { ...user };
      delete updatedUser.needsOnboarding;

      setUser(updatedUser);
      setNeedsOnboarding(false);

      // Ahora sí guardamos en localStorage
      localStorage.setItem('manny_user', JSON.stringify(updatedUser));

      return true;
    } catch (error) {
      console.error('Register PIN failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Login unificado (decide el flujo)
  const login = useCallback(async (telefono, pin = null) => {
    if (pin) {
      return loginWithPin(telefono, pin);
    } else {
      return loginFirstTime(telefono);
    }
  }, [loginWithPin, loginFirstTime]);

  const logout = useCallback(() => {
    setUser(null);
    setNeedsOnboarding(false);
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
    needsOnboarding,
    checkCliente,
    login,
    loginWithPin,
    loginFirstTime,
    registerPin,
    logout,
    updateUser,
  }), [user, isAdmin, isPartner, isVIP, loading, needsOnboarding, checkCliente, login, loginWithPin, loginFirstTime, registerPin, logout, updateUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
