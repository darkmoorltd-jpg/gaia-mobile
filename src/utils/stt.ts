import { findLanguage } from './languages';

const API_BASE = 'https://gaia-api-xuly.onrender.com';

export interface TranscribeResult {
  text: string;
  error?: string;
}

export async function transcribeAudio(
  audioUri: string,
  languageCode: string,
  token: string,
): Promise<TranscribeResult> {
  try {
    const lang = findLanguage(languageCode);
    const fileResponse = await fetch(audioUri);
    const blob = await fileResponse.blob();

    const form = new FormData();
    form.append('audio', blob, 'voice.m4a');
    form.append('language', lang.whisperCode);

    const res = await fetch(API_BASE + '/transcribe', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
      body: form,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { text: '', error: 'Server ' + res.status + ': ' + errText.slice(0, 120) };
    }

    const data = await res.json();
    return { text: (data.text || '').trim() };
  } catch (e: any) {
    return { text: '', error: e?.message || 'Transcription failed' };
  }
}
