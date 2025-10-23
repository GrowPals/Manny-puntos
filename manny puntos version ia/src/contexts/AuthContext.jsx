import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseAPI } from '@/context/SupabaseContext'; // Asumimos que SupabaseProvider está por encima

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
  const [user, setUser] = useState(null); // Contendrá los datos de la tabla clientes
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const api = useSupabaseAPI();

  const fetchUserProfile = useCallback(async (supabaseUser) => {
    if (!supabaseUser || !supabaseUser.phone) return null;
    try {
      const userProfile = await api.getClienteByTelefono(supabaseUser.phone);
      return userProfile;
    } catch (error) {
      console.error("Error fetching user profile:", error);
      return null;
    }
  }, [api]);


  useEffect(() => {
    const getSessionAndProfile = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        if (session?.user) {
            const profile = await fetchUserProfile(session.user);
            setUser(profile);
        }
        setLoading(false);
    };
    
    getSessionAndProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        setSession(session);
        if (session?.user) {
            const profile = await fetchUserProfile(session.user);
            setUser(profile);
        } else {
            setUser(null);
        }
        setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchUserProfile]);


  const login = useCallback(async (telefono) => {
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(telefono)) {
        throw new Error('Formato de teléfono inválido. Deben ser 10 dígitos.');
    }

    // Para el login, usamos un truco con una contraseña dummy, ya que no queremos manejar contraseñas reales.
    // Esto es solo para la demo. En producción, se usaría un sistema de OTP (One-Time Password) con SMS.
    const { error } = await supabase.auth.signInWithPassword({
        phone: `+52${telefono}`,
        password: `password-${telefono}` // Contraseña predecible para la demo
    });

    if (error) {
        // Si el usuario no existe, lo creamos
        if (error.message.includes('Invalid login credentials')) {
            const { error: signUpError } = await supabase.auth.signUp({
                phone: `+52${telefono}`,
                password: `password-${telefono}`
            });
            if (signUpError) {
                 console.error("Sign up error:", signUpError);
                 throw new Error("No se pudo registrar el nuevo usuario.");
            }
             // Intentar login de nuevo después de registrar
            const { error: signInAgainError } = await supabase.auth.signInWithPassword({
                phone: `+52${telefono}`,
                password: `password-${telefono}`
            });
             if(signInAgainError) throw new Error("Fallo al iniciar sesión después de registrar.");
        } else {
            throw error;
        }
    }
    
    // El onAuthStateChange se encargará de setear el usuario y redirigir
    const isAdmin = telefono === ADMIN_PHONE;
    const from = location.state?.from?.pathname || (isAdmin ? '/admin' : '/dashboard');
    navigate(from, { replace: true });
    
  }, [navigate, location.state]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  const updateUser = useCallback(async (updatedUserData) => {
    if (!user) return;
    const {data, error} = await api.crearOActualizarCliente({...user, ...updatedUserData});
    if(!error) {
        const updatedProfile = await fetchUserProfile(session.user);
        setUser(updatedProfile);
    }
  }, [user, api, fetchUserProfile, session]);
  
  const isAdmin = useMemo(() => user?.es_admin === true, [user]);

  const value = useMemo(() => ({
    user,
    session,
    isAdmin,
    loading,
    login,
    logout,
    updateUser,
  }), [user, session, isAdmin, loading, login, logout, updateUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};