import * as FileSystem from 'expo-file-system/legacy';
import { saveScan } from '../utils/saveScan';

const API_BASE = 'https://gaia-api-xuly.onrender.com';

export interface Prediction {
  label: string;
  confidence: number;
}

export interface DiagnosisResult {
  predictions: Prediction[];
  top: Prediction;
  model: string;
  processingMs: number;
  scansRemaining?: number;
  gradcam_image?: string | null;
  top_class_index?: number;
  recommendations?: string | null;
}

export class DiagnosisError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface DiagnoseContext {
  scanType?: 'crop' | 'pest' | 'soil' | 'livestock' | 'video' | 'image-qa';
  crop?: string;
  animal?: string;
  notes?: string;
  saveToHistory?: boolean;
}

export async function diagnose(
  imageUri: string,
  modelKey: string,
  token: string,
  context: DiagnoseContext = {},
): Promise<DiagnosisResult> {
  if (!token) throw new DiagnosisError('Not authenticated', 401);
  try {
    const res = await FileSystem.uploadAsync(API_BASE + '/diagnose', imageUri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'image',
      mimeType: 'image/jpeg',
      headers: { Authorization: 'Bearer ' + token },
      parameters: { model: modelKey },
    });
    if (res.status < 200 || res.status >= 300) {
      let msg = 'Diagnosis failed';
      try { msg = JSON.parse(res.body).error || msg; } catch (e) {}
      throw new DiagnosisError(msg, res.status);
    }
    return JSON.parse(res.body) as DiagnosisResult;
  } catch (e: any) {
    if (e instanceof DiagnosisError) throw e;
    throw new DiagnosisError(e?.message || 'Network error', 0);
  }
}

export async function warmupModel(modelKey: string, _token: string) {
  const r = await fetch(API_BASE + '/models');
  const d = await r.json();
  return (d.models || []).includes(modelKey);
}
