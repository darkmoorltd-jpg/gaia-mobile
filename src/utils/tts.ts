import * as Speech from 'expo-speech';
import { findLanguage } from './languages';

// Common agricultural terms that TTS engines often mispronounce.
// We map English spellings to phonetic versions per language.
const PHONETIC_MAP: Record<string, Record<string, string>> = {
  ha: {
    cassava: 'rogo',
    maize: 'masara',
    rice: 'shinkafa',
    yam: 'doya',
    fertilizer: 'takin zamani',
    pesticide: 'maganin kwari',
    leaf: 'ganye',
    disease: 'ciwo',
    healthy: 'lafiya',
  },
  yo: {
    cassava: 'ege',
    maize: 'agbado',
    rice: 'iresi',
    yam: 'isu',
    fertilizer: 'ajile',
    pesticide: 'oogun kokoro',
    leaf: 'ewe',
    disease: 'aisan',
    healthy: 'ni ilera',
  },
  ig: {
    cassava: 'akpu',
    maize: 'ọka',
    rice: 'osikapa',
    yam: 'ji',
    fertilizer: 'fatịlaịza',
    pesticide: 'ọgwụ ahụhụ',
    leaf: 'akwụkwọ',
    disease: 'ọrịa',
    healthy: 'dị mma',
  },
  sw: {
    cassava: 'muhogo',
    maize: 'mahindi',
    rice: 'mchele',
    yam: 'viazi vikuu',
    fertilizer: 'mbolea',
    pesticide: 'dawa ya wadudu',
    leaf: 'jani',
    disease: 'ugonjwa',
    healthy: 'afya',
  },
};

function preprocess(text: string, langCode: string): string {
  const map = PHONETIC_MAP[langCode];
  if (!map) return text;

  let out = text;
  Object.entries(map).forEach(([eng, local]) => {
    const re = new RegExp('\\b' + eng + '\\b', 'gi');
    out = out.replace(re, local);
  });
  return out;
}

// Strip markdown formatting characters
function cleanMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' code block ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/#+\s?/g, '')
    .replace(/\|/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{2,}/g, '. ');
}

export interface SpeakOptions {
  language: string;
  rate?: number;
  pitch?: number;
  onDone?: () => void;
  onStart?: () => void;
  onError?: (e: any) => void;
}

export function speakText(text: string, opts: SpeakOptions) {
  const lang = findLanguage(opts.language);
  const cleaned = cleanMarkdown(text);
  const localized = preprocess(cleaned, lang.code);

  Speech.stop();
  Speech.speak(localized, {
    language: lang.ttsCode,
    rate: opts.rate ?? 0.95,
    pitch: opts.pitch ?? 1.0,
    onDone: opts.onDone,
    onStopped: opts.onDone,
    onError: opts.onError,
    onStart: opts.onStart,
  });
}

export function stopSpeaking() {
  Speech.stop();
}

export async function listAvailableVoices() {
  try {
    return await Speech.getAvailableVoicesAsync();
  } catch {
    return [];
  }
}
