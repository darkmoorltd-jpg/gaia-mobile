import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from '../api/supabase';

const TASK = 'GAIA_DRIVER_LOCATION';

if (!TaskManager.isTaskDefined(TASK)) {
  TaskManager.defineTask(TASK, async ({ data, error }: any) => {
    if (error) return;
    if (!data?.locations?.length) return;
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    if (!userId) return;

    const rows = data.locations.map((l: any) => ({
      driver_id: userId,
      lat: l.coords.latitude,
      lon: l.coords.longitude,
      accuracy_m: l.coords.accuracy,
      speed_kmh: l.coords.speed != null ? l.coords.speed * 3.6 : null,
      heading_deg: l.coords.heading,
      recorded_at: new Date(l.timestamp).toISOString(),
    }));
    await supabase.from('driver_locations').insert(rows);
    await supabase.from('driver_shifts')
      .update({ started_at: new Date().toISOString() })
      .eq('driver_id', userId)
      .is('ended_at', null);
  });
}

export async function startBackgroundTracking(): Promise<boolean> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return false;
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') return false;

  const already = await Location.hasStartedLocationUpdatesAsync(TASK);
  if (already) return true;

  await Location.startLocationUpdatesAsync(TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 20000,
    distanceInterval: 30,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'GAIA Driver',
      notificationBody: 'Tracking your location while you are online.',
      notificationColor: '#00ff88',
    },
  });
  return true;
}

export async function stopBackgroundTracking(): Promise<void> {
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(TASK);
    if (started) await Location.stopLocationUpdatesAsync(TASK);
  } catch {}
}
