import { create } from 'zustand';
import { supabase } from '../api/supabase';

interface SettingsState {
  flags: Record<string, boolean>;
  models: Record<string, string>;
  loaded: boolean;
  load: () => Promise<void>;
}

export const useSettings = create<SettingsState>((set) => ({
  flags: {},
  models: {},
  loaded: false,

  load: async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('key,value')
        .in('key', ['feature_flags', 'model_config']);
      const flags: Record<string, boolean> = {};
      const models: Record<string, string> = {};
      (data || []).forEach((r: any) => {
        if (r.key === 'feature_flags') Object.assign(flags, r.value || {});
        if (r.key === 'model_config') Object.assign(models, r.value || {});
      });
      set({ flags, models, loaded: true });
    } catch (e) {
      console.log('settings load failed', e);
      set({ loaded: true });
    }
  },
}));

export function isFlagOn(key: string, defaultValue: boolean = true): boolean {
  const f = useSettings.getState().flags[key];
  return f === undefined ? defaultValue : !!f;
}

export function modelFor(key: string): string {
  const m = useSettings.getState().models[key];
  return m || key;
}
