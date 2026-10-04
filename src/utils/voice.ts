import { fromByteArray } from 'base64-js';
import { AudioModule, setAudioModeAsync, RecordingPresets } from 'expo-audio';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../api/supabase';

const API_BASE = 'https://gaia-api-xuly.onrender.com';

export interface LangOption {
  code: string;
  label: string;
  ttsCode: string;
  flag: string;
  prompt: string;
  greeting: string;
  voiceHints: string[];
}

export const LANGUAGES: LangOption[] = [
  { code: 'en', label: 'English', ttsCode: 'en-NG', flag: 'EN',
    prompt: 'Welcome to GAIA.', greeting: 'Hello, I am GAIA.',
    voiceHints: ['en-NG','en-GB','en-US','english'] },
  { code: 'ha', label: 'Hausa', ttsCode: 'ha-NG', flag: 'HA',
    prompt: 'Barka da zuwa GAIA.', greeting: 'Sannu, ni ce GAIA.',
    voiceHints: ['ha-NG','ha','hausa'] },
  { code: 'yo', label: 'Yoruba', ttsCode: 'yo-NG', flag: 'YO',
    prompt: 'E ku abo si GAIA.', greeting: 'E n le, emi ni GAIA.',
    voiceHints: ['yo-NG','yo','yoruba'] },
  { code: 'ig', label: 'Igbo', ttsCode: 'ig-NG', flag: 'IG',
    prompt: 'Nnoo na GAIA.', greeting: 'Ndeewo, abu m GAIA.',
    voiceHints: ['ig-NG','ig','igbo'] },
  { code: 'pcm', label: 'Pidgin', ttsCode: 'en-NG', flag: 'PC',
    prompt: 'Welcome to GAIA.', greeting: 'How far, I be GAIA.',
    voiceHints: ['en-NG','en-GB','english'] },
  { code: 'fr', label: 'Francais', ttsCode: 'fr-FR', flag: 'FR',
    prompt: 'Bienvenue sur GAIA.', greeting: 'Bonjour, je suis GAIA.',
    voiceHints: ['fr-FR','fr-CA','fr','french','francais'] },
  { code: 'sw', label: 'Kiswahili', ttsCode: 'sw-KE', flag: 'SW',
    prompt: 'Karibu GAIA.', greeting: 'Habari, mimi ni GAIA.',
    voiceHints: ['sw-KE','sw','kiswahili','swahili'] },
];

let cachedVoices: Speech.Voice[] | null = null;

export async function getVoicesOnce(): Promise<Speech.Voice[]> {
  if (cachedVoices) return cachedVoices;
  try { cachedVoices = await Speech.getAvailableVoicesAsync(); }
  catch { cachedVoices = []; }
  return cachedVoices || [];
}

export async function pickVoiceFor(ttsCode: string): Promise<string | null> {
  const lang = LANGUAGES.find((l) => l.ttsCode === ttsCode) || LANGUAGES[0];
  const voices = await getVoicesOnce();
  let v = voices.find((x) => x.language === lang.ttsCode);
  if (v) return v.identifier;
  const base = lang.ttsCode.split('-')[0];
  v = voices.find((x) => (x.language || '').startsWith(base));
  if (v) return v.identifier;
  for (const hint of lang.voiceHints) {
    const found = voices.find((x) => (x.identifier || '').toLowerCase().includes(hint.toLowerCase()));
    if (found) return found.identifier;
  }
  return null;
}

// ============================================================
// Server TTS via Edge Neural voices on the backend
// ============================================================
async function tryServerTTS(text: string, langCode: string): Promise<boolean> {
  try {
    const s = await supabase.auth.getSession();
    const token = s.data.session?.access_token;
    const res = await fetch(API_BASE + '/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: JSON.stringify({ text: text.slice(0, 1500), language: langCode }),
    });
    if (!res.ok) return false;
    const buf = await res.arrayBuffer();
    if (!buf || buf.byteLength < 500) return false;
    const bytes = new Uint8Array(buf);
    let b64 = '';
    try {
      b64 = fromByteArray(bytes);
    } catch {
      return false;
    }
    if (!b64) return false;
    const path = FileSystem.cacheDirectory + 'tts_' + Date.now() + '.mp3';
    await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 });
    const { createAudioPlayer } = await import('expo-audio');
    const player = createAudioPlayer({ uri: path });
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        try { player.remove(); } catch {}
        try { FileSystem.deleteAsync(path, { idempotent: true }); } catch {}
        resolve();
      };
      try {
        const sub = (player as any).addListener('playbackStatusUpdate', (st: any) => {
          if (st && st.didJustFinish) { sub.remove(); finish(); }
        });
        player.play();
        setTimeout(finish, 90000);
      } catch { finish(); }
    });
    return true;
  } catch (e) {
    return false;
  }
}

