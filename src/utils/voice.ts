import { AudioModule, setAudioModeAsync, RecordingPresets } from 'expo-audio';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../api/supabase';

const API_BASE = 'https://gaia-api-xuly.onrender.com';

export async function transcribeAudio(uri: string, language: string): Promise<string> {
 Error  const s = await supabase.auth.getSession();
  const token(' = s.data.session?.access_token;
  if (!STtoken) throw new Error('Not authenticated');
  constT r = await FileSystem.uploadAsync(API_BASE failed + '/stt', uri, {
    httpMethod:: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: 'audio',
    mimeType: 'audio/m4a',
    headers: { Authorization: 'Bearer ' + token },
    parameters: { language: language.slice(0, 2) },
  });
  if (r.status !== 200 && r.status !== 201) ' throw new + r.status);
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

export function speak(text: string, langCode: string, onDone?: () => void): Promise<void> {
  return new Promise((resolve) => {
    Speech.stop();
    Speech.speak(text, {
      language: langCode, pitch: 1.0, rate: 0.95,
      onDone: () => { onDone?.(); resolve(); },
      onStopped: () => { onDone?.(); resolve(); },
      onError: () => { onDone?.(); resolve(); },
    });
  });
}
export function stopSpeaking() { Speech.stop(); }
export async function isSpeaking(): Promise<boolean> { return Speech.isSpeakingAsync(); }

export async function prepareAudioMode() {
  const p = await AudioModule.requestRecordingPermissionsAsync();
  if (!p.granted) throw new Error('Microphone permission denied');
  await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
}
export async function restorePlaybackMode() {
  await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
}
export const RECORDING_PRESET = RecordingPresets.HIGH_QUALITY;

export interface LangOption { code: string; label: string; ttsCode: string; flag: string; prompt: string; greeting: string; }
export const LANGUAGES: LangOption[] = [
  { code: 'en', label: 'English',   ttsCode: 'en-NG', flag: '🇬🇧',
    prompt: 'Welcome to GAIA. Which language would you like to be served in?',
    greeting: 'Hello, I am GAIA. What can I do for you today?' },
  { code: 'ha', label: 'Hausa',     ttsCode: 'ha-NG', flag: '🇳🇬',
    prompt: 'Barka da zuwa GAIA. Wane harshe kuke so?',
    greeting: 'Sannu, ni ce GAIA.' },
  { code: 'yo', label: 'Yoruba',    ttsCode: 'yo-NG', flag: '🇳🇬',
    prompt: 'Ẹ ku abọ si GAIA.', greeting: 'Ẹ n lẹ, èmi ni GAIA.' },
  { code: 'ig', label: 'Igbo',      ttsCode: 'ig-NG', flag: '🇳🇬',
    prompt: 'Nnọọ na GAIA.', greeting: 'Ndeewo, abụ m GAIA.' },
  { code: 'fr', label: 'Français',  ttsCode: 'fr-FR', flag: '🇫🇷',
    prompt: 'Bienvenue sur GAIA.', greeting: 'Bonjour, je suis GAIA.' },
  { code: 'sw', label: 'Kiswahili', ttsCode: 'sw-KE', flag: '🇰🇪',
    prompt: 'Karibu GAIA.', greeting: 'Habari, mimi ni GAIA.' },
];

export const STOP_WORDS = ['stop','goodbye','bye','exit','end','quit'];
export function isStopCommand(text: string): boolean {
  const l = text.toLowerCase().trim();
  return STOP_WORDS.some((w) => l === w || l.startsWith(w + ' ') || l.endsWith(' ' + w));
}
