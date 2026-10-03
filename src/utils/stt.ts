import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../api/supabase';

const API_BASE = 'https://gaia-api-xuly.onrender.com';

export interface TranscribeResult {
  text: string;
  error?: string;
}

export async function transcribeAudio(
  audioUri: string,
  languageCode: string,
  _token?: string,
): Promise<TranscribeResult> {
  try {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token || _token || '';
    if (!token) return { text: '', error: 'Not authenticated' };

    const res = await FileSystem.uploadAsync(API_BASE + '/stt', audioUri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'audio',
      mimeType: 'audio/m4a',
      headers: { Authorization: 'Bearer ' + token },
      parameters: { language: languageCode.slice(0, 2) || 'en' },
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
