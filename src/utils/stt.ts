import * as FileSystem from 'expo-file-system/legacy';
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
    const res = await FileSystem.uploadAsync(API_BASE + '/transcribe', audioUri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'audio',
      mimeType: 'audio/m4a',
      headers: { Authorization: 'Bearer ' + token },
      parameters: { language: lang.whisperCode },
    });
    if (res.status < 200 || res.status >= 300) {
      return { text: '', error: 'Server ' + res.status };
    }
    const data = JSON.parse(res.body || '{}');
    return { text: (data.text || '').trim() };
  } catch (e: any) {
    return { text: '', error: e?.message || 'Transcription failed' };
  }
}
