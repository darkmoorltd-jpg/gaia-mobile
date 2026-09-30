import { supabase } from '../api/supabase';

export interface FarmPoint { latitude: number; longitude: number; }
export interface Farm {
  id?: string; user_id?: string; name: string; crop?: string;
  boundary: FarmPoint[]; area_m2?: number; area_acres?: number;
  area_hectares?: number; boundary_length_m?: number; notes?: string;
  created_at?: string;
}

export function haversine(a: FarmPoint, b: FarmPoint): number {
  const R = 6371000;
  const p1 = (a.latitude * Math.PI) / 180;
  const p2 = (b.latitude * Math.PI) / 180;
  const dp = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dl = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h = Math.sin(dp/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function pathLength(points: FarmPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversine(points[i-1], points[i]);
  return total;
}

export function enclosedArea(points: FarmPoint[]): number {
  if (points.length < 3) return 0;
  const latRef = points[0].latitude;
  const R = 6371000;
  const mPerLat = (Math.PI / 180) * R;
  const mPerLng = mPerLat * Math.cos((latRef * Math.PI) / 180);
  const proj = points.map((p) => ({ x: p.longitude * mPerLng, y: p.latitude * mPerLat }));
  let area = 0;
  for (let i = 0; i < proj.length; i++) {
    const j = (i + 1) % proj.length;
    area += proj[i].x * proj[j].y - proj[j].x * proj[i].y;
  }
  return Math.abs(area) / 2;
}

export function farmCenter(points: FarmPoint[]): FarmPoint {
  if (points.length === 0) return { latitude: 0, longitude: 0 };
  const lat = points.reduce((s, p) => s + p.latitude, 0) / points.length;
  const lng = points.reduce((s, p) => s + p.longitude, 0) / points.length;
  return { latitude: lat, longitude: lng };
}

export async function saveFarm(farm: Farm): Promise<{ id: string | null; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { id: null, error: 'Not logged in' };
  const m = pathLength(farm.boundary);
  const a2 = enclosedArea(farm.boundary);
  const row: any = {
    user_id: user.id, name: farm.name, crop: farm.crop || null,
    boundary: farm.boundary, area_m2: a2, area_acres: a2 / 4046.86,
    area_hectares: a2 / 10000, boundary_length_m: m, notes: farm.notes || null,
  };
  if (farm.id) {
    const { error } = await supabase.from('farms').update(row).eq('id', farm.id);
    return { id: farm.id, error: error?.message || null };
  }
  const { data, error } = await supabase.from('farms').insert(row).select().single();
  return { id: data?.id || null, error: error?.message || null };
}

export async function listFarms(): Promise<Farm[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from('farms').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  return (data || []) as Farm[];
}

export async function deleteFarm(id: string): Promise<string | null> {
  const { error } = await supabase.from('farms').delete().eq('id', id);
  return error?.message || null;
}

export async function getFarm(id: string): Promise<Farm | null> {
  const { data } = await supabase.from('farms').select('*').eq('id', id).single();
  return (data as Farm) || null;
}
