import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { safeStorage } from '@/lib/utils';

const ThemeContext = createContext(undefined);

const getInitialTheme = () => {
    if (typeof window === 'undefined') return 'light';
    const savedTheme = safeStorage.getString('theme');
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) return savedTheme;
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    safeStorage.setString('theme', theme);
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme]);

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