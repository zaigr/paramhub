/**
 * Theme context — the active theme all components read from.
 *
 * Seeded from config.theme; setThemeName enables live switching (setup
 * wizard preview, config reload). Unknown names fall back to the default
 * theme, so a bad config value never breaks rendering.
 */

import React, { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Theme } from './types.js';
import { resolveTheme } from './themes.js';

interface ThemeContextValue {
  theme: Theme;
  themeName: string;
  setThemeName: (name: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  initialThemeName,
  children,
}: {
  initialThemeName?: string;
  children: ReactNode;
}) {
  const [themeName, setThemeName] = useState(
    () => resolveTheme(initialThemeName).name,
  );

  const value = useMemo<ThemeContextValue>(() => {
    const { theme, name } = resolveTheme(themeName);
    return { theme, themeName: name, setThemeName };
  }, [themeName]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
