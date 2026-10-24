import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import af from './locales/af.json';
import am from './locales/am.json';
import ar from './locales/ar.json';
import bn from './locales/bn.json';
import da from './locales/da.json';
import de from './locales/de.json';
import el from './locales/el.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fa from './locales/fa.json';
import fil from './locales/fil.json';
import fr from './locales/fr.json';
import ha from './locales/ha.json';
import he from './locales/he.json';
import hi from './locales/hi.json';
import id from './locales/id.json';
import ig from './locales/ig.json';
import it from './locales/it.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import mg from './locales/mg.json';
import ms from './locales/ms.json';
import nl from './locales/nl.json';
import no from './locales/no.json';
import pcm from './locales/pcm.json';
import pl from './locales/pl.json';
import pt from './locales/pt.json';
import ru from './locales/ru.json';
import rw from './locales/rw.json';
import sn from './locales/sn.json';
import so from './locales/so.json';
import sv from './locales/sv.json';
import sw from './locales/sw.json';
import th from './locales/th.json';
import tr from './locales/tr.json';
import tw from './locales/tw.json';
import uk from './locales/uk.json';
import ur from './locales/ur.json';
import vi from './locales/vi.json';
import yo from './locales/yo.json';
import zh from './locales/zh.json';
import zu from './locales/zu.json';

const resources = {
  'af': { translation: af },
  'am': { translation: am },
  'ar': { translation: ar },
  'bn': { translation: bn },
  'da': { translation: da },
  'de': { translation: de },
  'el': { translation: el },
  'en': { translation: en },
  'es': { translation: es },
  'fa': { translation: fa },
  'fil': { translation: fil },
  'fr': { translation: fr },
  'ha': { translation: ha },
  'he': { translation: he },
  'hi': { translation: hi },
  'id': { translation: id },
  'ig': { translation: ig },
  'it': { translation: it },
  'ja': { translation: ja },
  'ko': { translation: ko },
  'mg': { translation: mg },
  'ms': { translation: ms },
  'nl': { translation: nl },
  'no': { translation: no },
  'pcm': { translation: pcm },
  'pl': { translation: pl },
  'pt': { translation: pt },
  'ru': { translation: ru },
  'rw': { translation: rw },
  'sn': { translation: sn },
  'so': { translation: so },
  'sv': { translation: sv },
  'sw': { translation: sw },
  'th': { translation: th },
  'tr': { translation: tr },
  'tw': { translation: tw },
  'uk': { translation: uk },
  'ur': { translation: ur },
  'vi': { translation: vi },
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

export async function setAppLanguage(code: string) {
  const s = code || 'en';
  try {
    if (!i18n.hasResourceBundle(s, 'translation')) {
      await i18n.changeLanguage('en');
      await AsyncStorage.setItem('gaia_language', 'en');
      return;
    }
    await i18n.changeLanguage(s);
    await AsyncStorage.setItem('gaia_language', s);
  } catch (e) { console.warn('[i18n]', e); }
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
