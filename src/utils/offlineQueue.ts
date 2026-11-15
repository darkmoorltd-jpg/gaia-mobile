import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../api/supabase';

const QUEUE_KEY = 'gaia_offline_queue';

export interface QueueItem {
  id: string;
  table: string;
  action: 'insert' | 'update';
  payload: any;
  match?: { column: string; value: any };
}

export async function enqueue(table: string, action: 'insert' | 'update', payload: any, match?: any) {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue: QueueItem[] = raw ? JSON.parse(raw) : [];
    queue.push({
      id: Math.random().toString(36).substring(2),
      table, action, payload, match
    });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    console.log('[offline] queued', table);
  } catch (e) {
    console.warn('[offline] enqueue failed', e);
  }
}

export async function syncQueue() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return;
    let queue: QueueItem[] = JSON.parse(raw);
    if (queue.length === 0) return;

    const remaining: QueueItem[] = [];
    for (const item of queue) {
      try {
        if (item.action === 'insert') {
          const { error } = await supabase.from(item.table).insert(item.payload);
          if (error) throw error;
        } else if (item.action === 'update' && item.match) {
          const { error } = await supabase.from(item.table).update(item.payload).eq(item.match.column, item.match.value);
          if (error) throw error;
        }
      } catch (e) {
        // Still offline or failed, keep in queue
        remaining.push(item);
      }
    }
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    console.log('[offline] synced. remaining:', remaining.length);
  } catch (e) {
    console.warn('[offline] sync failed', e);
  }
}
