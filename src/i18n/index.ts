import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en.json';

const resources = {
  en: { translation: en },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    compatibilityJSON: 'v4',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

export async function setAppLanguage(code: string) {
  const safe = code || 'en';
  try {
    await i18n.changeLanguage(safe);
    await AsyncStorage.setItem('gaia_language', safe);
  } catch (e) {
    console.warn('[i18n] changeLanguage failed', e);
  }
}

export async function loadStoredLanguage(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem('gaia_language');
    if (stored && i18n.hasResourceBundle(stored, 'translation')) {
      await i18n.changeLanguage(stored);
      return stored;
    }
  } catch {}
  return i18n.language || 'en';
}

export default i18n;
