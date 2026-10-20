import * as FileSystem from 'expo-file-system/legacy';

// Lazy-load onnxruntime — the native module may be missing (Expo Go, older APK).
// Callers get null and fall back to the server endpoint.
let _ort: any = null;
let _ortTried = false;
function getORT(): any | null {
  if (_ort) return _ort;
  if (_ortTried) return null;
  _ortTried = true;
  try {
    _ort = require('onnxruntime-react-native');
    return _ort;
  } catch (e) {
    console.warn('[models] ORT not available — falling back to server');
    return null;
  }
}

// Type aliases since we lazy-load the real module
type InferenceSession = any;
type Tensor = any;

const MANIFEST_URL = 'https://github.com/darkmoorltd-jpg/gaia-mobile/releases/download/models-v2/manifest.json';
const CACHE_DIR = (FileSystem.documentDirectory || FileSystem.cacheDirectory || '') + 'gaia-models/';

// Models not in the models-v1 manifest — hardcoded fallback URLs
const EXTRA_MODELS: Record<string, ModelMeta> = {
  plant_id: {
    url: 'https://github.com/darkmoorltd-jpg/gaia-mobile/releases/download/models-v2-plant/model_int8.onnx',
    size_bytes: 100_160_000,
    img_size: 224,
    num_classes: 14829,
    label: 'Plant identification',
  },
};

export interface ModelMeta {
  url: string;
  size_bytes: number;
  sha256?: string;
  num_classes?: number;
  img_size?: number;
  label?: string;
  labels_url?: string;
  num_classes?: number;
}

let _manifest: Record<string, ModelMeta> | null = null;
const _sessions: Record<string, InferenceSession> = {};

// ============================================================
// Manifest
// ============================================================
export async function getManifest(forceRefresh = false): Promise<Record<string, ModelMeta>> {
  if (_manifest && !forceRefresh) return _manifest;
  try {
    const local = CACHE_DIR + 'manifest.json';
    const info = await FileSystem.getInfoAsync(local);
    if (info.exists && !forceRefresh) {
      const txt = await FileSystem.readAsStringAsync(local);
      _manifest = JSON.parse(txt);
      return _manifest!;
    }
    // download
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true }).catch(() => {});
    const res = await FileSystem.downloadAsync(MANIFEST_URL, local);
    const txt = await FileSystem.readAsStringAsync(res.uri);
    _manifest = JSON.parse(txt);
    return _manifest!;
  } catch (e) {
    console.warn('[models] manifest fetch failed', e);
    return {};
  }
}

// ============================================================
// Download + cache a single model
// ============================================================
export async function ensureModel(
  key: string,
  onProgress?: (pct: number, bytesIn: number, totalBytes: number) => void,
): Promise<string | null> {
  const manifest = await getManifest();
  const meta = manifest[key] || EXTRA_MODELS[key];
  if (!meta) {
    console.warn('[models] no meta for', key);
    return null;
  }

  await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true }).catch(() => {});
  const local = CACHE_DIR + key + '.onnx';

  const info = await FileSystem.getInfoAsync(local);
  if (info.exists && (info as any).size > 10000) {
    return local;
  }

  try {
    const dl = FileSystem.createDownloadResumable(
      meta.url,
      local,
      {},
      (p) => {
        if (onProgress) {
          const pct = p.totalBytesWritten / Math.max(1, p.totalBytesExpectedToWrite);
          onProgress(pct, p.totalBytesWritten, p.totalBytesExpectedToWrite);
        }
      },
    );
    const res = await dl.downloadAsync();
    if (!res || res.status !== 200) return null;
    return res.uri;
  } catch (e) {
    console.warn('[models] download failed', key, e);
    return null;
  }
}

// ============================================================
// Load session (cached in memory)
// ============================================================
export async function getSession(key: string): Promise<InferenceSession | null> {
  if (_sessions[key]) return _sessions[key];
  const ort = getORT();
  if (!ort) return null;
  const path = await ensureModel(key);
  if (!path) return null;
  try {
    const sess = await ort.InferenceSession.create(path);
    _sessions[key] = sess;
    return sess;
  } catch (e) {
    console.warn('[models] load failed', key, e);
    return null;
  }
}

// ============================================================
// Run inference
//   imgArray: Float32Array [1*3*H*W]  already normalized (0-1 or mean/std)
//   H, W: input size
// ============================================================
export async function runModel(
  key: string,
  imgArray: Float32Array,
  H: number,
  W: number,
): Promise<{ logits: Float32Array; numClasses: number } | null> {
  const ort = getORT();
  if (!ort) return null;
  const sess = await getSession(key);
  if (!sess) return null;
  try {
    const feeds: Record<string, any> = {
      input: new ort.Tensor('float32', imgArray, [1, 3, H, W]),
    };
    const out = await sess.run(feeds);
    const logits = out.logits?.data as Float32Array;
    return { logits, numClasses: logits.length };
  } catch (e) {
    console.warn('[models] infer failed', key, e);
    return null;
  }
}

export function softmax(logits: Float32Array | number[]): number[] {
  const arr = Array.from(logits);
  const max = Math.max(...arr);
  const exps = arr.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / sum);
}

