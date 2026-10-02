import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../api/supabase';

const API_BASE = 'https://gaia-api.onrender.com'; // ← your Render URL

// ============================================
// TEXT-TO-SPEECH
// ============================================
export function speak(text: string, langCode: string, onDone?: () => void) {
  Speech.stop();
  Speech.speak(text, {
    language: langCode,
    pitch: 1.0,
    rate: 0.95,
    onDone: () => onDone?.(),
    onError: (e) => { console.log('TTS error', e); onDone?.(); },
  });
}

export function stopSpeaking() {
  Speech.stop();
}

export function isSpeaking(): Promise<boolean> {
  return Speech.isSpeakingAsync();
}

// ============================================
// SPEECH-TO-TEXT (record → backend Whisper)
// ============================================
export async function startRecording(): Promise<Audio.Recording> {
  const perm = await Audio.requestPermissionsAsync();
  if (!perm.granted) throw new Error('Microphone permission denied');

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
  });

  const { recording } = await Audio.Recording.createAsync({
    isMeteringEnabled: true,
    android: {
      extension: '.m4a',
      outputFormat: Audio.AndroidOutputFormat.MPEG_4,
      audioEncoder: Audio.AndroidAudioEncoder.AAC,
      sampleRate: 16000,
      numberOfChannels: 1,
      bitRate: 64000,
    },
    ios: {
      extension: '.m4a',
      outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
      audioQuality: Audio.IOSAudioQuality.HIGH,
      sampleRate: 16000,
      numberOfChannels: 1,
      bitRate: 64000,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
    web: { mimeType: 'audio/webm', bitsPerSecond: 64000 },
  });

  return recording;
}

export async function stopRecording(recording: Audio.Recording): Promise<string | null> {
  try {
    await recording.stopAndUnloadAsync();
  } catch {}
  return recording.getURI();
}

export async function transcribeAudio(uri: string, language: string): Promise<string> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const form = new FormData();
  // @ts-ignore
  form.append('audio', { uri, name: 'audio.m4a', type: 'audio/m4a' });
  form.append('language', language.slice(0, 2)); // 'en', 'ha', 'yo', etc.

  const res = await fetch(API_BASE + '/stt', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
    body: form as any,
  });
  if (!res.ok) throw new Error('STT failed: ' + res.status);
  const data = await res.json();
  return data.text || '';
}

// ============================================
// ASK GAIA (DeepSeek via backend)
// ============================================
export interface ChatTurn { role: 'user' | 'assistant'; content: string; }

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
      history: history.slice(-6),
    }),
  });
  if (!res.ok) throw new Error('Chat failed: ' + res.status);
  const data = await res.json();
  return data.reply || '';
}
