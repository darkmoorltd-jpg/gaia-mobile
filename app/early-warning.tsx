import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import * as Location from 'expo-location';
import { useTheme, typography, spacing, radius } from '../src/theme';

const CROP_DISEASE_RULES = [
  { crop: 'maize',    name: 'Northern Leaf Blight', tempMin: 18, tempMax: 27, humMin: 80 },
  { crop: 'maize',    name: 'Common Rust',          tempMin: 15, tempMax: 25, humMin: 90 },
  { crop: 'rice',     name: 'Rice Blast',           tempMin: 20, tempMax: 30, humMin: 85 },
  { crop: 'tomato',   name: 'Late Blight',          tempMin: 10, tempMax: 24, humMin: 90 },
  { crop: 'tomato',   name: 'Early Blight',         tempMin: 20, tempMax: 30, humMin: 70 },
  { crop: 'cassava',  name: 'Mosaic Disease',       tempMin: 25, tempMax: 35, humMin: 60 },
  { crop: 'beans',    name: 'Angular Leaf Spot',    tempMin: 20, tempMax: 28, humMin: 85 },
];

interface Risk { name: string; crop: string; pct: number; color: string; }

export default function EarlyWarning() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [busy, setBusy] = useState(true);
  const [loc, setLoc] = useState<{ lat: number; lon: number } | null>(null);
  const [weather, setWeather] = useState<any>(null);
  const [risks, setRisks] = useState<Risk[]>([]);

  const computeRisks = (daily: any) => {
    if (!daily || !daily.time) return [];
    const out: Risk[] = [];
    // Use next 7 days
    for (let i = 0; i < Math.min(7, daily.time.length); i++) {
      const tMax = daily.temperature_2m_max[i];
      const tMin = daily.temperature_2m_min[i];
      const hum = daily.relative_humidity_2m_max[i];
      const avgT = (tMax + tMin) / 2;
      for (const rule of CROP_DISEASE_RULES) {
        if (avgT >= rule.tempMin && avgT <= rule.tempMax && hum >= rule.humMin) {
          const tScore = 1 - Math.abs(avgT - (rule.tempMin + rule.tempMax) / 2) / 10;
          const hScore = Math.min(1, (hum - rule.humMin) / 20 + 0.5);
          const pct = Math.round(Math.max(20, Math.min(95, (tScore * 0.5 + hScore * 0.5) * 100)));
          out.push({
            name: rule.name,
            crop: rule.crop,
            pct,
            color: pct > 70 ? palette.danger : pct > 45 ? palette.warning : palette.neon,
          });
        }
      }
    }
    // Dedupe, keep highest
    const map = new Map<string, Risk>();
    out.forEach((r) => {
      const key = r.crop + '-' + r.name;
      if (!map.has(key) || map.get(key)!.pct < r.pct) map.set(key, r);
    });
    return Array.from(map.values()).sort((a, b) => b.pct - a.pct).slice(0, 6);
  };

  const load = async () => {
    setBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission required'); setBusy(false); return; }
      const pos = await Location.getCurrentPositionAsync({});
      setLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude });

      const url = `https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}` +
        '&daily=temperature_2m_max,temperature_2m_min,relative_humidity_2m_max,precipitation_sum' +
        '&forecast_days=14&timezone=auto';
      const res = await fetch(url);
      const data = await res.json();
      setWeather(data);
      setRisks(computeRisks(data.daily));
    } catch (e: any) {
      Alert.alert('Weather error', e?.message || 'Could not load weather');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { load(); }, []);

  const today = weather?.daily;
  const overall = risks.length === 0 ? 'LOW' : (risks[0].pct > 70 ? 'HIGH' : risks[0].pct > 45 ? 'MODERATE' : 'LOW');

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.kicker}>EARLY WARNING</Text>
        <Text style={styles.title}>{loc ? `${loc.lat.toFixed(2)}, ${loc.lon.toFixed(2)}` : 'Your region'}</Text>

        {busy ? (
          <ActivityIndicator color={palette.neon} style={{ marginTop: 30 }} />
        ) : (
          <>
            <View style={[styles.riskCard, { borderColor: overall === 'HIGH' ? palette.danger : overall === 'MODERATE' ? palette.warning : palette.neon }]}>
              <Text style={styles.riskLabel}>CURRENT RISK LEVEL</Text>
              <Text style={[styles.riskValue, { color: overall === 'HIGH' ? palette.danger : overall === 'MODERATE' ? palette.warning : palette.neon }]}>{overall}</Text>
            </View>

            {today ? (
              <View style={styles.forecastRow}>
                <View style={styles.forecast}>
                  <Text style={styles.fVal}>{Math.round(today.temperature_2m_max[0])}°</Text>
                  <Text style={styles.fLbl}>HIGH</Text>
                </View>
                <View style={styles.forecast}>
                  <Text style={styles.fVal}>{Math.round(today.temperature_2m_min[0])}°</Text>
                  <Text style={styles.fLbl}>LOW</Text>
                </View>
                <View style={styles.forecast}>
                  <Text style={styles.fVal}>{today.relative_humidity_2m_max[0]}%</Text>
                  <Text style={styles.fLbl}>HUMIDITY</Text>
                </View>
                <View style={styles.forecast}>
                  <Text style={styles.fVal}>{today.precipitation_sum[0].toFixed(0)}</Text>
                  <Text style={styles.fLbl}>MM RAIN</Text>
                </View>
              </View>
            ) : null}

            <Text style={styles.section}>DISEASE RISK (NEXT 7 DAYS)</Text>

            {risks.length === 0 ? (
              <Text style={styles.empty}>No significant risk detected in your area.</Text>
            ) : risks.map((r, i) => (
              <View key={i} style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.diseaseName}>{r.name}</Text>
                    <Text style={styles.cropLabel}>{r.crop.toUpperCase()}</Text>
                  </View>
                  <Text style={[styles.pct, { color: r.color }]}>{r.pct}%</Text>
                </View>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: `${r.pct}%` as any, backgroundColor: r.color }]} />
                </View>
              </View>
            ))}
          </>
        )}

        <Pressable onPress={load} style={styles.cta}>
          <Text style={styles.ctaTxt}>REFRESH</Text>
        </Pressable>
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { paddingHorizontal: 20, paddingTop: 60 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: p.neon },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 6 },
  riskCard: { padding: 20, borderRadius: 18, borderWidth: 2, marginTop: 18 },
  riskLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted },
  riskValue: { fontSize: 32, fontWeight: '900', letterSpacing: 1, marginTop: 4 },
  forecastRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  forecast: { flex: 1, padding: 12, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  fVal: { fontSize: 18, fontWeight: '900', color: p.text },
  fLbl: { fontSize: 9, fontWeight: '700', letterSpacing: 1, color: p.textMuted, marginTop: 2 },
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 24, marginBottom: 12 },
  empty: { fontSize: 13, color: p.textMuted, textAlign: 'center', paddingVertical: 20 },
  card: { padding: 16, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  diseaseName: { fontSize: 15, fontWeight: '800', color: p.text },
  cropLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, color: p.textMuted, marginTop: 2 },
  pct: { fontSize: 20, fontWeight: '900' },
  barBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 22 },
  ctaTxt: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
});
