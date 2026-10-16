import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme';

const CACHE_KEY = 'gaia_weather_cache';
const LOC_KEY = 'gaia_loc_cache';
const CACHE_TTL_MS = 30 * 60 * 1000;
const LOC_TTL_MS = 24 * 60 * 60 * 1000;

interface Weather {
  temp: number;
  humidity: number;
  wind: number;
  code: number;
  daily: { date: string; code: number; tmax: number; tmin: number; precip: number }[];
}

function weatherEmoji(code: number): string {
  if (code === 0) return '\u2600\uFE0F';
  if (code === 1) return '\uD83C\uDF24\uFE0F';
  if (code === 2) return '\u26C5';
  if (code === 3) return '\u2601\uFE0F';
  if (code === 45 || code === 48) return '\uD83C\uDF2B\uFE0F';
  if (code >= 51 && code <= 57) return '\uD83C\uDF26\uFE0F';
  if (code >= 61 && code <= 67) return '\uD83C\uDF27\uFE0F';
  if (code >= 71 && code <= 77) return '\u2744\uFE0F';
  if (code >= 80 && code <= 82) return '\uD83C\uDF27\uFE0F';
  if (code >= 95) return '\u26C8\uFE0F';
  return '\uD83C\uDF21\uFE0F';
}

export default function WeatherWidget() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.ts && Date.now() - parsed.ts < CACHE_TTL_MS) {
            if (mounted) { setWeather(parsed.w); setBusy(false); }
            return;
          }
        }

        let lat: number | null = null;
        let lon: number | null = null;
        const locRaw = await AsyncStorage.getItem(LOC_KEY);
        if (locRaw) {
          const loc = JSON.parse(locRaw);
          if (loc.ts && Date.now() - loc.ts < LOC_TTL_MS) { lat = loc.lat; lon = loc.lon; }
        }

        if (lat === null) {
          const perm = await Location.requestForegroundPermissionsAsync();
          if (perm.status !== 'granted') {
            if (mounted) { setErr('no_permission'); setBusy(false); }
            return;
          }
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = loc.coords.latitude;
          lon = loc.coords.longitude;
          await AsyncStorage.setItem(LOC_KEY, JSON.stringify({ lat, lon, ts: Date.now() }));
        }

        const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
          '&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m' +
          '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
          '&timezone=auto&forecast_days=3';
        const res = await fetch(url);
        const data = await res.json();

        const w: Weather = {
          temp: Math.round(data.current?.temperature_2m ?? 0),
          humidity: Math.round(data.current?.relative_humidity_2m ?? 0),
          wind: Math.round(data.current?.wind_speed_10m ?? 0),
          code: data.current?.weather_code ?? 0,
          daily: (data.daily?.time || []).map((d: string, i: number) => ({
            date: d,
            code: data.daily.weather_code[i],
            tmax: Math.round(data.daily.temperature_2m_max[i]),
            tmin: Math.round(data.daily.temperature_2m_min[i]),
            precip: data.daily.precipitation_probability_max?.[i] ?? 0,
          })),
        };
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), w }));
        if (mounted) { setWeather(w); setBusy(false); }
      } catch (e: any) {
        if (mounted) { setErr(e?.message || 'weather_failed'); setBusy(false); }
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (err === 'no_permission' || (!weather && !busy && err)) return null;
  if (busy && !weather) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={palette.neon} size="small" />
      </View>
    );
  }
  if (!weather) return null;

  return (
    <View style={styles.card}>
      <View style={styles.left}>
        <Text style={styles.temp}>{weather.temp}C</Text>
        <Text style={styles.meta}>{weather.humidity}% RH - {weather.wind} km/h</Text>
      </View>
      <Text style={styles.bigIcon}>{weatherEmoji(weather.code)}</Text>
      <View style={styles.right}>
        {weather.daily.slice(1, 4).map((d) => {
          const label = new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' });
          return (
            <View key={d.date} style={styles.mini}>
              <Text style={styles.miniDay}>{label}</Text>
              <Text style={styles.miniIcon}>{weatherEmoji(d.code)}</Text>
              <Text style={styles.miniT}>{d.tmax} / {d.tmin}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 18, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 16 },
  left: { flex: 1 },
  temp: { fontSize: 28, fontWeight: '900', color: p.neon, letterSpacing: -0.5 },
  meta: { fontSize: 10, color: p.textMuted, marginTop: 2, letterSpacing: 0.5 },
  bigIcon: { fontSize: 38, marginHorizontal: 8 },
  right: { flex: 1.4, flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  mini: { alignItems: 'center', minWidth: 48 },
  miniDay: { fontSize: 10, color: p.textMuted, fontWeight: '700' },
  miniIcon: { fontSize: 18, marginVertical: 2 },
  miniT: { fontSize: 10, color: p.text, fontWeight: '600' },
});
