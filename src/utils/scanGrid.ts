import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { getSession, runModel, softmax, imageUriToTensor } from './onDeviceModel';
import { supabase } from '../api/supabase';

const API_BASE = 'https://gaia-api-xuly.onrender.com';

export interface QuadResult {
  quadrant: 'TL' | 'TR' | 'BL' | 'BR' | 'CENTER';
  label: string;
  confidence: number;
}

/**
 * Crop a region out of an image (fractions 0-1) and return a new temp file uri.
 */
export async function cropRegion(
  uri: string,
  x: number,
  y: number,
  w: number,
  h: number,
): Promise<string | null> {
  try {
    const info = await ImageManipulator.manipulateAsync(uri, [], {});
    const imgW = info.width || 0;
    const imgH = info.height || 0;
    if (!imgW || !imgH) return null;
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [
        {
          crop: {
            originX: Math.max(0, Math.round(imgW * x)),
            originY: Math.max(0, Math.round(imgH * y)),
            width: Math.max(1, Math.round(imgW * w)),
            height: Math.max(1, Math.round(imgH * h)),
          },
        },
      ],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
    );
    return result.uri;
  } catch {
    return null;
  }
}

/**
 * Auto-zoom: crop the central 60% of the image, which is where the leaf frame is.
 */
export async function autoZoom(uri: string): Promise<string | null> {
  return cropRegion(uri, 0.2, 0.2, 0.6, 0.6);
}

/**
 * Grid scan: split frame into 4 quadrants, run prediction on each.
 * Returns array of 5 results (4 quadrants + center auto-zoom).
 */
export async function gridScan(
  uri: string,
  cropKey: string,
  labels: string[],
  onDeviceKey: string | null,
  onDeviceSize = 224,
  token?: string,
): Promise<QuadResult[]> {
  const regions: { quadrant: QuadResult['quadrant']; x: number; y: number; w: number; h: number }[] = [
    { quadrant: 'TL', x: 0, y: 0, w: 0.5, h: 0.5 },
    { quadrant: 'TR', x: 0.5, y: 0, w: 0.5, h: 0.5 },
    { quadrant: 'BL', x: 0, y: 0.5, w: 0.5, h: 0.5 },
    { quadrant: 'BR', x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    { quadrant: 'CENTER', x: 0.2, y: 0.2, w: 0.6, h: 0.6 },
  ];

  const results: QuadResult[] = [];
  for (const r of regions) {
    const cropped = await cropRegion(uri, r.x, r.y, r.w, r.h);
    if (!cropped) continue;

    let label = 'Unknown';
    let confidence = 0;

    // On-device first
    if (onDeviceKey) {
      try {
        const sess = await getSession(onDeviceKey);
        if (sess) {
          const tensor = await imageUriToTensor(cropped, onDeviceSize, onDeviceSize);
          if (tensor) {
            const out = await runModel(onDeviceKey, tensor, onDeviceSize, onDeviceSize);
            if (out) {
              const probs = softmax(out.logits);
              const topIdx = probs.indexOf(Math.max(...probs));
              label = labels[topIdx] || `Class ${topIdx}`;
              confidence = probs[topIdx] * 100;
            }
          }
        }
      } catch {}
    }

    // Fallback to server
    if (label === 'Unknown' && token) {
      try {
        const form = new FormData();
        // RN-compatible upload
        const up = await FileSystem.uploadAsync(`${API_BASE}/diagnose`, cropped, {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: 'image',
          mimeType: 'image/jpeg',
          headers: { Authorization: `Bearer ${token}` },
          parameters: { model: cropKey },
        });
        if (up.status >= 200 && up.status < 300) {
          const data = JSON.parse(up.body || '{}');
          if (data.top) {
            label = data.top.label;
            confidence = data.top.confidence;
          }
        }
      } catch {}
    }

    results.push({ quadrant: r.quadrant, label, confidence });
    // cleanup
    try { await FileSystem.deleteAsync(cropped, { idempotent: true }); } catch {}
  }
  return results;
}

/**
 * Estimate number of distinct plants/leaves in a session by counting
 * confidence "peaks" that differ by >15 points over the session.
 * Rough but useful — counts local maxima in the confidence series.
 */
export function countDistinctSubjects(confSeries: number[]): number {
  if (confSeries.length < 3) return 1;
  let count = 1;
  for (let i = 1; i < confSeries.length - 1; i++) {
    const prev = confSeries[i - 1];
    const cur = confSeries[i];
    const next = confSeries[i + 1];
    if (cur > prev + 10 && cur > next + 10) count += 1;
  }
  return count;
}
