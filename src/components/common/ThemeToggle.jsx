import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/context/ThemeContext';

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className="w-10 h-10 p-2"
      title={theme === 'light' ? 'Modo claro' : 'Modo oscuro'}
    >
      {theme === 'light' ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </Button>
  );
};

export default ThemeToggle;
