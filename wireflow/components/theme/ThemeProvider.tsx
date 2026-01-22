'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'wireflow-theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  // Initialize theme from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored && ['light', 'dark', 'system'].includes(stored)) {
      setThemeState(stored);
    }
  }, []);

  // Apply theme to document and compute resolved theme
  useEffect(() => {
    const root = document.documentElement;

    /**
     * Applies the theme to the document root element.
     * @param isDark - Whether to apply dark theme (true) or light theme (false)
     * @param isUserSelected - Whether the user explicitly selected this theme (true)
     *                         or it's derived from system preferences (false).
     *                         When true, always adds the theme class.
     *                         When false (system mode), only adds 'dark' class when needed.
     */
    const applyTheme = (isDark: boolean, isUserSelected: boolean) => {
      // Remove both classes first
      root.classList.remove('dark', 'light');

      if (isUserSelected) {
        // User explicitly selected this theme: add the appropriate class
        root.classList.add(isDark ? 'dark' : 'light');
      } else if (isDark) {
        // System preference dark: add dark class
        root.classList.add('dark');
      }
      // System preference light: no class needed (default)

      setResolvedTheme(isDark ? 'dark' : 'light');
    };

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches, false);

      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches, false);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      applyTheme(theme === 'dark', true);
    }
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
