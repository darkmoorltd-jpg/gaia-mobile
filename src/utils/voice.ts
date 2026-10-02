import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../api/supabase';

const API_BASE = 'https://gaia-api.onrender.com';

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
    onError: (e) => {
      console.log('TTS error', e);
      onDone?.();
    },
  });
}

export function stopSpeaking() {
  Speech.stop();
}

export function isSpeaking(): Promise<boolean> {
  return Speech.isSpeakingAsync();
}

// ============================================
// SPEECH-TO-TEXT
// ============================================
let _recording: Audio.Recording | null = null;

export async function startRecording(): Promise<Audio.Recording> {
  // 1. Permission
  const perm = await Audio.requestPermissionsAsync();
  if (!perm.granted) throw new Error('Microphone permission denied');

  // 2. Audio mode MUST be set BEFORE createAsync on iOS
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });

  // 3. Small delay so iOS fully switches mode
  await new Promise((r) => setTimeout(r, 150));

  const { recording } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY,
  );

  _recording = recording;
  return recording;
}

export async function stopRecording(recording: Audio.Recording): Promise<string | null> {
  try {
    await recording.stopAndUnloadAsync();
  } catch (e) {
    console.log('stop recording error', e);
  }
  // Restore playback mode
  try {
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
  } catch {}
  _recording = null;
  return recording.getURI();
}

export async function transcribeAudio(uri: string, language: string): Promise<string> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  // FileSystem.uploadAsync handles multipart correctly on iOS + Android
  const uploadUrl = API_BASE + '/stt';

  const result = await FileSystem.uploadAsync(uploadUrl, uri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: 'audio',
    mimeType: 'audio/m4a',
    headers: {
      Authorization: 'Bearer ' + token,
    },
    parameters: {
      language: language.slice(0, 2),
    },
  });

  if (result.status !== 200 && result.status !== 201) {
    throw new Error('STT failed: ' + result.status + ' ' + result.body?.slice(0, 100));
  }

  const data = JSON.parse(result.body || '{}');
  return data.text || '';
}

// ============================================
// ASK GAIA (chat)
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
      history: history.slice(-6),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error('Chat failed: ' + res.status + ' ' + errText.slice(0, 100));
  }

  const data = await res.json();
  return data.reply || '';
}
