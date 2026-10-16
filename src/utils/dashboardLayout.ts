import { supabase } from '../api/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Widget {
  id: string;
  enabled: boolean;
}

export interface WidgetDef {
  id: string;
  title: string;
  icon: string;
  description: string;
  defaultEnabled: boolean;
}

// Central registry — order here is the default order
export const WIDGET_REGISTRY: WidgetDef[] = [
  { id: 'greeting',     icon: '\uD83D\uDC4B', title: 'Welcome',       description: 'Time-aware greeting with your name',        defaultEnabled: true },
  { id: 'weather',      icon: '\u2600\uFE0F', title: 'Weather',       description: 'Live weather at your location',             defaultEnabled: true },
  { id: 'streak',       icon: '\uD83D\uDD25', title: 'Streak',        description: 'Days in a row you used GAIA',               defaultEnabled: true },
  { id: 'scans',        icon: '\uD83D\uDCCA', title: 'Scans',         description: 'Scans remaining + current plan',            defaultEnabled: true },
  { id: 'quickActions', icon: '\u26A1',       title: 'Quick Actions', description: 'One-tap to Crops, Pests, Soil, Livestock',  defaultEnabled: true },
  { id: 'tips',         icon: '\uD83D\uDCA1', title: 'Farming Tip',   description: 'Rotating agronomy tip',                     defaultEnabled: true },
  { id: 'marketplace',  icon: '\uD83D\uDED2', title: 'Marketplace',   description: 'Preview listings + sell button',            defaultEnabled: false },
  { id: 'voice',        icon: '\uD83C\uDF99\uFE0F', title: 'Voice Agronomist', description: 'Talk to GAIA about your farm',       defaultEnabled: false },
  { id: 'satellite',    icon: '\uD83D\uDEF0\uFE0F', title: 'Satellite', description: 'Monitor field health from space',        defaultEnabled: false },
  { id: 'help',         icon: '\uD83C\uDD98', title: 'Help & Support', description: 'Open a support ticket',                    defaultEnabled: false },
];

export function defaultLayout(): Widget[] {
  return WIDGET_REGISTRY.map((w) => ({ id: w.id, enabled: w.defaultEnabled }));
}

// Merge saved layout with any new widgets added to registry
export function mergeLayout(saved: Widget[] | null): Widget[] {
  const base = defaultLayout();
  if (!saved || !Array.isArray(saved) || saved.length === 0) return base;

  const known = new Set(WIDGET_REGISTRY.map((w) => w.id));
  const seen = new Set<string>();
  const merged: Widget[] = [];

  // preserve saved order + enabled flags, drop unknown IDs
  for (const w of saved) {
    if (!w || typeof w.id !== 'string') continue;
    if (!known.has(w.id)) continue;
    if (seen.has(w.id)) continue;
    seen.add(w.id);
    merged.push({ id: w.id, enabled: !!w.enabled });
  }
  // append any new widgets not present in saved
  for (const w of base) {
    if (!seen.has(w.id)) merged.push(w);
  }
  return merged;
}

const KEY_PREFIX = 'gaia_dashboard_layout_';

export async function loadLayout(userId: string | undefined): Promise<Widget[]> {
  if (!userId) return defaultLayout();

  // 1. AsyncStorage cache — fastest, works offline
  try {
    const raw = await AsyncStorage.getItem(KEY_PREFIX + userId);
    if (raw) {
      const parsed = JSON.parse(raw);
      return mergeLayout(parsed);
    }
  } catch {}

  // 2. Supabase
  try {
    const { data, error } = await supabase
      .from('user_dashboard_layout')
      .select('layout')
      .eq('user_id', userId)
      .maybeSingle();
    if (!error && data?.layout) {
      const merged = mergeLayout(data.layout);
      await AsyncStorage.setItem(KEY_PREFIX + userId, JSON.stringify(merged));
      return merged;
    }
  } catch {}

  // 3. Default
  return defaultLayout();
}

export async function saveLayout(userId: string | undefined, layout: Widget[]): Promise<void> {
  if (!userId) return;
  const clean = layout.map((w) => ({ id: w.id, enabled: !!w.enabled }));
  // cache first for snappy UX
  try { await AsyncStorage.setItem(KEY_PREFIX + userId, JSON.stringify(clean)); } catch {}
  // then push to Supabase
  try {
    await supabase
      .from('user_dashboard_layout')
      .upsert(
        { user_id: userId, layout: clean, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );
  } catch {}
}
