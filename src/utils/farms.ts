import { supabase } from '../api/supabase';

export interface FarmPoint {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}

export interface Farm {
  id?: string;
  user_id?: string;
  name: string;
  crop?: string;
  boundary: FarmPoint[];
  area_m2?: number;
  area_acres?: number;
  area_hectares?: number;
  perimeter_m?: number;
  boundary_length_m?: number;
  walked_distance_m?: number;
  centroid_lat?: number;
  centroid_lng?: number;
  state?: string;
  lga?: string;
  accuracy_avg_m?: number;
  completed?: boolean;
  notes?: string;
  created_at?: string;
}

const R = 6371000;

export function haversine(a: FarmPoint, b: FarmPoint): number {
  const p1 = (a.latitude * Math.PI) / 180;
  const p2 = (b.latitude * Math.PI) / 180;
  const dp = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dl = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function pathLength(points: FarmPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversine(points[i - 1], points[i]);
  return total;
}

export function enclosedArea(points: FarmPoint[]): number {
  if (points.length < 3) return 0;
  const latRef = points[0].latitude;
  const mPerLat = (Math.PI / 180) * R;
  const mPerLng = mPerLat * Math.cos((latRef * Math.PI) / 180);
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const xi = points[i].longitude * mPerLng;
    const yi = points[i].latitude * mPerLat;
    const xj = points[j].longitude * mPerLng;
    const yj = points[j].latitude * mPerLat;
    area += xi * yj - xj * yi;
  }
  return Math.abs(area) / 2;
}

export function polygonCentroid(points: FarmPoint[]): FarmPoint {
  if (points.length === 0) return { latitude: 0, longitude: 0 };
  if (points.length < 3) {
    const lat = points.reduce((s, p) => s + p.latitude, 0) / points.length;
    const lng = points.reduce((s, p) => s + p.longitude, 0) / points.length;
    return { latitude: lat, longitude: lng };
  }
  let cx = 0;
  let cy = 0;
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const xi = points[i].longitude;
    const yi = points[i].latitude;
    const xj = points[j].longitude;
    const yj = points[j].latitude;
    const f = xi * yj - xj * yi;
    a += f;
    cx += (xi + xj) * f;
    cy += (yi + yj) * f;
  }
  a *= 0.5;
  if (Math.abs(a) < 1e-12) {
    const lat = points.reduce((s, p) => s + p.latitude, 0) / points.length;
    const lng = points.reduce((s, p) => s + p.longitude, 0) / points.length;
    return { latitude: lat, longitude: lng };
  }
  return { latitude: cy / (6 * a), longitude: cx / (6 * a) };
}

export function filterByAccuracy(points: FarmPoint[], maxM: number): FarmPoint[] {
  return points.filter((p) => p.accuracy == null || p.accuracy <= maxM);
}

function perpDistance(p: FarmPoint, a: FarmPoint, b: FarmPoint): number {
  const latRef = a.latitude;
  const mPerLat = (Math.PI / 180) * R;
  const mPerLng = mPerLat * Math.cos((latRef * Math.PI) / 180);
  const px = (p.longitude - a.longitude) * mPerLng;
  const py = (p.latitude - a.latitude) * mPerLat;
  const bx = (b.longitude - a.longitude) * mPerLng;
  const by = (b.latitude - a.latitude) * mPerLat;
  const len = Math.sqrt(bx * bx + by * by);
  if (len < 1e-6) return Math.sqrt(px * px + py * py);
  return Math.abs(px * by - py * bx) / len;
}

export function simplifyPath(points: FarmPoint[], epsilonM: number): FarmPoint[] {
  if (points.length < 3) return points;
  const a = points[0];
  const b = points[points.length - 1];
  let maxDist = 0;
  let idx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDistance(points[i], a, b);
    if (d > maxDist) {
      maxDist = d;
      idx = i;
    }
  }
  if (maxDist > epsilonM) {
    const left = simplifyPath(points.slice(0, idx + 1), epsilonM);
    const right = simplifyPath(points.slice(idx), epsilonM);
    return left.slice(0, -1).concat(right);
  }
  return [a, b];
}

export function isNearStart(points: FarmPoint[], maxM: number): boolean {
  if (points.length < 3) return false;
  return haversine(points[0], points[points.length - 1]) <= maxM;
}

export function distanceToStart(points: FarmPoint[]): number {
  if (points.length === 0) return 0;
  return haversine(points[0], points[points.length - 1]);
}

export function accuracyAverage(points: FarmPoint[]): number | null {
  const vals: number[] = [];
  for (const p of points) {
    if (typeof p.accuracy === 'number') vals.push(p.accuracy);
  }
  if (vals.length === 0) return null;
  let sum = 0;
  for (const v of vals) sum += v;
  return sum / vals.length;
}

export async function saveFarm(farm: Farm): Promise<{ id: string | null; error: string | null }> {
  const res = await supabase.auth.getUser();
  const user = res.data.user;
  if (!user) return { id: null, error: 'Not logged in' };

  const raw = farm.boundary || [];
  const cleaned = filterByAccuracy(raw, 20);
  const path = simplifyPath(cleaned, 2.5);
  const perimeter = pathLength(path);
  const walked = pathLength(cleaned);
  const area = enclosedArea(path);
  const c = polygonCentroid(path);
  const acc = accuracyAverage(cleaned);

  const row: any = {
    user_id: user.id,
    name: farm.name,
    crop: farm.crop || null,
    boundary: path,
    area_m2: area,
    area_acres: area / 4046.86,
    area_hectares: area / 10000,
    perimeter_m: perimeter,
    boundary_length_m: perimeter,
    walked_distance_m: walked,
    centroid_lat: c.latitude,
    centroid_lng: c.longitude,
    state: farm.state || null,
    lga: farm.lga || null,
    accuracy_avg_m: acc,
    completed: isNearStart(cleaned, 30),
    notes: farm.notes || null,
    updated_at: new Date().toISOString(),
  };

  if (farm.id) {
    const r = await supabase.from('farms').update(row).eq('id', farm.id);
    return { id: farm.id, error: r.error ? r.error.message : null };
  }
  const ins = await supabase.from('farms').insert(row).select().single();
  return { id: ins.data ? ins.data.id : null, error: ins.error ? ins.error.message : null };
}

export async function listFarms(): Promise<Farm[]> {
  const res = await supabase.auth.getUser();
  const user = res.data.user;
  if (!user) return [];
  const { data } = await supabase
    .from('farms')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  return (data || []) as Farm[];
}

export async function deleteFarm(id: string): Promise<string | null> {
  const { error } = await supabase.from('farms').delete().eq('id', id);
  return error ? error.message : null;
}

export async function getFarm(id: string): Promise<Farm | null> {
  const { data } = await supabase.from('farms').select('*').eq('id', id).single();
  return (data as Farm) || null;
}
