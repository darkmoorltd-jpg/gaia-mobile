import * as Speech from 'expo-speech';

const LANG_MAP = {
  english: 'en-GB',
  hausa: 'ha-NG',
  yoruba: 'yo-NG',
  igbo: 'ig-NG',
  pidgin: 'en-NG',
  french: 'fr-FR',
};

let currentUtterance = null;

export function isSpeaking() {
  return currentUtterance !== null;
}

export async function speak(text, language = 'english', options = {}) {
  // Stop any ongoing speech
  await stopSpeaking();

  if (!text || !text.trim()) return;

  const lang = LANG_MAP[language] || 'en-GB';

  return new Promise((resolve) => {
    currentUtterance = text;

    Speech.speak(text, {
      language: lang,
      pitch: options.pitch ?? 1.0,
      rate: options.rate ?? 0.92,
      onDone: () => {
        currentUtterance = null;
        resolve();
      },
      onStopped: () => {
        currentUtterance = null;
        resolve();
      },
      onError: (err) => {
        console.warn('TTS error:', err);
        currentUtterance = null;
        resolve();
      },
    });
  });
}

export async function stopSpeaking() {
  try {
    const speaking = await Speech.isSpeakingAsync();
    if (speaking) {
      await Speech.stop();
    }
  } catch (e) {
    // ignore
  }
  currentUtterance = null;
}

export async function getAvailableVoices() {
  try {
    return await Speech.getAvailableVoicesAsync();
  } catch {
    return [];
  }
}

export function supportsLanguage(language) {
  return language in LANG_MAP;
}
