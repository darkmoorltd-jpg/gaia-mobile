import {
  AudioModule,
  setAudioModeAsync,
  AudioRecorder,
  RecordingPresets,
} from 'expo-audio';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../api/supabase';

const API_BASE = 'https://gaia-api-xuly.onrender.com';

// ============================================
// SPEECH-TO-TEXT
// ============================================
export async function transcribeAudio(uri: string, language: string): Promise<string> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const result = await FileSystem.uploadAsync(API_BASE + '/stt', uri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: 'audio',
    mimeType: 'audio/m4a',
    headers: { Authorization: 'Bearer ' + token },
    parameters: { language: language.slice(0, 2) },
  });

  if (result.status !== 200 && result.status !== 201) {
    throw new Error('STT failed: ' + result.status);
  }

  const data = JSON.parse(result.body || '{}');
  return (data.text || '').trim();
}

// ============================================
// CHAT
// ============================================
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
    body: JSON.stringify({
      message,
      language,
      history: history.slice(-8),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error('Chat failed: ' + res.status + ' ' + errText.slice(0, 100));
  }

  const data = await res.json();
  return (data.reply || '').trim();
}

// ============================================
// TEXT-TO-SPEECH
// ============================================
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

export function stopSpeaking() {
  Speech.stop();
}

export async function isSpeaking(): Promise<boolean> {
  return Speech.isSpeakingAsync();
}

// ============================================
// RECORDING WITH VAD
// ============================================
let _recorder: AudioRecorder | null = null;

export async function prepareAudioMode() {
  const perm = await AudioModule.requestRecordingPermissionsAsync();
  if (!perm.granted) throw new Error('Microphone permission denied');

  await setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true,
    shouldPlayInBackground: false,
    shouldRouteThroughEarpiece: false,
  });
}

export async function startRecording(): Promise<AudioRecorder> {
  await prepareAudioMode();
  await new Promise((r) => setTimeout(r, 150));

  const recorder = new AudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });

  await recorder.prepareToRecordAsync();
  recorder.record();

  _recorder = recorder;
  return recorder;
}

export async function stopRecording(recorder: AudioRecorder): Promise<string | null> {
  try {
    await recorder.stop();
  } catch (e) {
    console.log('stop error', e);
  }
  try {
    await setAudioModeAsync({ allowsRecording: false });
  } catch {}
  _recorder = null;
  return recorder.uri || null;
}

/**
 * Records until silence is detected, then returns the recording URI.
 */
export async function recordUntilSilence(opts: {
  silenceThresholdDb?: number;
  silenceDurationMs?: number;
  maxDurationMs?: number;
  onLevel?: (db: number) => void;
  onStateChange?: (state: 'listening' | 'silence' | 'done') => void;
}): Promise<string | null> {
  const silenceThresholdDb = opts.silenceThresholdDb ?? -35;
  const silenceDurationMs = opts.silenceDurationMs ?? 1200;
  const maxDurationMs = opts.maxDurationMs ?? 20000;

  const recorder = await startRecording();
  const startedAt = Date.now();
  let silentSince: number | null = null;
  let hasSpoken = false;

  opts.onStateChange?.('listening');

  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      try {
        const status = recorder.getStatus();

        const db = status.metering ?? -160;
        opts.onLevel?.(db);

        const elapsed = Date.now() - startedAt;
        if (elapsed > maxDurationMs) {
          clearInterval(interval);
          opts.onStateChange?.('done');
          return resolve(await stopRecording(recorder));
        }

        const isSilent = db < silenceThresholdDb;

        if (!isSilent) {
          hasSpoken = true;
          silentSince = null;
          return;
        }

        if (silentSince === null) {
          silentSince = Date.now();
          return;
        }

        const silentFor = Date.now() - silentSince;

        if (hasSpoken && silentFor >= silenceDurationMs) {
          opts.onStateChange?.('silence');
          clearInterval(interval);
          return resolve(await stopRecording(recorder));
        }

        if (!hasSpoken && elapsed > 7000) {
          clearInterval(interval);
          return resolve(await stopRecording(recorder));
        }
      } catch (e) {
        // keep polling
      }
    }, 100);
  });
}

// ============================================
// LANGUAGES
// ============================================
export interface LangOption {
  code: string;
  label: string;
  ttsCode: string;
  flag: string;
  prompt: string;
  greeting: string;
}

export const LANGUAGES: LangOption[] = [
  {
    code: 'en', label: 'English', ttsCode: 'en-NG', flag: '🇬🇧',
    prompt: 'Welcome to GAIA. Which language would you like to be served in?',
    greeting: 'Hello, I am GAIA. What can I do for you today?',
  },
  {
    code: 'ha', label: 'Hausa', ttsCode: 'ha-NG', flag: '🇳🇬',
    prompt: 'Barka da zuwa GAIA. Wane harshe kuke so a yi muku hidima da shi?',
    greeting: 'Sannu, ni ce GAIA. Me zan iya yi muku yau?',
  },
  {
    code: 'yo', label: 'Yoruba', ttsCode: 'yo-NG', flag: '🇳🇬',
    prompt: 'Ẹ ku abọ si GAIA. Èdè wo ni ẹ fẹ́ kí a lò fún yín?',
    greeting: 'Ẹ n lẹ, èmi ni GAIA. Kí ni mo lè ṣe fún yín lónìí?',
  },
  {
    code: 'ig', label: 'Igbo', ttsCode: 'ig-NG', flag: '🇳🇬',
    prompt: 'Nnọọ na GAIA. Kedu asụsụ ị chọrọ ka e jiri nye gị ọrụ?',
    greeting: 'Ndeewo, abụ m GAIA. Gịnị ka m ga-emere gị taa?',
  },
  {
    code: 'fr', label: 'Français', ttsCode: 'fr-FR', flag: '🇫🇷',
    prompt: 'Bienvenue sur GAIA. Dans quelle langue souhaitez-vous être servi ?',
    greeting: 'Bonjour, je suis GAIA. Que puis-je faire pour vous aujourd\'hui ?',
  },
  {
    code: 'sw', label: 'Kiswahili', ttsCode: 'sw-KE', flag: '🇰🇪',
    prompt: 'Karibu GAIA. Ungependa kuhudumiwa kwa lugha gani?',
    greeting: 'Habari, mimi ni GAIA. Nikufanyie nini leo?',
  },
];

export const STOP_WORDS = [
  'stop', 'goodbye', 'bye', 'exit', 'end', 'quit',
  'tsaya', 'kada', 'sai an jima',
  'dúró', 'o daabọ',
  'kwụsị', 'ka ọ dị',
  'arrête', 'au revoir',
  'acha', 'kwaheri',
];

export function isStopCommand(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return STOP_WORDS.some(
    (w) => lower === w || lower.startsWith(w + ' ') || lower.endsWith(' ' + w),
  );
}
