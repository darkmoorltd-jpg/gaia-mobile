import { create } from 'zustand';
import * as Location from 'expo-location';

export interface Coords {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

interface LocationState {
  coords: Coords | null;
  permission: 'unknown' | 'granted' | 'denied';
  ready: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

let watcher: Location.LocationSubscription | null = null;

export const useLocation = create<LocationState>((set, get) => ({
  coords: null,
  permission: 'unknown',
  ready: false,
  error: null,

  start: async () => {
    if (get().ready) return;
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        set({ permission: 'denied', ready: true, error: 'permission denied' });
        return;
      }
      set({ permission: 'granted' });

      try {
        await Location.enableNetworkProviderAsync().catch(() => {});
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        set({
          coords: {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            accuracy: loc.coords.accuracy ?? undefined,
          },
        });
      } catch (e) {
        // first shot failed, keep going to the watcher
      }

      watcher?.remove();
      watcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 10,
          timeInterval: 20000,
        },
        (loc) => {
          set({
            coords: {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              accuracy: loc.coords.accuracy ?? undefined,
            },
          });
        },
      );

      set({ ready: true });
    } catch (e: any) {
      set({ error: String(e && e.message ? e.message : e), ready: true });
    }
  },

  stop: () => {
    watcher?.remove();
    watcher = null;
    set({ ready: false });
  },
}));
