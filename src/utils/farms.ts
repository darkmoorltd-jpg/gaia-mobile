import { supabase } from '../api/supabase';

export interface FarmPoint {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}

export function haversine(a: {latitude:number, longitude:number}, b: {latitude:number, longitude:number}) {
  const R = 6371000; // meters
  const dLat = (b.latitude - a.latitude) * Math.PI / 180;
  const dLon = (b.longitude - a.longitude) * Math.PI / 180;
  const lat1 = a.latitude * Math.PI / 180;
  const lat2 = b.latitude * Math.PI / 180;
  const x = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}

export function pathLength(points: FarmPoint[]) {
  let dist = 0;
  for (let i = 0; i < points.length - 1; i++) {
    dist += haversine(points[i], points[i+1]);
  }
  return dist;
}

export function enclosedArea(points: FarmPoint[]) {
  if (points.length < 3) return 0;
  let area = 0;
  const R = 6378137; // Earth radius in meters
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    area += (p2.longitude - p1.longitude) * (2 + Math.sin(p1.latitude * Math.PI / 180) + Math.sin(p2.latitude * Math.PI / 180));
  }
  return Math.abs(area * R * R / 2);
}

export function filterByAccuracy(points: FarmPoint[], maxAcc = 20) {
  return points.filter(p => !p.accuracy || p.accuracy <= maxAcc);
}

export function simplifyPath(points: FarmPoint[], tolerance = 2.5) {
  if (points.length < 3) return points;
  // Very basic simplification (just returns points for now, could implement Douglas-Peucker)
  return points;
}

export async function saveFarm(data: {
  name: string;
  crop?: string;
  state: string;
  lga?: string;
  community?: string;
  ward?: string;
  centroid_lat?: number;
  centroid_lng?: number;
  boundary: FarmPoint[];
}) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Not logged in');

    // Insert into the farms table
    const { data: inserted, error } = await supabase.from('farms').insert({
      user_id: session.user.id,
      name: data.name,
      crop: data.crop,
      state: data.state,
      lga: data.lga,
      community: data.community,
      ward: data.ward,
      centroid_lat: data.centroid_lat,
      centroid_lng: data.centroid_lng,
      boundary: data.boundary,
    }).select().single();

    if (error) throw error;
    return { data: inserted, error: null };
  } catch (e: any) {
    return { data: null, error: e.message || 'Failed to save farm' };
  }
}
