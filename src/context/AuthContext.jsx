
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '@/services/api';
import { safeStorage } from '@/lib/utils';
import { STORAGE_CONFIG } from '@/config';

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
    setLoading(true);
    const storedUser = safeStorage.get(STORAGE_CONFIG.LOCAL_STORAGE_KEYS.USER);
    if (storedUser && typeof storedUser === 'object' && storedUser.id && storedUser.telefono) {
      setUser(storedUser);
    } else {
      safeStorage.remove(STORAGE_CONFIG.LOCAL_STORAGE_KEYS.USER);
    }
    setLoading(false);
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

      safeStorage.set(STORAGE_CONFIG.LOCAL_STORAGE_KEYS.USER, clienteData);

      // Check for pending referral code and apply it
      const pendingReferralCode = safeStorage.getString(STORAGE_CONFIG.LOCAL_STORAGE_KEYS.PENDING_REFERRAL_CODE);
      if (pendingReferralCode && clienteData.id) {
        try {
          const result = await api.referrals.applyReferralCode(clienteData.id, pendingReferralCode);
          safeStorage.remove(STORAGE_CONFIG.LOCAL_STORAGE_KEYS.PENDING_REFERRAL_CODE);
          console.log('Pending referral code applied successfully:', result);
        } catch (referralError) {
          // Only clear the code if it's a business logic error (invalid code, already used, etc.)
          // Keep it for retry if it's a network/server error
          const isBusinessError = referralError.isBusinessError ||
            referralError.message?.includes('inválido') ||
            referralError.message?.includes('expirado') ||
            referralError.message?.includes('ya tiene') ||
            referralError.message?.includes('límite');

          if (isBusinessError) {
            console.warn('Referral code rejected (business error):', referralError.message);
            safeStorage.remove(STORAGE_CONFIG.LOCAL_STORAGE_KEYS.PENDING_REFERRAL_CODE);
          } else {
            // Network error - keep the code for next login attempt
            console.warn('Failed to apply referral code (will retry):', referralError.message);
            // Don't remove - will try again on next login
          }
        }
      }

      const destination = clienteData.es_admin ? '/admin' : '/dashboard';
      const from = location.state?.from?.pathname || destination;
      navigate(from, { replace: true });

      return clienteData;
    } catch (error) {
      console.error('Login failed:', error);
      setUser(null);
      safeStorage.remove(STORAGE_CONFIG.LOCAL_STORAGE_KEYS.USER);
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
      safeStorage.set(STORAGE_CONFIG.LOCAL_STORAGE_KEYS.USER, updatedUser);

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
    safeStorage.remove(STORAGE_CONFIG.LOCAL_STORAGE_KEYS.USER);
    navigate('/login', { replace: true });
  }, [navigate]);

  const updateUser = useCallback((updatedData) => {
    setUser(currentUser => {
      if (!currentUser) return null;
      const newUser = { ...currentUser, ...updatedData };
      safeStorage.set(STORAGE_CONFIG.LOCAL_STORAGE_KEYS.USER, newUser);
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
