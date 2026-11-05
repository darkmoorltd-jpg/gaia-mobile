
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import MapView, { UrlTile, Marker, Polygon } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { useTheme, typography, spacing, radius } from '../src/theme';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';
import { useLocation } from '../src/store/location';

// ============================================================
// 🔑 CDSE CREDENTIALS
// ============================================================
const CDSE_CLIENT_ID = 'sh-866fb988-5387-4d82-bb2d-6c2c2aab2e60';
const CDSE_CLIENT_SECRET = 'jG8r1sNnkLLHYAuhUMzDSwcwSwywvu3IV0nhRdAinNDeadueT5qANvRIgy4lo9rd2K1qzVPt21e5lQ7pEazC7h';
const CDSE_INSTANCE_ID = '575061f7-641d-4d0c-afd2-7cc9516e1848';

const TOKEN_URL = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
const WMTS_BASE = `https://sh.dataspace.copernicus.eu/ogc/wmts/${CDSE_INSTANCE_ID}`;

type Layer = 'TRUE_COLOR' | 'NDVI' | 'MOISTURE';

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
  const mapRef = useRef<MapView | null>(null);

  const [farms, setFarms] = useState<Farm[]>([]);
  const [pickedFarmId, setPickedFarmId] = useState<string | null>(null);
  const [farmBoundary, setFarmBoundary] = useState<any[]>([]);
  const [layer, setLayer] = useState<Layer>('NDVI');
  const [timeMode, setTimeMode] = useState<'latest' | 'peak' | '30d'>('latest');
  const [token, setToken] = useState<string | null>(null);
  const [ref, setRef] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number; label?: string } | null>(null);

  // 1. Fetch CDSE OAuth Token with Auto-Refresh
  useEffect(() => {
    let intervalId: any;

    const fetchToken = async () => {
      try {
        const body = new URLSearchParams();
        body.append('grant_type', 'client_credentials');
        body.append('client_id', CDSE_CLIENT_ID);
        body.append('client_secret', CDSE_CLIENT_SECRET);

        const res = await fetch(TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });
        if (!res.ok) throw new Error('Token failed');
        const data = await res.json();
        setToken(data.access_token);
      } catch (e) {
        console.warn('CDSE token error:', e);
      }
    };

    fetchToken();
    // Refresh every 9 minutes (expires at 10)
    intervalId = setInterval(fetchToken, 9 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, []);

  // 2. Load Farms
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

  // 3. Fetch Farm Boundary Polygon
  useEffect(() => {
    if (!pickedFarmId) return;
    (async () => {
      const { data } = await supabase
        .from('farm_boundaries')
        .select('points')
        .eq('farm_id', pickedFarmId)
        .maybeSingle();
      if (data && data.points) {
        setFarmBoundary(data.points);
      } else {
        setFarmBoundary([]);
      }
    })();
  }, [pickedFarmId]);

  // 4. Fallback to live location
  useEffect(() => {
    if (!pickedFarmId && userLoc && !coords) {
      setCoords({ lat: userLoc.latitude, lon: userLoc.longitude, label: 'Current location' });
    }
  }, [pickedFarmId, userLoc, coords]);

  // 5. Fetch NDVI Summary (from backend for WoW change)
  const fetchNdvi = useCallback(async () => {
    if (!coords || !user) return;
    try {
      const sess = await supabase.auth.getSession();
      const authToken = sess.data.session?.access_token ?? '';
      const url = `https://gaia-api-xuly.onrender.com/satellite/ndvi?lat=${coords.lat}&lon=${coords.lon}&days=90`;
      const res = await fetch(url, { headers: { Authorization: 'Bearer ' + authToken } });
      if (!res.ok) return;
      const data = await res.json();
      const series = data.series || [];
      const latest = data.latest;

      let wow: number | null = null;
      if (series.length >= 2) {
        const cur = series[series.length - 1].ndvi;
        const prev = series[series.length - 2].ndvi;
        if (prev > 0) wow = Math.round(((cur - prev) / prev) * 1000) / 10;
      }

      setSummary({
        latest: latest?.ndvi ?? null,
        series,
        change_wow_pct: wow,
        status: latest?.ndvi >= 0.6 ? 'healthy' : latest?.ndvi >= 0.4 ? 'moderate' : latest?.ndvi >= 0.2 ? 'stressed' : 'bare',
      });
    } catch (e) {
      console.log('ndvi fetch failed', e);
    }
  }, [coords, user]);

  useEffect(() => {
    if (coords) fetchNdvi();
  }, [coords, fetchNdvi]);

  const pickFarm = (f: Farm) => {
    if (!f.centroid_lat || !f.centroid_lng) {
      Alert.alert('No GPS', 'This farm has no GPS coordinates.');
      return;
    }
    setPickedFarmId(f.id);
    setCoords({ lat: f.centroid_lat, lon: f.centroid_lng, label: f.name });
    setSummary(null);
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: f.centroid_lat,
        longitude: f.centroid_lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 500);
    }
  };

  const onRefresh = () => {
    setRef(true);
    fetchNdvi();
    setRef(false);
  };

  const ndviPct = summary?.latest != null ? Math.max(0, Math.min(1, Number(summary.latest))) : 0;
  const col = statusColor(summary?.status || 'unknown', palette);

  // 6. Build WMTS URL
  // Calculate dynamic TIME parameter based on timeMode
  let timeParam = '2023-01-01/2026-12-31'; // 'latest' default
  if (timeMode === 'peak') {
    timeParam = '2024-07-01/2024-09-30'; // Peak rainy season
  } else if (timeMode === '30d') {
    const now = new Date();
    const past = new Date();
    past.setDate(now.getDate() - 30);
    timeParam = `${past.toISOString().split('T')[0]}/${now.toISOString().split('T')[0]}`;
  }

  const tileUrl = token
    ? `${WMTS_BASE}?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=default&TILEMATRIXSET=PopularWebMercator256&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png&TIME=${timeParam}&access_token=${token}`
    : null;

  const mapRegion = coords ? {
    latitude: coords.lat,
    longitude: coords.lon,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  } : {
    latitude: 9.0820,
    longitude: 8.6753,
    latitudeDelta: 2,
    longitudeDelta: 2,
  };

  const hasActiveFarming = summary?.latest >= 0.4;
  const isSparse = summary?.latest >= 0.2 && summary?.latest < 0.4;
  const isBare = summary?.latest != null && summary?.latest < 0.2;
  
  const farmingStatusLabel = hasActiveFarming
    ? '✅ ACTIVE FARMING DETECTED'
    : isSparse
      ? '⚠️ SPARSE VEGETATION (EARLY STAGE)'
      : isBare
        ? '❌ NO SIGNIFICANT VEGETATION'
        : '⏳ AWAITING DATA';
        
  const farmingStatusColor = hasActiveFarming
    ? '#00ff88'
    : isSparse
      ? '#ffb300'
      : isBare
        ? '#ff3b5c'
        : palette.textMuted;

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
          <Text style={styles.sub}>{coords.lat.toFixed(4)}, {coords.lon.toFixed(4)}</Text>
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

        {summary?.latest != null && (
          <View style={[styles.verificationCard, { borderColor: farmingStatusColor }]}>
            <Text style={[styles.verificationText, { color: farmingStatusColor }]}>
              {farmingStatusLabel}
            </Text>
            <Text style={styles.verificationSub}>
              Based on Copernicus Sentinel-2 NDVI data for this exact field boundary.
            </Text>
          </View>
        )}

        <View style={styles.mapBox}>
          {!token ? (
            <View style={styles.center}><ActivityIndicator color={palette.neon} /><Text style={styles.dim}>Authenticating…</Text></View>
          ) : !tileUrl ? (
            <View style={styles.center}><Text style={styles.dim}>No credentials</Text></View>
          ) : (
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={mapRegion}
              mapType="none"
              showsUserLocation={true}
              showsCompass={true}
              toolbarEnabled={false}
            >
              <UrlTile urlTemplate={tileUrl} maximumZ={19} flipY={false} />
              
              {coords && (
                <Marker coordinate={{ latitude: coords.lat, longitude: coords.lon }} title="Your Field" />
              )}

              {farmBoundary.length > 0 && (
                <Polygon
                  coordinates={farmBoundary}
                  strokeColor="#00ff88"
                  fillColor="rgba(0,255,136,0.1)"
                  strokeWidth={2}
                />
              )}
            </MapView>
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

        {/* Time Slider */}
        <View style={[styles.chips, { marginTop: 8 }]}>
          {[
            { id: 'latest', label: 'Latest' },
            { id: '30d', label: 'Last 30 Days' },
            { id: 'peak', label: 'Peak Season (Aug)' }
          ].map((tm: any) => (
            <Pressable
              key={tm.id}
              onPress={() => setTimeMode(tm.id)}
              style={[styles.chip, timeMode === tm.id && { borderColor: '#00ff88', backgroundColor: 'rgba(0,255,136,0.15)' }]}
            >
              <Text style={[styles.chipTxt, timeMode === tm.id && { color: '#00ff88', fontWeight: '900' }]}>{tm.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.legend}>
          {layer === 'TRUE_COLOR' && 'Natural color from Sentinel-2 L2A'}
          {layer === 'NDVI' && 'Green = healthy vegetation · Yellow = moderate · Red = stressed'}
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
                  Vegetation dropped more than 20% in one week. Check irrigation, pests, or disease.
                </Text>
              </View>
            ) : null}
          </View>
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
  verificationCard: {
    marginTop: 16, padding: 16, borderRadius: 12, borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center'
  },
  verificationText: { fontSize: 16, fontWeight: '900', letterSpacing: 1, marginBottom: 6, textAlign: 'center' },
  verificationSub: { fontSize: 11, color: '#888', textAlign: 'center', lineHeight: 16 },
  mapBox: {
    aspectRatio: 1, marginTop: 18, borderRadius: 20, overflow: 'hidden',
    backgroundColor: p.abyss, borderWidth: 1, borderColor: p.border, position: 'relative',
  },
  map: { width: '100%', height: '100%' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  dim: { color: p.textMuted, fontSize: 13, textAlign: 'center' },
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
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 22 },
  ctaTxt: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
});