// ============================================================
// Image → tensor helper
//   Takes base64 JPEG, returns [1*3*H*W] Float32Array using ImageManipulator
// ============================================================
export async function imageUriToTensor(
  uri: string,
  H: number,
  W: number,
): Promise<Float32Array | null> {
  try {
    const ImageManipulator = await import('expo-image-manipulator');
    const resized = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: W, height: H } }],
      { compress: 1, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    if (!resized.base64) return null;
    // decode JPEG via a canvas-free path — decode with jpeg-js
    const { decode } = await import('jpeg-js');
    const raw = decode(
      Uint8Array.from(atob(resized.base64), (c) => c.charCodeAt(0)),
      { useTArray: true },
    );
    // raw.data is RGBA. Extract RGB + normalize.
    const out = new Float32Array(3 * H * W);
    const mean = [0.485, 0.456, 0.406];
    const std = [0.229, 0.224, 0.225];
    for (let i = 0; i < H * W; i++) {
      const r = raw.data[i * 4] / 255;
      const g = raw.data[i * 4 + 1] / 255;
      const b = raw.data[i * 4 + 2] / 255;
      out[i]             = (r - mean[0]) / std[0];
      out[H * W + i]     = (g - mean[1]) / std[1];
      out[2 * H * W + i] = (b - mean[2]) / std[2];
    }
    return out;
  } catch (e) {
    console.warn('[models] tensor build failed', e);
    return null;
  }
}


// ============================================================
// Download and cache class labels for a model
// ============================================================
const _labelsCache: Record<string, string[]> = {};

export async function getLabels(key: string): Promise<string[]> {
  if (_labelsCache[key]) return _labelsCache[key];
  try {
    const manifest = await getManifest();
    const meta = manifest[key];
    if (!meta || !meta.labels_url) return [];

    const localPath = CACHE_DIR + key + '_labels.json';
    const info = await FileSystem.getInfoAsync(localPath);
    if (!info.exists) {
      await FileSystem.downloadAsync(meta.labels_url, localPath);
    }
    const txt = await FileSystem.readAsStringAsync(localPath);
    const data = JSON.parse(txt);
    const labels: string[] = data.classes || data.labels || [];
    _labelsCache[key] = labels;
    return labels;
  } catch (e) {
    console.warn('[models] getLabels failed', key, e);
    return [];
  }
}

// ============================================================
// Utility
// ============================================================
export async function isModelCached(key: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(CACHE_DIR + key + '.onnx');
    return info.exists && (info as any).size > 10000;
  } catch {
    return false;
  }
}

export async function clearAllModels(): Promise<void> {
  try {
    await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
    for (const k of Object.keys(_sessions)) delete _sessions[k];
  } catch {}
}



// ============================================================
// Plant identification — Propanito 14,829 classes
// ============================================================
const PLANT_LABELS_URL = 'https://github.com/darkmoorltd-jpg/gaia-mobile/releases/download/models-v2-plant/labels.json';
const PLANT_CROP_MAP_URL = 'https://github.com/darkmoorltd-jpg/gaia-mobile/releases/download/models-v2-plant/crop_map.json';

let _plantLabels: Record<string, string> | null = null;
let _plantCrops: Record<string, any> | null = null;

export interface PlantPrediction {
  idx: number;
  latin: string;
  common?: string;
  hasDiseaseModel?: boolean;
  modelKey?: string;
  confidence: number;
}

async function _dlOnce(url: string, filename: string): Promise<string | null> {
  try {
    const path = CACHE_DIR + filename;
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists && (info as any).size > 100) return path;
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true }).catch(() => {});
    const dl = await FileSystem.downloadAsync(url, path);
    return dl.status === 200 ? dl.uri : null;
  } catch { return null; }
}

export async function getPlantLabels(): Promise<Record<string, string>> {
  if (_plantLabels) return _plantLabels;
  const p = await _dlOnce(PLANT_LABELS_URL, 'plant_labels.json');
  if (!p) return {};
  try {
    _plantLabels = JSON.parse(await FileSystem.readAsStringAsync(p));
    return _plantLabels!;
  } catch { return {}; }
}

export async function getPlantCrops(): Promise<Record<string, any>> {
  if (_plantCrops) return _plantCrops;
  const p = await _dlOnce(PLANT_CROP_MAP_URL, 'plant_crops.json');
  if (!p) return {};
  try {
    _plantCrops = JSON.parse(await FileSystem.readAsStringAsync(p));
    return _plantCrops!;
  } catch { return {}; }
}

export async function plantTopK(logits: Float32Array, k: number = 5): Promise<PlantPrediction[]> {
  const labels = await getPlantLabels();
  const crops = await getPlantCrops();
  const probs = softmax(logits);
  const idxs = Array.from(probs.keys());
  idxs.sort((a, b) => probs[b] - probs[a]);
  return idxs.slice(0, k).map((idx) => {
    const latin = labels[String(idx)] || `Class ${idx}`;
    const meta = crops[String(idx)] || {};
    return {
      idx, latin,
      common: meta.common,
      hasDiseaseModel: !!meta.hasDiseaseModel,
      modelKey: meta.modelKey,
      confidence: probs[idx],
    };
  });
}
