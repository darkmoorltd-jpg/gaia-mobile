import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../api/supabase';

const CACHE_KEY = '@gaia_inputs_catalog';
const QUEUE_KEY = '@gaia_inputs_order_queue';

export async function cacheCatalog(products: any[]) {
  try { await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(products)); } catch {}
}

export async function getCachedCatalog(): Promise<any[]> {
  try {
    const data = await AsyncStorage.getItem(CACHE_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

export async function queueOrder(orderData: any) {
  try {
    const existing = await getPendingOrders();
    existing.push({ ...orderData, queued_at: new Date().toISOString() });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(existing));
    return true;
  } catch { return false; }
}

export async function getPendingOrders(): Promise<any[]> {
  try {
    const data = await AsyncStorage.getItem(QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

export async function syncPendingOrders() {
  const pending = await getPendingOrders();
  if (pending.length === 0) return;

  const remaining = [];
  for (const order of pending) {
    try {
      // Try to execute the wallet payment
      const { error } = await supabase.rpc('input_buy_with_wallet', {
        p_product_id: order.product_id,
        p_quantity: order.quantity,
        p_delivery_method: order.delivery_method,
        p_delivery_address: order.delivery_address
      });
      
      if (error) {
        console.log('Sync failed for order, keeping in queue:', error.message);
        remaining.push(order); // Keep it for later if wallet is empty or stock is gone
      }
    } catch (e) {
      remaining.push(order); // Network failed again, keep it
    }
  }
  
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
}
