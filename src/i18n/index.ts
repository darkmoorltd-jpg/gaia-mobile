import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import af from './locales/af.json';
import am from './locales/am.json';
import ar from './locales/ar.json';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import ha from './locales/ha.json';
import hi from './locales/hi.json';
import ig from './locales/ig.json';
import it from './locales/it.json';
import nl from './locales/nl.json';
import pcm from './locales/pcm.json';
import pt from './locales/pt.json';
import ru from './locales/ru.json';
import so from './locales/so.json';
import sw from './locales/sw.json';
import tr from './locales/tr.json';
import yo from './locales/yo.json';
import zh from './locales/zh.json';
import zu from './locales/zu.json';

const resources = {
  'af': { translation: af },
  'am': { translation: am },
  'ar': { translation: ar },
  'de': { translation: de },
  'en': { translation: en },
  'es': { translation: es },
  'fr': { translation: fr },
  'ha': { translation: ha },
  'hi': { translation: hi },
  'ig': { translation: ig },
  'it': { translation: it },
  'nl': { translation: nl },
  'pcm': { translation: pcm },
  'pt': { translation: pt },
  'ru': { translation: ru },
  'so': { translation: so },
  'sw': { translation: sw },
  'tr': { translation: tr },
  'yo': { translation: yo },
  'zh': { translation: zh },
  'zu': { translation: zu },
};

i18n.use(initReactI18next).init({
  resources, lng: 'en', fallbackLng: 'en',
  compatibilityJSON: 'v4',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
  returnNull: false, returnEmptyString: false,
});

export async function setAppLanguage(code) {
  const safe = code || 'en';
  try {
    if (!i18n.hasResourceBundle(safe, 'translation')) {
      await i18n.changeLanguage('en');
      await AsyncStorage.setItem('gaia_language', 'en');
      return;
    }
    await i18n.changeLanguage(safe);
    await AsyncStorage.setItem('gaia_language', safe);
  } catch (e) { console.warn('[i18n]', e); }
}

export async function loadStoredLanguage() {
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
