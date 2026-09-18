import axios from 'axios';
import * as FileSystem from 'expo-file-system';

const API_BASE = "https://gaia-api-xuly.onrender.com";

export interface Prediction {
  label: string;
  confidence: number;
}

export interface DiagnosisResult {
  predictions: Prediction[];
  top: Prediction;
  model: string;
  processingMs: number;
  scansRemaining: number;
  historyId?: number;
  gradcamBase64?: string;
}

export class DiagnosisError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function diagnose(
  imageUri: string,
  modelKey: string,
  token: string,
): Promise<DiagnosisResult> {
  if (!token) throw new DiagnosisError('Not authenticated', 401);

  const form = new FormData();
  // @ts-ignore — React Native FormData file object
  form.append('image', {
    uri: imageUri,
    name: 'leaf.jpg',
    type: 'image/jpeg',
  });
  form.append('model', modelKey);

  try {
    const { data } = await axios.post<DiagnosisResult>(
      API_BASE + '/diagnose',
      form,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: 'Bearer ' + token,
        },
        timeout: 120000, // 2 minutes — first call downloads the model
      },
    );
    return data;
  } catch (e: any) {
    if (e.response) {
      const status = e.response.status;
      const msg =
        e.response.data?.error ||
        e.response.data?.detail ||
        'Diagnosis failed';
      throw new DiagnosisError(msg, status);
    }
    if (e.code === 'ECONNABORTED') {
      throw new DiagnosisError('Server timeout — try again', 408);
    }
    throw new DiagnosisError(e.message || 'Network error', 0);
  }
}

export async function warmupModel(modelKey: string, token: string) {
  // Optional pre-warm: hit /models to confirm the model key exists
  const { data } = await axios.get(API_BASE + '/models');
  return data.models.includes(modelKey);
}
