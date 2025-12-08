import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { safeStorage } from '@/lib/utils';

const ThemeContext = createContext(undefined);

// Obtiene el tema del sistema operativo
const getSystemTheme = () => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

// Obtiene la preferencia guardada del usuario o usa el tema del sistema si es primera vez
const getSavedTheme = () => {
  if (typeof window === 'undefined') return 'light';
  const saved = safeStorage.getString('theme');
  if (saved && ['light', 'dark'].includes(saved)) return saved;
  // Primera vez: usar el tema del dispositivo
  return getSystemTheme();
};

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(getSavedTheme);

  // Aplicar el tema al documento
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    safeStorage.setString('theme', theme);
  }, [theme]);

  // Función para cambiar el tema
  const setTheme = useCallback((newTheme) => {
    if (['light', 'dark'].includes(newTheme)) {
      setThemeState(newTheme);
    }
  }, []);

  // Función para alternar entre light y dark
  const toggleTheme = useCallback(() => {
    setThemeState(current => current === 'light' ? 'dark' : 'light');
  }, []);

  const value = useMemo(() => ({
    theme,
    setTheme,
    toggleTheme,
  }), [theme, setTheme, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
