import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Alert } from 'react-native';
import { supabase } from '../api/supabase';

export const LOCATION_TASK_NAME = 'gaia-trip-location';

// Mutable state shared between the task and UI
let _activeMovementId: string | null = null;
let _activeDriverId: string | null = null;
let _foregroundSub: Location.LocationSubscription | null = null;

// Task must be defined at module scope
if (!TaskManager.isTaskDefined(LOCATION_TASK_NAME)) {
  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
      console.warn('[bg-location] task error', error);
      return;
    }
    if (!data) return;
    const { locations } = data as any;
    if (!locations || !locations.length) return;
    if (!_activeMovementId || !_activeDriverId) return;

    for (const loc of locations) {
      try {
        await supabase.rpc('log_driver_location', {
          p_movement_id: _activeMovementId,
          p_driver_id: _activeDriverId,
          p_lat: loc.coords.latitude,
          p_lon: loc.coords.longitude,
          p_speed: loc.coords.speed ?? null,
        });
      } catch (e) {
        console.warn('[bg-location] insert failed', e);
      }
    }
  });
}

export async function startBackgroundTracking(
  movementId?: string,
  driverId?: string,
): Promise<boolean> {
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') {
      Alert.alert('Location Required', 'Enable location access to start the trip.');
      return false;
    }

    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== 'granted') {
      Alert.alert('Background Location Required',
        'Allow "Always" location so the warehouse can track the truck even when the app is closed.');
      return false;
    }

    _activeMovementId = movementId || null;
    _activeDriverId = driverId || null;

    // Foreground watcher — works even if TaskManager.start fails on emulators
    if (!_foregroundSub) {
      _foregroundSub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 100, timeInterval: 30000 },
        async (loc) => {
          if (!_activeMovementId || !_activeDriverId) return;
          try {
            await supabase.rpc('log_driver_location', {
              p_movement_id: _activeMovementId,
              p_driver_id: _activeDriverId,
              p_lat: loc.coords.latitude,
              p_lon: loc.coords.longitude,
              p_speed: loc.coords.speed ?? null,
            });
          } catch {}
        },
      );
    }

    // Background watcher — survives app backgrounding
    const already = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
    if (!already) {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.High,
        distanceInterval: 200,
        timeInterval: 60000,
        foregroundService: {
          notificationTitle: 'GAIA Trip Active',
          notificationBody: 'Sharing live location with your dispatcher.',
          notificationColor: '#00c853',
        },
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
      });
    }
    return true;
  } catch (e) {
    console.warn('[bg-location] start failed', e);
    return false;
  }
}

export async function stopBackgroundTracking(): Promise<void> {
  try {
    if (_foregroundSub) {
      _foregroundSub.remove();
      _foregroundSub = null;
    }
    const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
    if (started) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  } catch (e) {
    console.warn('[bg-location] stop failed', e);
  }
  _activeMovementId = null;
  _activeDriverId = null;
}
