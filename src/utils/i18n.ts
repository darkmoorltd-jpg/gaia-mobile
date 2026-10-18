import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { supabase } from '../api/supabase';

let initialized = false;
const loadedLangs = new Set<string>();

export async function initI18n(initialLang: string = 'en') {
  if (initialized) {
    await loadLanguage(initialLang);
    return;
  }
  initialized = true;

  await i18n.use(initReactI18next).init({
    lng: initialLang,
    fallbackLng: 'en',
    resources: { en: { translation: {} } },
    interpolation: { escapeValue: false },
    returnNull: false,
    compatibilityJSON: 'v3',
  });
  await loadLanguage(initialLang);
}

export async function loadLanguage(lang: string): Promise<void> {
  if (loadedLangs.has(lang)) {
    await i18n.changeLanguage(lang);
    return;
  }
  try {
    const { data } = await supabase
      .from('translations')
      .select('key,value')
      .eq('language_code', lang);
    if (data && data.length > 0) {
      const bundle: Record<string, string> = {};
      for (const row of data as any[]) bundle[row.key] = row.value;
      i18n.addResourceBundle(lang, 'translation', bundle, true, true);
      loadedLangs.add(lang);
    }
  } catch {}
  await i18n.changeLanguage(lang);
}

export function t(key: string, options?: any): string {
  return i18n.t(key, options) as string;
}

export { i18n };
