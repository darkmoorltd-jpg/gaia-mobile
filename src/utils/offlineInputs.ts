
import AsyncStorage from '@react-native-async-storage/async-storage';
const CATALOG_KEY = 'gaia_input_catalog';
const QUEUE_KEY = 'gaia_input_order_queue';
export async function cacheCatalog(catalog: any[]) { await AsyncStorage.setItem(CATALOG_KEY, JSON.stringify(catalog)); }
export async function getCachedCatalog() { const d = await AsyncStorage.getItem(CATALOG_KEY); return d ? JSON.parse(d) : []; }
export async function queueOrder(order: any) {
  const q = await AsyncStorage.getItem(QUEUE_KEY);
  const queue = q ? JSON.parse(q) : [];
  queue.push({ ...order, id: Date.now().toString() });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return true;
}
