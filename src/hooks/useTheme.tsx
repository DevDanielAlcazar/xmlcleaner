import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'day' | 'afternoon' | 'night';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('app-theme') as Theme;
    return saved || 'day';
  });

  useEffect(() => {
    localStorage.setItem('app-theme', theme);
    const root = window.document.documentElement;
    root.classList.remove('day', 'afternoon', 'night');
    root.classList.add(theme);
    
    // Update meta theme-color for mobile
    const colors = {
      day: '#ffffff',
      afternoon: '#fdf6e3',
      night: '#0a0a0a'
    };
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', colors[theme]);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
