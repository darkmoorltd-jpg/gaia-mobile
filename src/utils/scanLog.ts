import * as Location from 'expo-location';
import { supabase } from '../api/supabase';

export async function logScan(params: {
  userId: string;
  scanType: 'crop' | 'pest' | 'soil' | 'livestock';
  target?: string;
  topLabel?: string;
  confidence?: number;
  imageUrl?: string;
}) {
  try {
    let lat: number | null = null;
    let lon: number | null = null;
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status === 'granted') {
        const loc = await Location.getLastKnownPositionAsync();
        if (loc) { lat = loc.coords.latitude; lon = loc.coords.longitude; }
      }
    } catch {}

    await supabase.from('scan_history').insert({
      user_id: params.userId,
      scan_type: params.scanType,
      target: params.target || null,
      top_label: params.topLabel || null,
      confidence: params.confidence ?? null,
      image_url: params.imageUrl || null,
      lat, lon,
    });
  } catch {}
}
