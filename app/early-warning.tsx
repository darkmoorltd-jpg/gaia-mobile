import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

interface Rule {
  crop: string;
  disease: string;
  temp_min: number;
  temp_max: number;
  humidity_min: number;
  rain_trigger_mm: number;
  severity: string;
  action: string;
  products: string;
}

interface LiveOutbreak {
  disease: string;
  lga: string;
  n: number;
  last_seen: string;
  avg_conf: number;
}

interface Risk {
  crop: string;
  disease: string;
  risk_pct: number;
  reason: string;
  source: 'weather' | 'live' | 'both';
  action: string;
  products: string;
  severity: string;
  peak_day?: string;
}

const sevColor = (s: string, p: any) =>
  s === 'critical' ? '#ff3b5c' : s === 'high' ? '#ff6b35' : s === 'medium' ? '#ffb300' : p.neon;

export default function EarlyWarning() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);

  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [loc, setLoc] = useState<{ lat: number; lon: number; city?: string } | null>(null);
  const [weather, setWeather] = useState<any>(null);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [myCrops, setMyCrops] = useState<string[]>([]);
  const [liveCount, setLiveCount] = useState(0);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Location needed', 'GAIA uses your location to forecast disease risk.');
        setBusy(false); setRef(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      let city: string | undefined;
      try {
        const geo = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        if (geo && geo[0]) city = (geo[0].city || geo[0].subregion || geo[0].region || '').trim();
      } catch {}
      setLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude, city });

      const prof = await supabase.from('user_profiles')
        .select('primary_crops,state,farm_state')
        .eq('user_id', user.id).maybeSingle();
      const p = prof.data || {};
      const cropsRaw = p.primary_crops || '';
      const crops = String(cropsRaw).split(/[,;/]/).map(s => s.trim().toLowerCase()).filter(Boolean);
      setMyCrops(crops);
      const state = (p.state || p.farm_state || '').trim() || null;

      const [rulesR, outbreakR] = await Promise.all([
        supabase.rpc('get_disease_rules'),
        supabase.rpc('get_live_outbreaks', { p_state: state, p_days: 30 }),
      ]);
      const rules: Rule[] = (rulesR.data || []) as Rule[];
      const outbreaks: LiveOutbreak[] = (outbreakR.data || []) as LiveOutbreak[];
      setLiveCount(outbreaks.reduce((s, o) => s + o.n, 0));

      const url = `https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}` +
        '&daily=temperature_2m_max,temperature_2m_min,relative_humidity_2m_max,precipitation_sum' +
        '&forecast_days=14&timezone=auto';
      const wres = await fetch(url);
      const wdata = await wres.json();
      setWeather(wdata);

      const computed = computeRisks(rules, wdata.daily, outbreaks, crops);
      setRisks(computed);

      for (const r of computed.slice(0, 5)) {
        try {
          await supabase.rpc('save_early_alert', {
            p_crop: r.crop,
            p_disease: r.disease,
            p_risk_pct: r.risk_pct,
            p_reason: r.reason,
            p_source: r.source,
            p_action: r.action,
            p_products: r.products,
          });
        } catch {}
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not load early warning');
    } finally {
      setBusy(false);
      setRef(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRef(true); load(); };

  const overall = risks.length === 0 ? 'LOW'
    : risks[0].risk_pct > 70 ? 'HIGH'
    : risks[0].risk_pct > 45 ? 'MODERATE' : 'LOW';
  const overallColor = overall === 'HIGH' ? '#ff3b5c' : overall === 'MODERATE' ? '#ffb300' : '#00ff88';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={onRefresh} tintColor={palette.neon} />}>

        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.kicker}>EARLY WARNING</Text>
        <Text style={styles.title}>{loc?.city || 'Your region'}</Text>
        <Text style={styles.sub}>
          {myCrops.length > 0 ? 'Tracking: ' + myCrops.join(', ') : 'Set your crops in Profile for sharper alerts'}
        </Text>

        {busy && risks.length === 0 ? <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} /> : null}

        <View style={[styles.overallCard, { borderColor: overallColor }]}>
          <Text style={styles.overallLabel}>CURRENT RISK LEVEL</Text>
          <Text style={[styles.overallValue, { color: overallColor }]}>{overall}</Text>
          <Text style={styles.overallMeta}>
            {risks.length} active signals · {liveCount} nearby reports in last 30d
          </Text>
        </View>

        {weather?.daily ? (
          <View style={styles.weatherRow}>
            <View style={styles.weatherCell}>
              <Text style={styles.wVal}>{Math.round(weather.daily.temperature_2m_max[0])}deg</Text>
              <Text style={styles.wLbl}>HIGH</Text>
            </View>
            <View style={styles.weatherCell}>
              <Text style={styles.wVal}>{Math.round(weather.daily.temperature_2m_min[0])}deg</Text>
              <Text style={styles.wLbl}>LOW</Text>
            </View>
            <View style={styles.weatherCell}>
              <Text style={styles.wVal}>{weather.daily.relative_humidity_2m_max[0]}%</Text>
              <Text style={styles.wLbl}>HUMIDITY</Text>
            </View>
            <View style={styles.weatherCell}>
              <Text style={styles.wVal}>{(weather.daily.precipitation_sum[0] || 0).toFixed(0)}</Text>
              <Text style={styles.wLbl}>MM RAIN</Text>
            </View>
          </View>
        ) : null}

        <Text style={styles.section}>ALERTS (NEXT 14 DAYS)</Text>

        {risks.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No significant risk detected</Text>
            <Text style={styles.emptyText}>
              Weather conditions and recent reports don't show elevated disease risk for your area.
              Check back after the next rain.
            </Text>
          </View>
        ) : risks.map((r, i) => {
          const col = sevColor(r.severity, palette);
          return (
            <View key={i} style={[styles.card, { borderLeftColor: col }]}>
              <View style={styles.cardHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.diseaseName}>{r.disease}</Text>
                  <Text style={styles.cropLabel}>{r.crop.toUpperCase()}{r.peak_day ? ' · PEAK ' + r.peak_day : ''}</Text>
                </View>
                <Text style={[styles.pct, { color: col }]}>{r.risk_pct}%</Text>
              </View>
              <View style={styles.barBg}>
                <View style={[styles.barFill, { width: String(r.risk_pct) + '%' as any, backgroundColor: col }]} />
              </View>
              <Text style={styles.reason}>{r.reason}</Text>
              {r.action ? (
                <View style={styles.actionBox}>
                  <Text style={styles.actionLabel}>ACTION</Text>
                  <Text style={styles.actionText}>{r.action}</Text>
                  {r.products ? <Text style={styles.products}>{r.products}</Text> : null}
                </View>
              ) : null}
              <View style={styles.actions}>
                <Pressable onPress={() => router.push('/(tabs)/crops' as any)} style={styles.miniBtn}>
                  <Text style={styles.miniBtnText}>DIAGNOSE</Text>
                </Pressable>
                <Pressable onPress={() => router.push('/(tabs)/voice' as any)} style={styles.miniBtn}>
                  <Text style={styles.miniBtnText}>ASK GAIA</Text>
                </Pressable>
                <Pressable onPress={() => router.push('/marketplace' as any)} style={styles.miniBtn}>
                  <Text style={styles.miniBtnText}>BUY</Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        <Pressable onPress={load} style={styles.cta}>
          <Text style={styles.ctaTxt}>REFRESH</Text>
        </Pressable>
        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

function computeRisks(
  rules: Rule[],
  daily: any,
  outbreaks: LiveOutbreak[],
  myCrops: string[],
): Risk[] {
  if (!daily || !daily.time) return [];

  const days = Math.min(14, daily.time.length);
  const out: Risk[] = [];

  for (const rule of rules) {
    if (myCrops.length > 0) {
      const match = myCrops.some(c => rule.crop.toLowerCase().includes(c) || c.includes(rule.crop.toLowerCase()));
      if (!match) continue;
    }

    let favourableDays = 0;
    let peakIdx = -1;
    let rainTrigger = false;
    for (let i = 0; i < days; i++) {
      const tMax = daily.temperature_2m_max[i];
      const tMin = daily.temperature_2m_min[i];
      const hum = daily.relative_humidity_2m_max[i];
      const rain = daily.precipitation_sum[i] || 0;
      const avgT = (tMax + tMin) / 2;
      const tempOK = avgT >= rule.temp_min && avgT <= rule.temp_max;
      const humOK = hum >= rule.humidity_min;
      const rainOK = rule.rain_trigger_mm === 0 || rain >= rule.rain_trigger_mm;
      if (tempOK && humOK && rainOK) {
        favourableDays++;
        if (peakIdx === -1) peakIdx = i;
      }
      if (rain >= rule.rain_trigger_mm && rain > 0) rainTrigger = true;
    }

    let weatherPct = Math.min(85, favourableDays * 12 + (rainTrigger ? 10 : 0));
    if (favourableDays === 0) weatherPct = 0;

    const liveMatch = outbreaks.find(o =>
      o.disease.toLowerCase().includes(rule.disease.toLowerCase()) ||
      rule.disease.toLowerCase().includes(o.disease.toLowerCase())
    );
    let livePct = 0;
    let liveReason = '';
    if (liveMatch && liveMatch.n >= 2) {
      livePct = Math.min(100, 60 + liveMatch.n * 5);
      liveReason = 'Reported by ' + liveMatch.n + ' farmers nearby in the last 30 days';
    }

    if (weatherPct === 0 && livePct === 0) continue;

    const risk_pct = Math.max(weatherPct, livePct);
    const source: Risk['source'] =
      weatherPct > 0 && livePct > 0 ? 'both' :
      livePct > weatherPct ? 'live' : 'weather';

    const reasonParts: string[] = [];
    if (liveReason) reasonParts.push(liveReason);
    if (weatherPct > 0 && favourableDays > 0) {
      reasonParts.push(favourableDays + ' of next ' + days + ' days show favourable weather');
    }
    const reason = reasonParts.join(' · ') || 'Favourable conditions detected';

    const peakDay = peakIdx >= 0 && daily.time[peakIdx]
      ? new Date(daily.time[peakIdx]).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric' })
      : undefined;

    out.push({
      crop: rule.crop,
      disease: rule.disease,
      risk_pct: Math.round(risk_pct),
      reason,
      source,
      action: rule.action,
      products: rule.products,
      severity: rule.severity,
      peak_day: peakDay,
    });
  }

  return out.sort((a, b) => b.risk_pct - a.risk_pct).slice(0, 8);
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: p.neon },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 6 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  overallCard: { padding: 20, borderRadius: 18, borderWidth: 2, marginTop: 18, backgroundColor: p.surface },
  overallLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted },
  overallValue: { fontSize: 32, fontWeight: '900', letterSpacing: 1, marginTop: 4 },
  overallMeta: { fontSize: 11, color: p.textMuted, marginTop: 6 },
  weatherRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  weatherCell: { flex: 1, padding: 12, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  wVal: { fontSize: 16, fontWeight: '900', color: p.text },
  wLbl: { fontSize: 8, fontWeight: '700', letterSpacing: 1, color: p.textMuted, marginTop: 2 },
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 24, marginBottom: 12 },
  empty: { padding: 24, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: p.text, marginBottom: 6 },
  emptyText: { fontSize: 12, color: p.textMuted, textAlign: 'center', lineHeight: 18 },
  card: { padding: 16, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, borderLeftWidth: 4, marginBottom: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  diseaseName: { fontSize: 15, fontWeight: '800', color: p.text },
  cropLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, color: p.textMuted, marginTop: 2 },
  pct: { fontSize: 20, fontWeight: '900' },
  barBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
  barFill: { height: '100%', borderRadius: 3 },
  reason: { fontSize: 12, color: p.textMuted, marginBottom: 12, lineHeight: 17 },
  actionBox: { padding: 12, borderRadius: 10, backgroundColor: 'rgba(0,255,136,0.06)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.25)', marginBottom: 12 },
  actionLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5, color: '#00ff88', marginBottom: 4 },
  actionText: { fontSize: 12, color: p.text, lineHeight: 17, fontWeight: '600' },
  products: { fontSize: 10, color: p.textMuted, marginTop: 6, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: 6 },
  miniBtn: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1.5, borderColor: p.border, alignItems: 'center' },
  miniBtnText: { fontSize: 9, fontWeight: '900', letterSpacing: 1, color: p.text },
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 22 },
  ctaTxt: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
});
