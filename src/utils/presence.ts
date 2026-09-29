import { supabase } from '../api/supabase';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

let intervalId: any = null;

export async function startPresenceHeartbeat(userId: string) {
  if (!userId) return;

  const send = async () => {
    try {
      const payload: any = {
        user_id: userId,
        last_seen: new Date().toISOString(),
        platform: Platform.OS,
        device_model: Device.modelName || 'unknown',
        app_version: '1.0.0',
      };

      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getLastKnownPositionAsync();
          if (loc) {
            payload.lat = loc.coords.latitude;
            payload.lon = loc.coords.longitude;
          }
        }
      } catch {}

      await supabase.from('user_presence').upsert(payload);
    } catch (e) {
      // silent
    }
  };

  await send();
  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(send, 30_000);   // every 30 seconds
}

export function stopPresenceHeartbeat() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
