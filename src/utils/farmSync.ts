import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../api/supabase';
import { saveFarm, type FarmPoint } from './farms';

const QUEUE_KEY = '@gaia_offline_farms';

export interface QueuedFarm {
  local_id: string;
  name: string;
  crop?: string;
  state: string;
  lga: string;
  community: string;
  ward: string;
  centroid_lat: number;
  centroid_lng: number;
  boundary: FarmPoint[];
  timestamp: number;
}

// 1. Add a farm to the local queue
export async function queueFarm(farm: Omit<QueuedFarm, 'local_id' | 'timestamp'>) {
  try {
    const existing = await getQueue();
    const newFarm: QueuedFarm = {
      ...farm,
      local_id: 'local_' + Date.now() + Math.random().toString(36).slice(2, 6),
      timestamp: Date.now(),
    };
    existing.push(newFarm);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(existing));
    return newFarm;
  } catch (e) {
    console.error('Failed to queue farm', e);
    return null;
  }
}

// 2. Get the current queue
export async function getQueue(): Promise<QueuedFarm[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// 3. Sync all pending farms to Supabase
export async function syncPendingFarms(): Promise<number> {
  const queue = await getQueue();
  if (queue.length === 0) return 0;

  console.log(`Syncing ${queue.length} offline farms...`);
  let successCount = 0;
  const remaining: QueuedFarm[] = [];

  for (const farm of queue) {
    const { error } = await saveFarm({
      name: farm.name,
      crop: farm.crop,
      state: farm.state,
      lga: farm.lga,
      community: farm.community,
      ward: farm.ward,
      centroid_lat: farm.centroid_lat,
      centroid_lng: farm.centroid_lng,
      boundary: farm.boundary,
    });

    if (error) {
      console.warn(`Failed to sync farm ${farm.name}:`, error);
      remaining.push(farm); // Keep it for next time
    } else {
      successCount++;
    }
  }

  // Save the remaining queue (if any failed)
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  console.log(`Sync complete. ${successCount} saved, ${remaining.length} remaining.`);
  return successCount;
}
