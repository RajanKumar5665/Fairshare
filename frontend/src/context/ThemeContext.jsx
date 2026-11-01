
import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

const THEME_KEY = 'hh-theme';

function getInitialTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);

    if (saved === 'light' || saved === 'dark') {
      return saved;
    }

    return window.matchMedia?.('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  } catch {
    return 'light';
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;

    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;

    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
      console.warn('Unable to save theme preference:', error);
    }

    // Update browser and installed PWA status bar color.
    const themeColor = theme === 'dark' ? '#0B1220' : '#F3F7FF';

    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute('content', themeColor);
    });
  }, [theme]);

  function toggle() {
    setTheme((current) => current === 'dark' ? 'light' : 'dark');
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be inside ThemeProvider');
  }

  return context;
}
