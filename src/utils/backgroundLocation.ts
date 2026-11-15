import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { supabase } from '../api/supabase';

export const BG_LOCATION_TASK = 'gaia-bg-location';

// This runs in the background, outside of React
TaskManager.defineTask(BG_LOCATION_TASK, async ({ data, error }: any) => {
  if (error) {
    console.error('Background location error:', error);
    return;
  }
  if (data) {
    const { locations } = data;
    const loc = locations[0];
    
    // Check if user is logged in
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    // Find if driver has an active trip
    const { data: activeJob } = await supabase
      .from('batch_movements')
      .select('batch_id')
      .eq('driver_id', session.user.id)
      .eq('status', 'in_transit')
      .limit(1)
      .single();

    if (activeJob) {
      await supabase.from('driver_locations').insert({
        batch_id: activeJob.batch_id,
        driver_id: session.user.id,
        lat: loc.coords.latitude,
        lon: loc.coords.longitude,
        speed_kmh: loc.coords.speed ? loc.coords.speed * 3.6 : null,
        heading_deg: loc.coords.heading || null,
        accuracy_m: loc.coords.accuracy || null,
      });
    }
  }
});

export async function startBackgroundTracking() {
  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== 'granted') return false;

  const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
  if (bgStatus !== 'granted') return false;

  const hasStarted = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
  if (hasStarted) return true;

  await Location.startLocationUpdatesAsync(BG_LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 60000, // 60 seconds
    distanceInterval: 50, // OR 50 meters
    foregroundService: {
      notificationTitle: "GAIA Cargo Tracking Active",
      notificationBody: "Your location is being sent to the receiver.",
      notificationColor: "#00c853",
    },
  });
  return true;
}

export async function stopBackgroundTracking() {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
  if (hasStarted) {
    await Location.stopLocationUpdatesAsync(BG_LOCATION_TASK);
  }
}
