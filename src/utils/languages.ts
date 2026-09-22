export interface LanguageDef {
  code: string;             // app-level key
  name: string;             // display name
  nativeName: string;       // native script
  ttsCode: string;          // expo-speech locale code
  whisperCode: string;      // Groq Whisper language hint
  flag: string;             // simple emoji indicator
}

export const LANGUAGES: LanguageDef[] = [
  { code: 'en',      name: 'English',   nativeName: 'English',   ttsCode: 'en-NG',  whisperCode: 'en',  flag: 'EN' },
  { code: 'pcm',     name: 'Pidgin',    nativeName: 'Naija',     ttsCode: 'en-NG',  whisperCode: 'en',  flag: 'PC' },
  { code: 'ha',      name: 'Hausa',     nativeName: 'Hausa',     ttsCode: 'ha-NG',  whisperCode: 'ha',  flag: 'HA' },
  { code: 'yo',      name: 'Yoruba',    nativeName: 'Yorùbá',    ttsCode: 'yo-NG',  whisperCode: 'yo',  flag: 'YO' },
  { code: 'ig',      name: 'Igbo',      nativeName: 'Igbo',      ttsCode: 'ig-NG',  whisperCode: 'ig',  flag: 'IG' },
  { code: 'sw',      name: 'Swahili',   nativeName: 'Kiswahili', ttsCode: 'sw-KE',  whisperCode: 'sw',  flag: 'SW' },
  { code: 'am',      name: 'Amharic',   nativeName: 'አማርኛ',       ttsCode: 'am-ET',  whisperCode: 'am',  flag: 'AM' },
  { code: 'zu',      name: 'Zulu',      nativeName: 'isiZulu',   ttsCode: 'zu-ZA',  whisperCode: 'zu',  flag: 'ZU' },
  { code: 'fr',      name: 'French',    nativeName: 'Français',  ttsCode: 'fr-FR',  whisperCode: 'fr',  flag: 'FR' },
  { code: 'ar',      name: 'Arabic',    nativeName: 'العربية',    ttsCode: 'ar-EG',  whisperCode: 'ar',  flag: 'AR' },
];

export function findLanguage(code: string): LanguageDef {
  return LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];
}
