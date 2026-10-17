import * as Location from 'expo-location';

export interface WalkSession {
  started_at: number;
  points: { lat: number; lon: number; at: number }[];
  distance_m: number;
  last_prompt_m: number;
  prompts_triggered: number;
}

export function newWalkSession(): WalkSession {
  return { started_at: Date.now(), points: [], distance_m: 0, last_prompt_m: 0, prompts_triggered: 0 };
}

function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371000;
  const φ1 = a.lat * Math.PI / 180;
  const φ2 = b.lat * Math.PI / 180;
  const Δφ = (b.lat - a.lat) * Math.PI / 180;
  const Δλ = (b.lon - a.lon) * Math.PI / 180;
  const x = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/**
 * Start a field walk. Calls onPrompt every `promptEveryM` metres.
 * Returns a stop() function.
 */
export async function startWalk(
  promptEveryM: number,
  onUpdate: (s: WalkSession) => void,
  onPrompt: (s: WalkSession) => void,
): Promise<() => void> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return () => {};

  const session = newWalkSession();
  const sub = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.Balanced, distanceInterval: 5, timeInterval: 3000 },
    (loc) => {
      const p = { lat: loc.coords.latitude, lon: loc.coords.longitude, at: Date.now() };
      const last = session.points[session.points.length - 1];
      if (last) {
        session.distance_m += haversine(last, p);
      }
      session.points.push(p);

      if (session.distance_m - session.last_prompt_m >= promptEveryM) {
        session.last_prompt_m = session.distance_m;
        session.prompts_triggered += 1;
        onPrompt(session);
      }
      onUpdate({ ...session });
    },
  );

  return () => sub.remove();
}
