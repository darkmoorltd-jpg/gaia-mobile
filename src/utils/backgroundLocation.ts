import * as Location from 'expo-location';
import { Alert } from 'react-native';

let watchSub: Location.LocationSubscription | null = null;

export async function startBackgroundTracking(): Promise<boolean> {
  try {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Background location is needed to track the trip.');
      return false;
    }
    watchSub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 100 }, 
      (loc) => {
        // In a real app, send to Supabase here
        console.log('BG GPS:', loc.coords.latitude, loc.coords.longitude);
      }
    );
    return true;
  } catch (e) {
    return false;
  }
}

export async function stopBackgroundTracking(): Promise<void> {
  if (watchSub) {
    watchSub.remove();
    watchSub = null;
  }
}
