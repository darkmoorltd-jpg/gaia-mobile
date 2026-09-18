import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================
// PALETTES
// ============================================
export const darkPalette = {
  obsidian: '#000000',
  abyss: '#080c0a',
  surface: 'rgba(255, 255, 255, 0.03)',
  surfaceHi: 'rgba(255, 255, 255, 0.06)',
  border: 'rgba(0, 255, 136, 0.12)',
  borderHi: 'rgba(0, 255, 136, 0.28)',
  neon: '#00ff88',
  neonDim: '#00cc6a',
  neonGlow: 'rgba(0, 255, 136, 0.35)',
  neonSoft: 'rgba(0, 255, 136, 0.08)',
  crops: '#00ff88',
  pests: '#ff8a3d',
  soil: '#c68a5c',
  livestock: '#b47aff',
  danger: '#ff3b5c',
  warning: '#ffb830',
  text: '#ffffff',
  textMuted: '#7a8884',
  textDim: '#4a5350',
  gradientDeep: ['#000000', '#051410', '#000000'],
  gradientNeon: ['#00ff88', '#00cc6a'],
  gradientCrops: ['#003a1f', '#00ff88'],
  gradientPests: ['#3a1a00', '#ff8a3d'],
  gradientSoil: ['#2a1a0d', '#c68a5c'],
  gradientLive: ['#1a0033', '#b47aff'],
};

export const lightPalette = {
  obsidian: '#ffffff',
  abyss: '#f5f7fa',
  surface: 'rgba(0, 0, 0, 0.04)',
  surfaceHi: 'rgba(0, 0, 0, 0.08)',
  border: 'rgba(0, 150, 80, 0.2)',
  borderHi: 'rgba(0, 150, 80, 0.45)',
  neon: '#009e52',
  neonDim: '#007a3e',
  neonGlow: 'rgba(0, 158, 82, 0.25)',
  neonSoft: 'rgba(0, 158, 82, 0.1)',
  crops: '#009e52',
  pests: '#d46a1f',
  soil: '#8a5a35',
  livestock: '#7a3fc9',
  danger: '#c92a3f',
  warning: '#c98a10',
  text: '#0a1a12',
  textMuted: '#4a5a52',
  textDim: '#8a9990',
  gradientDeep: ['#ffffff', '#eef4f0', '#ffffff'],
  gradientNeon: ['#009e52', '#00b862'],
  gradientCrops: ['#d4f0e0', '#009e52'],
  gradientPests: ['#fde8d4', '#d46a1f'],
  gradientSoil: ['#f0e4d4', '#8a5a35'],
  gradientLive: ['#ece0f8', '#7a3fc9'],
};

export type Palette = typeof darkPalette;

// ============================================
// TYPOGRAPHY / SPACING / RADIUS
// ============================================
export const typography = {
  hero: { fontSize: 42, fontWeight: '900' as const, letterSpacing: -1.5 },
  title: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -1 },
  heading: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.5 },
  body: { fontSize: 15, fontWeight: '500' as const },
  caption: { fontSize: 13, fontWeight: '500' as const, letterSpacing: 0.3 },
  micro: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 1.2 },
  mono: { fontSize: 12, fontFamily: 'monospace', letterSpacing: 0.5 },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };

export const radius = { sm: 10, md: 16, lg: 22, xl: 28, full: 999 };

// ============================================
// SHADOWS
// ============================================
export const shadowsDark = {
  neon: {
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 12,
  },
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
};

export const shadowsLight = {
  neon: {
    shadowColor: '#009e52',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
};

export type Shadows = typeof shadowsDark;

// ============================================
// THEME CONTEXT
// ============================================
export type ThemeMode = 'dark' | 'light';

export interface ThemeValue {
  mode: ThemeMode;
  palette: Palette;
  shadows: Shadows;
  typography: typeof typography;
  spacing: typeof spacing;
  radius: typeof radius;
  toggle: () => void;
  setMode: (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);
const STORAGE_KEY = '@gaia:theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark') setModeState(saved);
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

// Static fallback for one-off imports
export const palette = darkPalette;
export const shadows = shadowsDark;