export async function speakSmart(text: string, languageCode: string, onDone?: () => void): Promise<void> {
  const lang = LANGUAGES.find((l) => l.code === languageCode)
    || LANGUAGES.find((l) => l.ttsCode === languageCode)
    || LANGUAGES[0];

  // 1. Try server-side neural TTS (native-sounding)
  const ok = await tryServerTTS(text, lang.code);
  if (ok) { onDone?.(); return; }

  // 2. Fallback to device TTS
  const voiceId = await pickVoiceFor(lang.ttsCode);
  return new Promise((resolve) => {
    const finish = () => { onDone?.(); resolve(); };
    try {
      Speech.stop();
      Speech.speak(text, {
        language: lang.ttsCode,
        voice: voiceId || undefined,
        pitch: 1.0,
        rate: 0.92,
        onDone: finish,
        onStopped: finish,
        onError: finish,
      });
    } catch { finish(); }
  });
}

export function speak(text: string, langCode: string, onDone?: () => void): Promise<void> {
  return speakSmart(text, langCode, onDone);
}

export function stopSpeaking() { Speech.stop(); }
export async function isSpeaking(): Promise<boolean> { return Speech.isSpeakingAsync(); }

export function detectLanguage(text: string): string {
  const t = ' ' + text.toLowerCase() + ' ';
  if (/\b(barka|sannu|yaya|ina|nawa|zan|yau|gobe|kadai|dama|nagode|na gode|madalla)\b/.test(t)) return 'ha';
  if (/\b(bawo|ore|jowo|pele|abi|eki|ese|eshey|jare|kilode|mo fe|ile|oun|oti)\b/.test(t)) return 'yo';
  if (/\b(kedu|nnoo|ndewo|gini|bia|nwanne|maka|daalu|ndi|anyi|nke|nwoke|nwaanyi)\b/.test(t)) return 'ig';
  if (/\b(bonjour|merci|oui|salut|comment|revoir|vous|nous|besoin|aider|champ|culture)\b/.test(t)) return 'fr';
  if (/\b(habari|asante|karibu|kwaheri|jambo|ndiyo|shamba|mazao|mbolea)\b/.test(t)) return 'sw';
  if (/\b(wetin|dey|sabi|chop|waka|shey|abeg|wahala)\b/.test(t)) return 'pcm';
  return 'en';
}

export async function transcribeAudio(uri: string, language: string): Promise<string> {
  const s = await supabase.auth.getSession();
  const token = s.data.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  const r = await FileSystem.uploadAsync(API_BASE + '/stt', uri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: 'audio',
    mimeType: 'audio/m4a',
    headers: { Authorization: 'Bearer ' + token },
    parameters: { language: language.slice(0, 2) },
  });
  if (r.status !== 200 && r.status !== 201) throw new Error('STT failed: ' + r.status);
  return (JSON.parse(r.body || '{}').text || '').trim();
}

export interface ChatTurn { role: 'user' | 'assistant'; content: string; }

export async function askGaia(message: string, language: string, history: ChatTurn[] = []): Promise<string> {
  const s = await supabase.auth.getSession();
  const token = s.data.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(API_BASE + '/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ message, language, history: history.slice(-8) }),
  });
  if (!res.ok) throw new Error('Chat failed: ' + res.status);
  const d = await res.json();
  return (d.reply || '').trim();
}

export async function prepareAudioMode() {
  const p = await AudioModule.requestRecordingPermissionsAsync();
  if (!p.granted) throw new Error('Microphone permission denied');
  await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
}

export async function restorePlaybackMode() {
  await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
}

export const RECORDING_PRESET = RecordingPresets.HIGH_QUALITY;

export const STOP_WORDS = [
  'stop','goodbye','bye','exit','end','quit',
  'sai anjima','nagode','na gode','ban gajiya',
  'o da bo','ese','o se','mo ti de',
  'ka o di','daalu','nnoo',
  'au revoir','merci','arrete',
  'kwaheri','asante',
];

export function isStopCommand(text: string): boolean {
  const l = text.toLowerCase().trim();
  return STOP_WORDS.some((w) => l === w || l.startsWith(w + ' ') || l.endsWith(' ' + w));
}
