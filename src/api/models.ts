
import axios from 'axios';
import * as FileSystem from 'expo-file-system';

const API_BASE = "https://gaia-api-xuly.onrender.com"; // replace after deploying backend

export interface Prediction {
  label: string;
  confidence: number;
}

export interface DiagnosisResult {
  predictions: Prediction[];
  top: Prediction;
  model: string;
  processingMs: number;
}

export async function diagnose(
  imageUri: string,
  modelKey: string,
  token: string,
): Promise<DiagnosisResult> {
  const form = new FormData();
  // @ts-ignore
  form.append('image', { uri: imageUri, name: 'leaf.jpg', type: 'image/jpeg' });
  form.append('model', modelKey);

  const { data } = await axios.post<DiagnosisResult>(
    `${API_BASE}/diagnose`,
    form,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: `Bearer ${token}`,
      },
      timeout: 60000,
    },
  );
  return data;
}
