
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { getClienteByTelefono } = useNotionAPI();

  useEffect(() => {
    const storedUser = localStorage.getItem('manny_user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        setIsAdmin(userData.telefono === ADMIN_PHONE);
      } catch (e) {
        console.error("Failed to parse user from localStorage", e);
        localStorage.removeItem('manny_user');
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (telefono) => {
    const cliente = await getClienteByTelefono(telefono);
    setUser(cliente);
    const isAdminUser = telefono === ADMIN_PHONE;
    setIsAdmin(isAdminUser);
    localStorage.setItem('manny_user', JSON.stringify(cliente));
    
    if (isAdminUser) {
      navigate('/admin');
    } else {
      navigate('/dashboard');
    }
  }, [navigate, getClienteByTelefono]);

  const logout = useCallback(() => {
    setUser(null);
    setIsAdmin(false);
    localStorage.removeItem('manny_user');
    navigate('/login');
  }, [navigate]);

  const updateUser = useCallback((updatedUserData) => {
    setUser(prevUser => {
        const newUser = { ...prevUser, ...updatedUserData };
        localStorage.setItem('manny_user', JSON.stringify(newUser));
        return newUser;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};
