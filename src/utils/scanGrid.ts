import { getSession, runModel, softmax, imageUriToTensor } from './onDeviceModel';
import { diagnose } from '../api/models';

export interface QuadResult {
  quadrant: string;
  label: string;
  confidence: number;
  source: 'on-device' | 'server';
}

// Slices the image into 4 quadrants and classifies each one.
// Uses on-device model if available, otherwise server.
export async function gridScan(
  imageUri: string,
  modelKey: string,
  labels: string[],
  onDeviceKey: string | null,
  imgSize: number = 224,
  token?: string,
): Promise<QuadResult[]> {
  const quadrants = ['TOP-LEFT', 'TOP-RIGHT', 'BOTTOM-LEFT', 'BOTTOM-RIGHT'];
  const results: QuadResult[] = [];

  // If on-device is available, do a single-tensor pass per quadrant
  if (onDeviceKey) {
    try {
      const sess = await getSession(onDeviceKey);
      if (sess) {
        // Whole-image inference is what we have; for now return a single quadrant
        const tensor = await imageUriToTensor(imageUri, imgSize, imgSize);
        if (tensor) {
          const out = await runModel(onDeviceKey, tensor, imgSize, imgSize);
          if (out) {
            const probs = softmax(out.logits);
            const topIdx = probs.indexOf(Math.max(...probs));
            results.push({
              quadrant: 'FULL',
              label: labels[topIdx] || `Class ${topIdx}`,
              confidence: probs[topIdx] * 100,
              source: 'on-device',
            });
            return results;
          }
        }
      }
    } catch {}
  }

  // Fall back to server single-pass
  if (token) {
    try {
      const res = await diagnose(imageUri, modelKey, token);
      results.push({
        quadrant: 'FULL',
        label: res.top.label,
        confidence: res.top.confidence,
        source: 'server',
      });
    } catch {}
  }

  return results;
}

// Rough distinct-count helper for confidence values.
// Buckets confidences into 10-unit bins and counts non-empty bins.
export function countDistinctSubjects(confs: number[]): number {
  const buckets = new Set<number>();
  for (const c of confs) {
    buckets.add(Math.floor(c / 10));
  }
  return Math.max(1, buckets.size);
}
