import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../api/supabase';
import { setAppLanguage } from '../i18n';

export interface CountryInfo {
  code: string;
  name: string;
  region: string;
  currency: string;
  currency_symbol: string;
  languages: string[];
  default_language: string;
  payment_provider: 'paystack' | 'flutterwave' | 'stripe';
}

interface LocaleState {
  country: CountryInfo | null;
  countries: CountryInfo[];
  language: string | null;
  rate: number;
  loaded: boolean;
  load: () => Promise<void>;
  setCountry: (c: CountryInfo) => Promise<void>;
  setLanguage: (code: string) => Promise<void>;
  clear: () => Promise<void>;
}

const KEY_C = 'gaia_country';
const KEY_L = 'gaia_language';
const KEY_JSON = 'gaia_country_json';
const KEY_RATE = 'gaia_rate';

export const useLocale = create<LocaleState>((set) => ({
  country: null,
  countries: [],
  language: null,
  rate: 1,
  loaded: false,

  load: async () => {
    try {
      // Always fetch countries list (needs anon RLS policy: countries_public_read)
      try {
        const { data, error } = await supabase
          .from('countries')
          .select('code,name,region,currency,currency_symbol,languages,default_language,payment_provider')
          .eq('enabled', true)
          .order('launch_order');
        if (!error && data) set({ countries: data as any });
        else console.warn('[locale] countries fetch failed:', error?.message);
      } catch (e) {
        console.warn('[locale] countries fetch exception:', e);
      }

      const [[, c], [, l], [, j], [, r]] = await AsyncStorage.multiGet([KEY_C, KEY_L, KEY_JSON, KEY_RATE]);
      if (j) {
        const cInfo = JSON.parse(j);
        set({ country: cInfo, language: l || cInfo.default_language || 'en', rate: parseFloat(r || '1') || 1, loaded: true });
        return;
      }
      set({ loaded: true });
    } catch { set({ loaded: true }); }
  },

  setCountry: async (input: CountryInfo | string) => {
    let c: CountryInfo | null = null;
    if (typeof input === 'string') {
      // Look up from countries list in the store, or fetch from DB
      const fromList = (get() as any).countries?.find((x: any) => x.code === input);
      if (fromList) {
        c = fromList;
      } else {
        const { data } = await supabase
          .from('countries')
          .select('code,name,region,currency,currency_symbol,languages,default_language,payment_provider')
          .eq('code', input)
          .eq('enabled', true)
          .maybeSingle();
        c = (data as any) || null;
      }
    } else {
      c = input;
    }
    if (!c) return;
    let rate = 1;
    try {
      const { data } = await supabase.from('currency_rates').select('rate').eq('code', c.currency).maybeSingle();
      if (data && data.rate) rate = Number(data.rate) || 1;
    } catch {}
    await AsyncStorage.multiSet([[KEY_C, c.code], [KEY_JSON, JSON.stringify(c)], [KEY_RATE, String(rate)]]);
    set({ country: c, rate, language: c.default_language || 'en' });
    await AsyncStorage.setItem(KEY_L, c.default_language || 'en');
    await setAppLanguage(c.default_language || 'en');
  },

  setLanguage: async (code: string) => {
    await AsyncStorage.setItem(KEY_L, code);
    await setAppLanguage(code);
    set({ language: code });
  },

  clear: async () => {
    await AsyncStorage.multiRemove([KEY_C, KEY_L, KEY_JSON, KEY_RATE]);
    set({ country: null, language: null, rate: 1 });
  },
}));

export function getProvider(): 'paystack' | 'flutterwave' | 'stripe' {
  return useLocale.getState().country?.payment_provider || 'paystack';
}

export function getCurrency(): string {
  return useLocale.getState().country?.currency || 'NGN';
}

export function getCurrencySymbol(): string {
  return useLocale.getState().country?.currency_symbol || '₦';
}

export function formatLocal(amountNGN: number): string {
  const st = useLocale.getState();
  const rate = st.rate || 1;
  const sym = getCurrencySymbol();
  const local = amountNGN * rate;
  if (rate === 1) return sym + Math.round(local).toLocaleString();
  return sym + local.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 0 });
}

const LANG_NAMES: Record<string, string> = {
  en: 'English', ha: 'Hausa', yo: 'Yoruba', ig: 'Igbo', pcm: 'Pidgin',
  fr: 'Français', sw: 'Kiswahili', ar: 'العربية', pt: 'Português',
  es: 'Español', de: 'Deutsch', it: 'Italiano', nl: 'Nederlands',
  tw: 'Twi', so: 'Somali', am: 'Amharic', rw: 'Kinyarwanda',
  rn: 'Kirundi', mg: 'Malagasy', zu: 'isiZulu', af: 'Afrikaans',
  sn: 'chiShona', nd: 'isiNdebele', ny: 'Chichewa', tn: 'Setswana',
  st: 'Sesotho', ss: 'siSwati', mi: 'Māori', ho: 'Hiri Motu', tpi: 'Tok Pisin',
  fj: 'Fijian', hi: 'हिन्दी', ta: 'தமிழ்', te: 'తెలుగు', bn: 'বাংলা',
  mr: 'मराठी', gu: 'ગુજરાતી', kn: 'ಕನ್ನಡ', ml: 'മലയാളം', pa: 'ਪੰਜਾਬੀ',
  zh: '中文', ja: '日本語', ko: '한국어', id: 'Bahasa Indonesia',
  vi: 'Tiếng Việt', th: 'ไทย', fil: 'Filipino', ms: 'Bahasa Melayu',
  ur: 'اردو', si: 'සිංහල', ne: 'नेपाली', my: 'မြန်မာ', km: 'ខ្មែរ',
  lo: 'ລາວ', tr: 'Türkçe', fa: 'فارسی', he: 'עברית', ku: 'Kurdî',
  uk: 'Українська', ru: 'Русский', pl: 'Polski', cs: 'Čeština',
  hu: 'Magyar', ro: 'Română', bg: 'Български', hr: 'Hrvatski',
  fi: 'Suomi', sv: 'Svenska', no: 'Norsk', da: 'Dansk', el: 'Ελληνικά',
  ga: 'Gaeilge', qu: 'Quechua', ay: 'Aymar', gn: 'Guaraní',
  ca: 'Català', eu: 'Euskara', gl: 'Galego', cy: 'Cymraeg',
  ti: 'ትግርኛ', ka: 'ქართული', hy: 'Հայերեն', az: 'Azərbaycan',
};

export function langName(code: string): string {
  return LANG_NAMES[code] || code.toUpperCase();
}

export function flagEmoji(countryCode: string): string {
  return countryCode.toUpperCase().replace(/./g, (c) =>
    String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
  );
}

const REGION_GROUP: Record<string, string> = {
  west_africa: 'Africa', east_africa: 'Africa', central_africa: 'Africa',
  southern_africa: 'Africa', north_africa: 'Africa',
  europe: 'Europe',
  north_america: 'Americas', south_america: 'Americas',
  south_asia: 'Asia', east_asia: 'Asia', southeast_asia: 'Asia',
  middle_east: 'Middle East',
  oceania: 'Oceania',
};

export function regionGroup(region: string): string {
  return REGION_GROUP[region] || 'Other';
}

export const countryFlag = flagEmoji;
