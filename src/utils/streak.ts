import { supabase } from '../api/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'gaia_streak';

export interface StreakInfo {
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
}

const EMPTY: StreakInfo = { current_streak: 0, longest_streak: 0, last_active_date: null };

export async function getCachedStreak(): Promise<StreakInfo> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return EMPTY;
    return JSON.parse(raw);
  } catch {
    return EMPTY;
  }
}

export async function bumpStreak(): Promise<StreakInfo> {
  const cached = await getCachedStreak();
  try {
    const { data, error } = await supabase.rpc('bump_streak');
    if (error || !data) return cached;
    const fresh: StreakInfo = {
      current_streak: data.current_streak ?? 0,
      longest_streak: data.longest_streak ?? 0,
      last_active_date: data.last_active_date ?? null,
    };
    await AsyncStorage.setItem(KEY, JSON.stringify(fresh));
    return fresh;
  } catch {
    return cached;
  }
}

export function streakEmoji(n: number): string {
  if (n >= 100) return '\uD83C\uDFC6';
  if (n >= 30) return '\uD83D\uDC8E';
  if (n >= 14) return '\u26A1';
  if (n >= 7) return '\uD83D\uDD25';
  if (n >= 3) return '\u2728';
  return '\uD83C\uDF31';
}
