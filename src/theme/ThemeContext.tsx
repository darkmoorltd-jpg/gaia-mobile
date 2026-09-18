import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  darkPalette, lightPalette, Palette,
  shadowsDark, shadowsLight, typography, spacing, radius,
} from './index';

type ThemeMode = 'dark' | 'light';

interface ThemeValue {
  mode: ThemeMode;
  palette: Palette;
  shadows: typeof shadowsDark;
  typography: typeof typography;
  spacing: typeof spacing;
  radius: typeof radius;
  toggle: () => void;
  setMode: (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

const STORAGE_KEY = '@gaia:theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark');

  // Load saved preference on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark') {
        setModeState(saved);
      }
    });
  }, []);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(STORAGE_KEY, m).catch(() => {});
  };

  const toggle = () => setMode(mode === 'dark' ? 'light' : 'dark');

  const isDark = mode === 'dark';

  const value: ThemeValue = {
    mode,
    palette: isDark ? darkPalette : lightPalette,
    shadows: isDark ? shadowsDark : shadowsLight,
    typography,
    spacing,
    radius,
    toggle,
    setMode,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

// Helper: build styles dynamically from the current palette
export function useStyles<T>(factory: (t: ThemeValue) => T): T {
  const theme = useTheme();
  return factory(theme);
}
