import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Two independent choices:
 *  - mode:   'light' | 'dark' | 'system' (follows the phone/computer setting)
 *  - accent: one of ACCENTS (the app's colour)
 * They are applied as <html data-theme="light|dark" data-accent="ocean|…">.
 * index.html applies the saved choice before the app loads, so there is no colour flash.
 */
export const ACCENTS = [
  { id: 'ocean', name: 'Ocean blue', swatch: '#1769E0', bar: { light: '#F2F6FD', dark: '#0B111C' } },
  { id: 'emerald', name: 'Emerald green', swatch: '#059669', bar: { light: '#F1F8F5', dark: '#09110F' } },
  { id: 'violet', name: 'Royal violet', swatch: '#7C3AED', bar: { light: '#F6F3FD', dark: '#0F0C17' } },
  { id: 'sunset', name: 'Sunset orange', swatch: '#EA580C', bar: { light: '#FCF5F1', dark: '#130E0B' } },
];

const MODE_KEY = 'sc-mode';
const ACCENT_KEY = 'sc-accent';
const LEGACY_KEY = 'hh-theme';

const ThemeContext = createContext(null);

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode etc. — the choice just won't be remembered */
  }
}

function initialMode() {
  const saved = read(MODE_KEY);
  if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  const legacy = read(LEGACY_KEY); // choice made before themes existed
  if (legacy === 'light' || legacy === 'dark') return legacy;
  return 'system';
}

function initialAccent() {
  const saved = read(ACCENT_KEY);
  return ACCENTS.some((a) => a.id === saved) ? saved : 'ocean';
}

const systemDark = () => Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches);

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(initialMode);
  const [accent, setAccentState] = useState(initialAccent);
  const [osDark, setOsDark] = useState(systemDark);

  // Follow the phone/computer when mode is 'system'
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return undefined;
    const onChange = (e) => setOsDark(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const theme = mode === 'system' ? (osDark ? 'dark' : 'light') : mode;

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-accent', accent);
    root.style.colorScheme = theme;
    write(MODE_KEY, mode);
    write(ACCENT_KEY, accent);
    write(LEGACY_KEY, theme);

    // Browser bar / installed-app status bar colour
    const a = ACCENTS.find((x) => x.id === accent) || ACCENTS[0];
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute('content', a.bar[theme]));
  }, [theme, mode, accent]);

  const setMode = useCallback((m) => setModeState(m), []);
  const setAccent = useCallback((a) => setAccentState(a), []);
  // Old quick switch (sidebar button): flips between light and dark
  const toggle = useCallback(() => setModeState(theme === 'dark' ? 'light' : 'dark'), [theme]);

  const value = useMemo(() => ({ theme, mode, accent, setMode, setAccent, toggle }), [theme, mode, accent, setMode, setAccent, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be inside ThemeProvider');
  return context;
}
