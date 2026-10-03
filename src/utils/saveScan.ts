import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../api/supabase';

const SUPABASE_URL = 'https://pxvtvuwlpzwlkdoxjrep.supabase.co';

export interface ScanPayload {
  scanType: 'crop' | 'pest' | 'soil' | 'livestock' | 'video' | 'image-qa';
  crop?: string;
  animal?: string;
  imageUri: string;
  topLabel: string;
  confidence: number;
  allPredictions?: any[];
  modelKey?: string;
  processingMs?: number;
  notes?: string;
}

export async function saveScan(p: ScanPayload): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    const accessToken = session?.access_token;
    if (!userId || !accessToken) return null;

    const ext = (p.imageUri.split('.').pop() || 'jpg').toLowerCase().split('?')[0];
    const path = userId + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) + '.' + ext;

    const up = await FileSystem.uploadAsync(
      SUPABASE_URL + '/storage/v1/object/scan-images/' + path,
      p.imageUri,
      {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'image/jpeg',
          'x-upsert': 'false',
        },
      },
    );
    if (up.status < 200 || up.status >= 300) {
      console.warn('scan upload failed', up.status, up.body?.slice(0, 120));
      return null;
    }

    const imageUrl = SUPABASE_URL + '/storage/v1/object/public/scan-images/' + path;

    const { error: insErr } = await supabase.from('scan_history').insert({
      user_id: userId,
      scan_type: p.scanType,
      crop: p.crop || null,
      animal: p.animal || null,
      image_url: imageUrl,
      top_label: p.topLabel,
      confidence: p.confidence,
      all_predictions: p.allPredictions || [],
      model_key: p.modelKey || null,
      processing_ms: p.processingMs || null,
      notes: p.notes || null,
    });
    if (insErr) { console.warn('scan insert failed', insErr.message); return null; }

    return imageUrl;
  } catch (e) {
    console.warn('saveScan error', e);
    return null;
  }
}
