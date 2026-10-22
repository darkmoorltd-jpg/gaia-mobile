import { useLocale } from '../store/locale';

// Detects if the input text is clearly in a specific language.
// Returns null if uncertain, so caller can fall back to UI language.
export function detectLanguageCode(text: string): string | null {
  if (!text || text.length < 3) return null;
  const t = ' ' + text.toLowerCase() + ' ';

  // Hausa
  if (/\b(barka|sannu|yaya|ina|nawa|zan|yau|gobe|kadai|nagode|madalla|sai anjima|don allah)\b/.test(t)) return 'ha';
  // Yoruba
  if (/\b(bawo|ore|jowo|pele|abi|eki|eshey|jare|kilode|o da|e kaaro|e kaasan)\b/.test(t)) return 'yo';
  // Igbo
  if (/\b(kedu|nnoo|ndewo|gini|bia|nwanne|maka|daalu|ka o di|biko)\b/.test(t)) return 'ig';
  // Pidgin
  if (/\b(wetin|dey|sabi|chop|waka|shey|abi|how far|na so)\b/.test(t)) return 'pcm';
  // Swahili
  if (/\b(habari|asante|karibu|kwaheri|jambo|ndiyo|hapana|tafadhali|sawa)\b/.test(t)) return 'sw';
  // French
  if (/\b(bonjour|merci|oui|salut|comment|bonsoir|au revoir|s'il vous pla\u00eet)\b/.test(t)) return 'fr';
  // Spanish
  if (/\b(hola|gracias|s\u00ed|buenos|por favor|adi\u00f3s)\b/.test(t)) return 'es';
  // Portuguese
  if (/\b(ol\u00e1|obrigado|sim|bom dia|por favor|at\u00e9 logo)\b/.test(t)) return 'pt';
  // Arabic (script)
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  // Amharic (script)
  if (/[\u1200-\u137F]/.test(text)) return 'am';
  // Chinese
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh';
  // Hindi (Devanagari)
  if (/[\u0900-\u097F]/.test(text)) return 'hi';

  return null;
}

// Resolves the language to use for a GAIA request.
// Priority: detected from input > user's UI language > 'en'
export function resolveLanguage(inputText?: string): string {
  const detected = inputText ? detectLanguageCode(inputText) : null;
  if (detected) return detected;
  return useLocale.getState().language || 'en';
}

// Converts a short code to a human-readable name for LLM prompts.
export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', fr: 'French', pt: 'Portuguese', sw: 'Swahili',
  ha: 'Hausa', yo: 'Yoruba', ig: 'Igbo', pcm: 'Nigerian Pidgin',
  ar: 'Arabic', am: 'Amharic', zu: 'Zulu', af: 'Afrikaans',
  so: 'Somali', es: 'Spanish', de: 'German', it: 'Italian',
  nl: 'Dutch', hi: 'Hindi', zh: 'Simplified Chinese',
  tr: 'Turkish', ru: 'Russian',
};

export function languageName(code: string): string {
  return LANGUAGE_NAMES[code] || code.toUpperCase();
}
