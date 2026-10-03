import { AudioModule, setAudioModeAsync, RecordingPresets } from 'expo-audio';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../api/supabase';

const API_BASE = 'https://gaia-api-xuly.onrender.com';

export async function transcribeAudio(uri: string, language: string): Promise<string> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  const res = await FileSystem.uploadAsync(API_BASE + '/stt', uri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: 'audio',
    mimeType: 'audio/m4a',
    headers: { Authorization: 'Bearer ' + token },
    parameters: { language: language.slice(0, 2) },
  });
  if (res.status !== 200 && res.status !== 201) {
    throw new Error('STT failed: ' + res.status);
  }
  return (JSON.parse(res.body || '{}').text || '').trim();
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export async function askGaia(
  message: string,
  language: string,
  history: ChatTurn[] = [],
): Promise<string> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(API_BASE + '/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    },
    body: JSON.stringify({ message, language, history: history.slice(-8) }),
  });
  if (!res.ok) throw new Error('Chat failed: ' + res.status);
  const data = await res.json();
  return (data.reply || '').trim();
}

export function speak(text: string, langCode: string, onDone?: () => void): Promise<void> {
  return new Promise((resolve) => {
    Speech.stop();
    Speech.speak(text, {
      language: langCode,
      pitch: 1.0,
      rate: 0.95,
      onDone: () => { onDone?.(); resolve(); },
      onStopped: () => { onDone?.(); resolve(); },
      onError: () => { onDone?.(); resolve(); },
    });
  });
}

export function stopSpeaking() { Speech.stop(); }
export async function isSpeaking(): Promise<boolean> { return Speech.isSpeakingAsync(); }

export async function prepareAudioMode() {
  const perm = await AudioModule.requestRecordingPermissionsAsync();
  if (!perm.granted) throw new Error('Microphone permission denied');
  await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
}

export async function restorePlaybackMode() {
  await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
}

export const RECORDING_PRESET = RecordingPresets.HIGH_QUALITY;

export interface LangOption {
  code: string;
  label: string;
  ttsCode: string;
  flag: string;
  prompt: string;
  greeting: string;
}

export const LANGUAGES: LangOption[] = [
  { code: 'en', label: 'English',   ttsCode: 'en-NG', flag: 'EN', prompt: 'Welcome to GAIA.',     greeting: 'Hello, I am GAIA.' },
  { code: 'ha', label: 'Hausa',     ttsCode: 'ha-NG', flag: 'HA', prompt: 'Barka da zuwa GAIA.', greeting: 'Sannu, ni ce GAIA.' },
  { code: 'yo', label: 'Yoruba',    ttsCode: 'yo-NG', flag: 'YO', prompt: 'Eku abo si GAIA.',    greeting: 'E n le, emi ni GAIA.' },
  { code: 'ig', label: 'Igbo',      ttsCode: 'ig-NG', flag: 'IG', prompt: 'Nnoo na GAIA.',       greeting: 'Ndeewo, abu m GAIA.' },
  { code: 'fr', label: 'Francais',  ttsCode: 'fr-FR', flag: 'FR', prompt: 'Bienvenue sur GAIA.', greeting: 'Bonjour, je suis GAIA.' },
  { code: 'sw', label: 'Kiswahili', ttsCode: 'sw-KE', flag: 'SW', prompt: 'Karibu GAIA.',        greeting: 'Habari, mimi ni GAIA.' },
];

export const STOP_WORDS = ['stop', 'goodbye', 'bye', 'exit', 'end', 'quit'];

export function isStopCommand(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return STOP_WORDS.some((w) => lower === w || lower.startsWith(w + ' ') || lower.endsWith(' ' + w));
}
