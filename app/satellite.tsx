import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, typography, spacing, radius } from '../src/theme';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';
import { useLocation } from '../src/store/location';

const API = 'https://gaia-api-xuly.onrender.com';

type Layer = 'TRUE_COLOR' | 'NDVI' | 'MOISTURE';

interface SeriesPoint { date: string; ndvi: number; ndmi?: number | null }
interface Farm { id: string; name: string; crop?: string; state?: string; centroid_lat?: number; centroid_lng?: number }

const statusColor = (s: string, p: any) =>
  s === 'healthy' ? '#00ff88' :
  s === 'moderate' ? '#ffb300' :
  s === 'stressed' ? '#ff6b35' :
  s === 'bare' ? '#ff3b5c' : p.textMuted;

const statusLabel = (s: string) => ({
  healthy: 'Healthy',
  moderate: 'Moderate',
  stressed: 'Stressed',
  bare: 'Bare / fallow',
  unknown: 'No data',
}[s] || 'Unknown');

export default function Satellite() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const { user } = useAuth();
  const userLoc = useLocation((s) => s.coords);

  const [farms, setFarms] = useState<Farm[]>([]);
  const [pickedFarmId, setPickedFarmId] = useState<string | null>(null);
  const [layer, setLayer] = useState<Layer>('NDVI');
  const [imgUri, setImgUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ref, setRef] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number; label?: string } | null>(null);
  const [imageDate, setImageDate] = useState<string | null>(null);

  const loadFarms = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('farms')
      .select('id,name,crop,state,centroid_lat,centroid_lng')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setFarms(data || []);
    if (data && data.length > 0 && !pickedFarmId) {
      const f = data[0];
      if (f.centroid_lat && f.centroid_lng) {
        setPickedFarmId(f.id);
        setCoords({ lat: f.centroid_lat, lon: f.centroid_lng, label: f.name });
      }
    }
  }, [user, pickedFarmId]);

  useEffect(() => { loadFarms(); }, [loadFarms]);

  // Auto-fallback to live location if no farm picked
  useEffect(() => {
    if (!pickedFarmId && userLoc && !coords) {
      setCoords({ lat: userLoc.latitude, lon: userLoc.longitude, label: 'Current location' });
    }
  }, [pickedFarmId, userLoc, coords]);

  const fetchTile = useCallback(async () => {
    if (!coords) return;
    setBusy(true);
    try {
      const sess = await supabase.auth.getSession();
      const token = sess.data.session?.access_token ?? '';
      const url = API + '/satellite/tile?lat=' + coords.lat + '&lon=' + coords.lon + '&layer=' + layer + '&days=60';
      const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        setImgUri(reader.result as string);
        setImageDate(new Date().toISOString().slice(0, 10));
      };
      reader.readAsDataURL(blob);
    } catch (e: any) {
      Alert.alert('Satellite error', e?.message || 'Could not load tile');
    } finally {
      setBusy(false);
      setRef(false);
    }
  }, [coords, layer]);

  const fetchNdvi = useCallback(async () => {
    if (!coords || !user) return;
    try {
      const sess = await supabase.auth.getSession();
      const token = sess.data.session?.access_token ?? '';
      const url = API + '/satellite/ndvi?lat=' + coords.lat + '&lon=' + coords.lon + '&days=90';
      const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
      if (!res.ok) return;
      const data = await res.json();
      const series: SeriesPoint[] = data.series || [];
      const latest = data.latest;

      if (latest && pickedFarmId) {
        await supabase.from('farm_ndvi_history').upsert({
          farm_id: pickedFarmId,
          user_id: user.id,
          observed_date: latest.date,
          ndvi: latest.ndvi,
          ndmi: latest.ndmi,
        }, { onConflict: 'farm_id,observed_date' });

        // Persist all new points too
        const rows = series.map((s) => ({
          farm_id: pickedFarmId,
          user_id: user.id,
          observed_date: s.date,
          ndvi: s.ndvi,
          ndmi: s.ndmi,
        }));
        if (rows.length > 0) {
          await supabase.from('farm_ndvi_history').upsert(rows, { onConflict: 'farm_id,observed_date' });
        }
      }

      // Compute WoW change client-side for immediate display
      let wow: number | null = null;
      if (series.length >= 2) {
        const cur = series[series.length - 1].ndvi;
        const prev = series[series.length - 2].ndvi;
        if (prev > 0) wow = Math.round(((cur - prev) / prev) * 1000) / 10;
      }

      setSummary({
        latest: latest?.ndvi ?? null,
        latest_date: latest?.date,
        series,
        change_wow_pct: wow,
        status:
          latest?.ndvi >= 0.6 ? 'healthy' :
          latest?.ndvi >= 0.4 ? 'moderate' :
          latest?.ndvi >= 0.2 ? 'stressed' :
          latest?.ndvi != null ? 'bare' : 'unknown',
      });
    } catch (e) {
      console.log('ndvi fetch failed', e);
    }
  }, [coords, user, pickedFarmId]);

  useEffect(() => {
    if (!coords) return;
    fetchTile();
    fetchNdvi();
  }, [coords, layer, fetchTile, fetchNdvi]);

  const pickFarm = (f: Farm) => {
    if (!f.centroid_lat || !f.centroid_lng) {
      Alert.alert('No GPS', 'This farm has no GPS coordinates.');
      return;
    }
    setPickedFarmId(f.id);
    setCoords({ lat: f.centroid_lat, lon: f.centroid_lng, label: f.name });
    setSummary(null);
  };

  const onRefresh = () => {
    setRef(true);
    fetchTile();
    fetchNdvi();
  };

  const ndviPct = summary?.latest != null ? Math.max(0, Math.min(1, Number(summary.latest))) : 0;
  const col = statusColor(summary?.status || 'unknown', palette);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={onRefresh} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.kicker}>SATELLITE MONITOR</Text>
        <Text style={styles.title}>{coords?.label || 'Field Monitor'}</Text>
        {coords ? (
          <Text style={styles.sub}>{coords.lat.toFixed(4)}, {coords.lon.toFixed(4)}{imageDate ? ' · ' + imageDate : ''}</Text>
        ) : (
          <Text style={styles.sub}>Locating…</Text>
        )}

        {farms.length > 0 ? (
          <>
            <Text style={styles.section}>YOUR FARMS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.farmScroll}>
              {farms.map((f) => (
                <Pressable
                  key={f.id}
                  onPress={() => pickFarm(f)}
                  style={[styles.farmChip, pickedFarmId === f.id && styles.farmChipOn]}
                >
                  <Text style={[styles.farmChipText, pickedFarmId === f.id && styles.farmChipTextOn]}>{f.name}</Text>
                  {f.crop ? <Text style={styles.farmChipMeta}>{f.crop}</Text> : null}
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}

        <View style={styles.mapBox}>
          {busy && !imgUri ? (
            <View style={styles.center}><ActivityIndicator color={palette.neon} /></View>
          ) : imgUri ? (
            <Image source={{ uri: imgUri }} style={styles.map} resizeMode="cover" />
          ) : (
            <View style={styles.center}>
              <Text style={styles.dim}>No imagery loaded</Text>
              <Pressable onPress={fetchTile} style={styles.retryBtn}>
                <Text style={styles.retryTxt}>RETRY</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.chips}>
          {(['TRUE_COLOR', 'NDVI', 'MOISTURE'] as Layer[]).map((l) => (
            <Pressable
              key={l}
              onPress={() => setLayer(l)}
              style={[styles.chip, layer === l && styles.chipActive]}
            >
              <Text style={[styles.chipTxt, layer === l && styles.chipTxtActive]}>{l.replace('_', ' ')}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.legend}>
          {layer === 'TRUE_COLOR' && 'Natural color from Sentinel-2 L2A, last 60 days, least cloudy'}
          {layer === 'NDVI' && 'Green = healthy vegetation · Yellow = moderate · Red = stressed or bare'}
          {layer === 'MOISTURE' && 'Blue = high moisture · Yellow = dry · Red = very dry'}
        </Text>

        {summary?.latest != null ? (
          <View style={[styles.ndviCard, { borderColor: col }]}>
            <Text style={styles.ndviLabel}>LATEST NDVI</Text>
            <Text style={[styles.ndviValue, { color: col }]}>{Number(summary.latest).toFixed(3)}</Text>
            <View style={styles.ndviBar}>
              <View style={[styles.ndviBarFill, { width: String(Math.round(ndviPct * 100)) + '%', backgroundColor: col }]} />
            </View>
            <Text style={[styles.ndviStatus, { color: col }]}>{statusLabel(summary.status).toUpperCase()}</Text>
            {summary.change_wow_pct != null ? (
              <Text style={[styles.ndviWow, { color: summary.change_wow_pct < -20 ? '#ff3b5c' : summary.change_wow_pct < 0 ? '#ffb300' : '#00ff88' }]}>
                {summary.change_wow_pct > 0 ? '▲' : summary.change_wow_pct < 0 ? '▼' : '■'} {Math.abs(summary.change_wow_pct).toFixed(1)}% vs last week
              </Text>
            ) : null}
            {summary.change_wow_pct != null && summary.change_wow_pct < -20 ? (
              <View style={styles.alertBox}>
                <Text style={styles.alertTitle}>WATER STRESS SIGNAL</Text>
                <Text style={styles.alertText}>
                  Vegetation dropped more than 20% in one week. Check irrigation, pests, or disease. Open Early Warning for details.
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {summary?.series && summary.series.length > 1 ? (
          <>
            <Text style={styles.section}>90-DAY TREND</Text>
            <View style={styles.chart}>
              <View style={styles.chartBars}>
                {summary.series.map((p: SeriesPoint, i: number) => {
                  const h = Math.max(4, Math.round(Math.max(0, Math.min(1, p.ndvi)) * 120));
                  const cc = p.ndvi >= 0.6 ? '#00ff88' : p.ndvi >= 0.4 ? '#ffb300' : p.ndvi >= 0.2 ? '#ff6b35' : '#ff3b5c';
                  return (
                    <View key={i} style={styles.barCol}>
                      <View style={[styles.bar, { height: h, backgroundColor: cc }]} />
                      <Text style={styles.barLbl}>{p.date.slice(5, 10)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        ) : null}

        <Pressable onPress={onRefresh} style={styles.cta}>
          <Text style={styles.ctaTxt}>REFRESH</Text>
        </Pressable>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { paddingHorizontal: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: p.neon },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 6 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  section: { ...typography.micro, color: p.textMuted, marginTop: 22, marginBottom: 10 },
  farmScroll: { gap: 8, paddingRight: 16 },
  farmChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface, minWidth: 100 },
  farmChipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.1)' },
  farmChipText: { fontSize: 12, fontWeight: '800', color: p.text },
  farmChipTextOn: { color: p.neon },
  farmChipMeta: { fontSize: 10, color: p.textMuted, marginTop: 2 },
  mapBox: {
    aspectRatio: 1, marginTop: 18, borderRadius: 20, overflow: 'hidden',
    backgroundColor: p.abyss, borderWidth: 1, borderColor: p.border, position: 'relative',
  },
  map: { width: '100%', height: '100%' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  dim: { color: p.textMuted, fontSize: 13 },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: p.borderHi },
  retryTxt: { color: p.neon, fontWeight: '800', letterSpacing: 1.5, fontSize: 11 },
  chips: { flexDirection: 'row', gap: 8, marginTop: 16 },
  chip: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  chipActive: { backgroundColor: p.neonSoft, borderColor: p.borderHi },
  chipTxt: { fontSize: 10, fontWeight: '800', color: p.textMuted, letterSpacing: 1 },
  chipTxtActive: { color: p.neon },
  legend: { fontSize: 11, color: p.textMuted, marginTop: 12, textAlign: 'center', lineHeight: 16 },
  ndviCard: { marginTop: 20, padding: 20, borderRadius: 18, borderWidth: 2, backgroundColor: p.surface, alignItems: 'center' },
  ndviLabel: { ...typography.micro, color: p.textMuted },
  ndviValue: { fontSize: 44, fontWeight: '900', letterSpacing: -2, marginTop: 4 },
  ndviBar: { width: '100%', height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginTop: 12 },
  ndviBarFill: { height: '100%', borderRadius: 4 },
  ndviStatus: { fontSize: 12, fontWeight: '900', letterSpacing: 2, marginTop: 10 },
  ndviWow: { fontSize: 12, fontWeight: '800', marginTop: 8 },
  alertBox: { marginTop: 14, padding: 12, borderRadius: 10, backgroundColor: 'rgba(255,59,92,0.08)', borderWidth: 1, borderColor: 'rgba(255,59,92,0.3)', width: '100%' },
  alertTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: '#ff3b5c', marginBottom: 4 },
  alertText: { fontSize: 11, color: p.text, lineHeight: 16 },
  chart: { padding: 12, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 140 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '70%', borderRadius: 4 },
  barLbl: { fontSize: 8, color: p.textDim, marginTop: 4 },
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 22 },
  ctaTxt: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
});
