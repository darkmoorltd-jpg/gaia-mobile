import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../api/supabase';

const COUNTRY_KEY = 'gaia_country';
const LANGUAGE_KEY = 'gaia_language';

export interface Country {
  code: string;
  name: string;
  region: string | null;
  currency: string;
  currency_symbol: string | null;
  phone_prefix: string;
  languages: string[];
  default_language: string;
  payment_provider: string;
  crops: string[];
  enabled: boolean;
  launch_order: number | null;
}

const FALLBACK: Country = {
  code: 'NG',
  name: 'Nigeria',
  region: 'west_africa',
  currency: 'NGN',
  currency_symbol: '\u20A6',
  phone_prefix: '234',
  languages: ['en', 'ha', 'yo', 'ig', 'pcm'],
  default_language: 'en',
  payment_provider: 'paystack',
  crops: ['maize','cassava','rice','yam','tomato','pepper','cabbage','sorghum','millet','soybean','groundnut'],
  enabled: true,
  launch_order: 1,
};

interface LocaleState {
  country: Country;
  language: string;
  loaded: boolean;
  detectedCode: string | null;
  countries: Country[];
  detect: () => string;
  setCountry: (code: string) => Promise<void>;
  setLanguage: (lang: string) => Promise<void>;
  load: () => Promise<void>;
  formatMoney: (n: number) => string;
}

function detectCountry(): string {
  try {
    const loc = Intl.DateTimeFormat().resolvedOptions().locale || '';
    const parts = loc.split('-');
    if (parts.length >= 2) return parts[parts.length - 1].toUpperCase();
  } catch {}
  return 'NG';
}

export const useLocale = create<LocaleState>((set, get) => ({
  country: FALLBACK,
  language: 'en',
  loaded: false,
  detectedCode: null,
  countries: [],

  detect: () => {
    const c = detectCountry();
    set({ detectedCode: c });
    return c;
  },

  setCountry: async (code: string) => {
    let row = get().countries.find((c) => c.code === code);
    if (!row) {
      try {
        const { data, error } = await supabase
          .from('countries')
          .select('*')
          .eq('code', code)
          .maybeSingle();
        if (!error && data) row = data as Country;
      } catch {}
    }
    if (!row) return;
    try { await AsyncStorage.setItem(COUNTRY_KEY, code); } catch {}
    const currentLang = get().language;
    const nextLang = row.languages.includes(currentLang) ? currentLang : row.default_language;
    set({ country: row, language: nextLang });
  },

  setLanguage: async (lang: string) => {
    try { await AsyncStorage.setItem(LANGUAGE_KEY, lang); } catch {}
    set({ language: lang });
  },

  load: async () => {
    try {
      const { data, error } = await supabase
        .from('countries')
        .select('*')
        .eq('enabled', true)
        .order('launch_order', { ascending: true });
      if (!error && data && data.length > 0) {
        set({ countries: data as Country[] });
      }
    } catch {}

    let savedLang: string | null = null;
    try { savedLang = await AsyncStorage.getItem(LANGUAGE_KEY); } catch {}
    if (savedLang) set({ language: savedLang });

    let savedCode: string | null = null;
    try { savedCode = await AsyncStorage.getItem(COUNTRY_KEY); } catch {}

    if (savedCode) {
      await get().setCountry(savedCode);
    } else {
      const detected = get().detect();
      await get().setCountry(detected);
    }
    set({ loaded: true });
  },

  formatMoney: (n: number) => {
    const c = get().country;
    try {
      return new Intl.NumberFormat(get().language, {
        style: 'currency',
        currency: c.currency,
        maximumFractionDigits: 0,
      }).format(n);
    } catch {
      return (c.currency_symbol || c.currency) + ' ' + Number(n || 0).toLocaleString();
    }
  },
}));
