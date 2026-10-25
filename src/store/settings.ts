import { create } from 'zustand';
import { supabase } from '../api/supabase';

interface SettingsState {
  // Effective flags (global merged with country overrides) — what components read
  flags: Record<string, boolean>;
  // Raw values for admin UI
  globalFlags: Record<string, boolean>;
  countryOverrides: Record<string, boolean>;
  countryCode: string | null;
  models: Record<string, string>;
  loaded: boolean;
  load: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
}

let _pollId: any = null;

export const useSettings = create<SettingsState>((set, get) => ({
  flags: {},
  globalFlags: {},
  countryOverrides: {},
  countryCode: null,
  models: {},
  loaded: false,

  load: async () => {
    try {
      // 1. Resolve current country
      let countryCode: string | null = null;
      try {
        const { useLocale } = await import('./locale');
        countryCode = useLocale.getState().country?.code || null;
      } catch {}

      // 2. Fetch global flags + models
      const { data } = await supabase
        .from('app_settings')
        .select('key,value')
        .in('key', ['feature_flags', 'model_config']);

      const globalFlags: Record<string, boolean> = {};
      const models: Record<string, string> = {};
      (data || []).forEach((r: any) => {
        if (r.key === 'feature_flags') Object.assign(globalFlags, r.value || {});
        if (r.key === 'model_config') Object.assign(models, r.value || {});
      });

      // 3. Fetch country overrides
      const countryOverrides: Record<string, boolean> = {};
      if (countryCode) {
        try {
          const { data: cdata, error: cErr } = await supabase.rpc('country_flags', {
            p_country: countryCode,
          });
          if (!cErr && Array.isArray(cdata)) {
            (cdata as any[]).forEach((row) => {
              if (row && row.key) countryOverrides[row.key] = !!row.enabled;
            });
          }
        } catch {}
      }

      // 4. Effective flags = global defaults overridden by country
      const flags: Record<string, boolean> = { ...globalFlags };
      Object.entries(countryOverrides).forEach(([k, v]) => {
        flags[k] = v;
      });

      set({
        flags,
        globalFlags,
        countryOverrides,
        countryCode,
        models,
        loaded: true,
      });
    } catch (e) {
      console.log('[settings] load failed', e);
      set({ loaded: true });
    }
  },

  startPolling: () => {
    if (_pollId) return;
    _pollId = setInterval(() => {
      get().load().catch(() => {});
    }, 60_000);
  },

  stopPolling: () => {
    if (_pollId) {
      clearInterval(_pollId);
      _pollId = null;
    }
  },
}));

// Helper for event handlers only (NOT for render)
export function isFlagOn(key: string, defaultValue: boolean = true): boolean {
  const f = useSettings.getState().flags[key];
  return f === undefined ? defaultValue : !!f;
}

export function modelFor(key: string): string {
  const m = useSettings.getState().models[key];
  return m || key;
}
