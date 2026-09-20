import { useEffect } from 'react';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import { Platform, AppState } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../api/supabase';

export function usePresenceHeartbeat(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;
    let timer: any = null;

    const beat = async () => {
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

        await supabase.from('user_presence').upsert({
          user_id: userId,
          last_seen: new Date().toISOString(),
          platform: Platform.OS,
          device_model: Device.modelName || 'unknown',
          app_version: Constants.expoConfig?.version || '1.0.0',
          lat, lon,
        }, { onConflict: 'user_id' });
      } catch (e) {
        // silent
      }
    };

    beat();
    timer = setInterval(beat, 60000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') beat();
    });
    return () => { if (timer) clearInterval(timer); sub.remove(); };
  }, [userId]);
}
