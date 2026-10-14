import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'gaia:offline_queue';

export interface OfflineScan {
  id: string;
  crop: string;
  consensusLabel: string;
  consensusConf: number;
  severity: number;
  framesAnalyzed: number;
  voteCount: number;
  voteTotal: number;
  durationSec: number;
  gpsLat: number | null;
  gpsLon: number | null;
  locationLabel: string | null;
  createdAt: string;
  retries: number;
}

export async function listQueue(): Promise<OfflineScan[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OfflineScan[];
  } catch {
    return [];
  }
}

export async function enqueueScan(item: OfflineScan): Promise<void> {
  try {
    const cur = await listQueue();
    cur.push(item);
    await AsyncStorage.setItem(KEY, JSON.stringify(cur));
  } catch {}
}

export async function removeFromQueue(id: string): Promise<void> {
  try {
    const cur = await listQueue();
    const next = cur.filter((x) => x.id !== id);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}

export async function queueSize(): Promise<number> {
  const q = await listQueue();
  return q.length;
}

export async function clearQueue(): Promise<void> {
  try { await AsyncStorage.removeItem(KEY); } catch {}
}
