
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSupabaseAPI } from '@/context/SupabaseContext';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// AuthProvider with improved validation, error handling, and timeouts.
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const api = useSupabaseAPI();

  // On initial load, check for a valid user in localStorage.
  useEffect(() => {
    try {
      setLoading(true);
      const storedUser = localStorage.getItem('manny_user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        // Validate the structure of the stored user object.
        if (parsedUser && typeof parsedUser === 'object' && parsedUser.id && parsedUser.telefono) {
          setUser(parsedUser);
        } else {
          console.warn("Corrupt user data found in localStorage. Clearing.");
          localStorage.removeItem('manny_user');
        }
      }
    } catch (error) {
      console.error("Failed to parse user from localStorage. Clearing.", error);
      localStorage.removeItem('manny_user');
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (telefono) => {
    // 1. API availability check
    if (!api || typeof api.getClienteByTelefono !== 'function') {
      throw new Error('Sistema de autenticación no disponible. Inténtalo de nuevo.');
    }

    // 2. Robust phone number validation
    const telefonoLimpio = String(telefono).replace(/\D/g, '');
    if (!/^[0-9]{10}$/.test(telefonoLimpio)) {
        throw new Error('El número de teléfono debe contener exactamente 10 dígitos.');
    }

    setLoading(true);

    // 3. Timeout mechanism
    const loginPromise = api.getClienteByTelefono(telefonoLimpio);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('La solicitud tardó demasiado. Revisa tu conexión.')), 10000)
    );

    try {
      const clienteData = await Promise.race([loginPromise, timeoutPromise]);
      
      if (!clienteData) {
        throw new Error('Número no registrado o incorrecto.');
      }
      
      setUser(clienteData);
      localStorage.setItem('manny_user', JSON.stringify(clienteData));
      
      const destination = clienteData.es_admin ? '/admin' : '/dashboard';
      const from = location.state?.from?.pathname || destination;
      navigate(from, { replace: true });

    } catch (error) {
      console.error('Login failed:', error);
      // Ensure user state is clean on failure
      setUser(null);
      localStorage.removeItem('manny_user');
      throw error; // Re-throw to be caught by the Login page for toast notifications
    } finally {
      setLoading(false);
    }
  }, [api, navigate, location.state]);

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
