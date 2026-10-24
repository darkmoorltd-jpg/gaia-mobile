import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'dark' | 'light' | 'auto';

interface ThemeModeState {
  mode: ThemeMode;
  loaded: boolean;
  load: () => Promise<void>;
  setMode: (m: ThemeMode) => Promise<void>;
}

export const useThemeMode = create<ThemeModeState>((set) => ({
  mode: 'auto',
  loaded: false,
  load: async () => {
    try {
      const stored = await AsyncStorage.getItem('gaia_theme_mode');
      const m = (stored === 'light' || stored === 'dark' || stored === 'auto' ? stored : 'auto') as ThemeMode;
      set({ mode: m, loaded: true });
    } catch {
      set({ mode: 'auto', loaded: true });
    }
  },
  setMode: async (m) => {
    try {
      await AsyncStorage.setItem('gaia_theme_mode', m);
    } catch {}
    set({ mode: m });
  },
}));
