'use client';

import { useEffect, useRef } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const previousThemeRef = useRef(theme);
  const announceRef = useRef<HTMLDivElement>(null);

  const cycleTheme = () => {
    const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    setTheme(nextTheme);
  };

  const getIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun size={16} />;
      case 'dark':
        return <Moon size={16} />;
      case 'system':
        return <Monitor size={16} />;
    }
  };

  const getLabel = () => {
    switch (theme) {
      case 'light':
        return 'Light mode';
      case 'dark':
        return 'Dark mode';
      case 'system':
        return 'System theme';
    }
  };

  const getNextLabel = () => {
    switch (theme) {
      case 'light':
        return 'dark mode';
      case 'dark':
        return 'system theme';
      case 'system':
        return 'light mode';
    }
  };

  // Announce theme changes to screen readers
  useEffect(() => {
    if (previousThemeRef.current !== theme && announceRef.current) {
      // Update the announcement text only when theme changes
      announceRef.current.textContent = `Theme changed to ${getLabel()}`;
      previousThemeRef.current = theme;
    }
  }, [theme]);

  return (
    <>
      <button
        onClick={cycleTheme}
        className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        title={getLabel()}
        aria-label={`Current theme: ${getLabel()}. Switch to ${getNextLabel()}`}
      >
        {getIcon()}
      </button>
      {/* Screen reader announcement for theme changes */}
      <div
        ref={announceRef}
        className="fixed left-[-10000px] w-px h-px overflow-hidden"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      />
    </>
  );
}
