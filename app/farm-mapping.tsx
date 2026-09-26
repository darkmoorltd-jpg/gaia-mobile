import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator,
  AppState,
} from 'react-native';
import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import { palette, spacing, radius, typography, shadows } from '../src/theme';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';

const GPS_CONFIG = {
  MAX_ACCURACY_M: 12,
  MIN_DISTANCE_M: 3,
  STRAIGHT_DISTANCE_M: 8,
  MAX_SPEED_MS: 8,
  LOOP_CLOSE_M: 6,
  MIN_POINTS_SAVE: 4,
  MIN_AREA_SQM: 50,
  KALMAN_Q: 0.0001,
  KALMAN_R_FACTOR: 1.0,
  MAP_UPDATE_MS: 800,
  ADAPTIVE_WINDOW: 5,
};

const LAYERS = [
  { key: 'satellite', label: 'Satellite',
    tile: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr: 'Esri' },
  { key: 'terrain', label: 'Terrain',
    tile: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attr: 'OpenTopoMap' },
  { key: 'street', label: 'Street',
    tile: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attr: 'OpenStreetMap' },
  { key: 'dark', label: 'Dark',
    tile: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    attr: 'CARTO' },
];

class KalmanFilter {
  constructor(q, r) { this.x = 0; this.p = 1; this.q = q || 0.0001; this.r = r || 1; }
  reset(v) { this.x = v; this.p = 1; }
  update(m, noise) {
    const R = this.r * noise * noise;
    this.p = this.p + this.q;
    const k = this.p / (this.p + R);
    this.x = this.x + k * (m - this.x);
    this.p = (1 - k) * this.p;
    return this.x;
  }
}

function simplifyPath(points, epsilonM) {
  if (points.length <= 3) return points;
  const eps = (epsilonM || 2) / 111320;
  const dist = (p, a, b) => {
    let x = a.lon, y = a.lat;
    let dx = b.lon - x, dy = b.lat - y;
    if (dx !== 0 || dy !== 0) {
      const t = ((p.lon - x) * dx + (p.lat - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) { x = b.lon; y = b.lat; }
      else if (t > 0) { x += dx * t; y += dy * t; }
    }
    dx = p.lon - x; dy = p.lat - y;
    return dx * dx + dy * dy;
  };
  const step = (pts) => {
    if (pts.length <= 2) return pts;
    let maxD = 0, idx = 0;
    const first = pts[0], last = pts[pts.length - 1];
    for (let i = 1; i < pts.length - 1; i++) {
      const d = dist(pts[i], first, last);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > eps * eps) {
      const left = step(pts.slice(0, idx + 1));
      const right = step(pts.slice(idx));
      return [...left.slice(0, -1), ...right];
    }
    return [first, last];
  };
  return step(points);
}

function geodesicArea(points) {
  const R = 6378137;
  if (points.length < 3) return 0;
  let total = 0;
  const toRad = (d) => (d * Math.PI) / 180;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    total += toRad(p2.lon - p1.lon) * (2 + Math.sin(toRad(p1.lat)) + Math.sin(toRad(p2.lat)));
  }
  return Math.abs((total * R * R) / 2);
}

function haversine(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function turnAngle(a, b, c) {
  const ab = { x: b.lon - a.lon, y: b.lat - a.lat };
  const bc = { x: c.lon - b.lon, y: c.lat - b.lat };
  const dot = ab.x * bc.x + ab.y * bc.y;
  const mag = Math.hypot(ab.x, ab.y) * Math.hypot(bc.x, bc.y);
  if (mag === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / mag));
  return (Math.acos(cos) * 180) / Math.PI;
}

export default function FarmMapping() {
  const router = useRouter();
  const { user } = useAuth();
  const styles = useMemo(() => createStyles(palette), []);

  const [points, setPoints] = useState([]);
  const [areaM2, setAreaM2] = useState(0);
  const [distanceM, setDistanceM] = useState(0);
  const [accuracy, setAccuracy] = useState(null);
  const [tracking, setTracking] = useState(false);
  const [currentPos, setCurrentPos] = useState(null);
  const [maps, setMaps] = useState([]);
  const [layer, setLayer] = useState(LAYERS[0]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Idle');
  const [loopClosed, setLoopClosed] = useState(false);

  const locationSub = useRef(null);
  const webRef = useRef(null);
  const kfLat = useRef(new KalmanFilter(0.0001, 1));
  const kfLon = useRef(new KalmanFilter(0.0001, 1));
  const lastFix = useRef(null);
  const pointsRef = useRef([]);
  const lastMapPush = useRef(0);

  const acres = areaM2 / 4046.86;
  const hectares = areaM2 / 10000;

  useEffect(() => {
    (async () => {
      const { status: ps } = await Location.requestForegroundPermissionsAsync();
      if (ps !== 'granted') {
        Alert.alert('Location needed', 'GAIA uses GPS to map your farm.');
        return;
      }
      try { await Location.requestBackgroundPermissionsAsync(); } catch (e) {}
      loadMaps();
      try {
        const last = await Location.getLastKnownPositionAsync({ maxAge: 30000 });
        if (last && (last.coords.accuracy || 1000) < GPS_CONFIG.MAX_ACCURACY_M) {
          setCurrentPos({ lat: last.coords.latitude, lon: last.coords.longitude });
          setAccuracy(last.coords.accuracy);
        }
      } catch (e) {}
    })();
    return () => { if (locationSub.current) locationSub.current.remove(); };
  }, []);

  const loadMaps = async () => {
    if (!user) return;
    const { data } = await supabase.from('farm_maps').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setMaps(data || []);
  };

  const onLocationUpdate = useCallback((loc) => {
    const acc = loc.coords.accuracy || 999;
    setAccuracy(acc);
    if (acc > GPS_CONFIG.MAX_ACCURACY_M) { setStatus('Weak signal'); return; }
    const now = Date.now();
    if (lastFix.current) {
      const dt = (now - lastFix.current.t) / 1000;
      const d = haversine(lastFix.current, { lat: loc.coords.latitude, lon: loc.coords.longitude });
      if (dt > 0 && d / dt > GPS_CONFIG.MAX_SPEED_MS) { setStatus('Rejected jump'); return; }
    }
    lastFix.current = { lat: loc.coords.latitude, lon: loc.coords.longitude, t: now };
    let smoothLat, smoothLon;
    if (kfLat.current.x === 0 && kfLon.current.x === 0) {
      kfLat.current.reset(loc.coords.latitude);
      kfLon.current.reset(loc.coords.longitude);
      smoothLat = loc.coords.latitude; smoothLon = loc.coords.longitude;
    } else {
      smoothLat = kfLat.current.update(loc.coords.latitude, acc);
      smoothLon = kfLon.current.update(loc.coords.longitude, acc);
    }
    const smooth = { lat: smoothLat, lon: smoothLon };
    setCurrentPos(smooth);
    setStatus('GPS ±' + acc.toFixed(1) + 'm');
    const prev = pointsRef.current;
    let threshold = GPS_CONFIG.MIN_DISTANCE_M;
    if (prev.length >= 3) {
      const lb = prev.slice(-GPS_CONFIG.ADAPTIVE_WINDOW);
      const a = lb[0], b = lb[Math.floor(lb.length / 2)], c = lb[lb.length - 1];
      const angle = turnAngle(a, b, c);
      threshold = GPS_CONFIG.MIN_DISTANCE_M + (1 - Math.min(angle / 90, 1)) * (GPS_CONFIG.STRAIGHT_DISTANCE_M - GPS_CONFIG.MIN_DISTANCE_M);
    }
    if (prev.length > 0) {
      const d = haversine(prev[prev.length - 1], smooth);
      if (d < threshold) return;
      setDistanceM((dm) => dm + d);
    }
    const next = [...prev, smooth];
    pointsRef.current = next;
    setPoints(next);
    if (!loopClosed && next.length > 8) {
      const d = haversine(next[0], smooth);
      const walked = next.reduce((s, p, i) => i === 0 ? 0 : s + haversine(next[i - 1], p), 0);
      if (walked > 100 && d < GPS_CONFIG.LOOP_CLOSE_M) { setLoopClosed(true); setStatus('Closed — tap STOP'); }
    }
    if (next.length >= 3) {
      const simplified = simplifyPath(next, 1.5);
      setAreaM2(geodesicArea(simplified));
    }
    if (now - lastMapPush.current > GPS_CONFIG.MAP_UPDATE_MS && webRef.current) {
      lastMapPush.current = now;
      webRef.current.injectJavaScript('window.addPoint && window.addPoint(' + smooth.lat + ',' + smooth.lon + '); true;');
    }
  }, [loopClosed]);

  const startTracking = async () => {
    kfLat.current.reset(0); kfLon.current.reset(0);
    lastFix.current = null; pointsRef.current = [];
    setPoints([]); setAreaM2(0); setDistanceM(0);
    setLoopClosed(false); setTracking(true); setStatus('Locking GPS...');
    locationSub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 1, timeInterval: 1000 },
      onLocationUpdate
    );
  };

  const stopTracking = useCallback(async () => {
    if (locationSub.current) { locationSub.current.remove(); locationSub.current = null; }
    setTracking(false); setStatus('Idle');
    const pts = pointsRef.current;
    if (pts.length < GPS_CONFIG.MIN_POINTS_SAVE) {
      Alert.alert('Not enough points', 'Walk a wider perimeter.'); return;
    }
    const simplified = simplifyPath(pts, 2);
    const area = geodesicArea(simplified);
    if (area < GPS_CONFIG.MIN_AREA_SQM) {
      Alert.alert('Area too small', 'Walk a larger field.'); return;
    }
    if (!user) return;
    setBusy(true);
    try {
      const a = area / 4046.86;
      const h = area / 10000;
      await supabase.from('farm_maps').insert({
        user_id: user.id,
        boundary: JSON.stringify(simplified),
        area_sqm: area,
        area_acres: a,
        distance_m: distanceM,
        label: 'Field ' + new Date().toLocaleDateString(),
      });
      await loadMaps();
      Alert.alert('Saved', a.toFixed(3) + ' acres · ' + h.toFixed(3) + ' ha');
    } catch (e) {
      Alert.alert('Save failed', (e && e.message) || 'Try again');
    } finally {
      setBusy(false);
    }
  }, [distanceM, user]);

  const html = useMemo(() => {
    if (!currentPos) return '';
    const trail = JSON.stringify(points.map((p) => [p.lat, p.lon]));
    return '<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><style>html,body,#map{height:100%;margin:0;background:#000;}.pulse{width:16px;height:16px;border-radius:8px;background:#00ff88;box-shadow:0 0 12px #00ff88;animation:pl 1.4s infinite;}@keyframes pl{0%,100%{transform:scale(1)}50%{transform:scale(1.3)}}</style></head><body><div id="map"></div><script>var map=L.map("map",{zoomControl:false}).setView([' + currentPos.lat + ',' + currentPos.lon + '],19);L.tileLayer("' + layer.tile + '",{maxZoom:21,attribution:"' + layer.attr + '"}).addTo(map);var icon=L.divIcon({html:"<div class=\\"pulse\\"></div>",iconSize:[16,16],iconAnchor:[8,8]});var marker=L.marker([' + currentPos.lat + ',' + currentPos.lon + '],{icon:icon}).addTo(map);var trail=' + trail + ';var line=trail.length>=2?L.polyline(trail,{color:"#00ff88",weight:3}).addTo(map):null;var poly=trail.length>=3?L.polygon(trail,{color:"#00ff88",weight:3,fillColor:"#00ff88",fillOpacity:0.2}).addTo(map):null;window.addPoint=function(lat,lon){trail.push([lat,lon]);marker.setLatLng([lat,lon]);if(trail.length>=2){if(line)line.setLatLngs(trail);else line=L.polyline(trail,{color:"#00ff88",weight:3}).addTo(map);}if(trail.length>=3){if(poly)poly.setLatLngs(trail);else poly=L.polygon(trail,{color:"#00ff88",weight:3,fillColor:"#00ff88",fillOpacity:0.2}).addTo(map);}map.panTo([lat,lon],{animate:false});};</script></body></html>';
  }, [currentPos, layer.key, points.length]);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
          <Text style={styles.backText}>BACK</Text>
        </Pressable>
        <View style={styles.topCenter}>
          <Text style={styles.topKicker}>FARM MAPPING</Text>
          <Text style={styles.topTitle}>{tracking ? status : acres > 0 ? acres.toFixed(3) + ' acres' : 'Walk the perimeter'}</Text>
        </View>
        <View style={[styles.livePill, tracking && styles.livePillActive]}>
          <View style={[styles.liveDot, tracking && { backgroundColor: palette.danger }]} />
          <Text style={styles.liveText}>{tracking ? 'REC' : 'IDLE'}</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.layerRow}>
        {LAYERS.map((l) => (
          <Pressable key={l.key} onPress={() => setLayer(l)} style={[styles.layerChip, l.key === layer.key && styles.layerChipActive]}>
            <Text style={[styles.layerText, l.key === layer.key && styles.layerTextActive]}>{l.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.mapWrap}>
        {currentPos ? (
          <WebView ref={webRef} key={layer.key} source={{ html }} style={styles.map} originWhitelist={['*']} javaScriptEnabled domStorageEnabled scrollEnabled={false} mixedContentMode="always" />
        ) : (
          <View style={styles.mapLoading}>
            <ActivityIndicator color={palette.neon} />
            <Text style={styles.loadingText}>ACQUIRING GPS...</Text>
          </View>
        )}
        {accuracy != null && (
          <View style={[styles.accBadge, accuracy > GPS_CONFIG.MAX_ACCURACY_M && { borderColor: palette.danger }]}>
            <Text style={[styles.accText, accuracy > GPS_CONFIG.MAX_ACCURACY_M && { color: palette.danger }]}>GPS ±{accuracy.toFixed(1)} m</Text>
          </View>
        )}
        {loopClosed && (<View style={styles.loopBadge}><Text style={styles.loopText}>✓ CLOSED</Text></View>)}
      </View>
      <View style={styles.statRow}>
        <View style={styles.stat}><Text style={styles.statVal}>{acres.toFixed(3)}</Text><Text style={styles.statLbl}>ACRES</Text></View>
        <View style={styles.stat}><Text style={styles.statVal}>{hectares.toFixed(3)}</Text><Text style={styles.statLbl}>HECTARES</Text></View>
        <View style={styles.stat}><Text style={styles.statVal}>{(distanceM / 1000).toFixed(2)}</Text><Text style={styles.statLbl}>KM</Text></View>
      </View>
      <Pressable onPress={tracking ? stopTracking : startTracking} disabled={busy} style={[styles.cta, tracking && styles.ctaStop, busy && { opacity: 0.5 }]}>
        <Text style={[styles.ctaText, tracking && { color: '#fff' }]}>{busy ? 'SAVING...' : tracking ? 'STOP & SAVE' : 'START WALKING'}</Text>
      </Pressable>
      {maps.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.savedRow}>
          {maps.map((m) => (
            <View key={m.id} style={styles.savedCard}>
              <Text style={styles.savedLabel}>{m.label}</Text>
              <Text style={styles.savedAcres}>{(m.area_acres || 0).toFixed(3)}</Text>
              <Text style={styles.savedUnit}>ACRES</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.obsidian },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: spacing.md },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 70 },
  backIcon: { fontSize: 28, color: palette.text },
  backText: { fontSize: 11, fontWeight: '800', color: palette.text },
  topCenter: { flex: 1, alignItems: 'center' },
  topKicker: { ...typography.micro, color: palette.textMuted },
  topTitle: { fontSize: 15, fontWeight: '900', color: palette.text },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  livePillActive: { borderColor: palette.danger },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.textDim },
  liveText: { ...typography.micro, color: palette.text },
  layerRow: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, gap: spacing.sm },
  layerChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  layerChipActive: { backgroundColor: palette.neon, borderColor: palette.neon },
  layerText: { fontSize: 12, fontWeight: '700', color: palette.textMuted },
  layerTextActive: { color: palette.obsidian },
  mapWrap: { marginHorizontal: spacing.xl, height: 360, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1.5, borderColor: palette.borderHi, backgroundColor: palette.abyss, position: 'relative' },
  map: { flex: 1, backgroundColor: palette.abyss },
  mapLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { ...typography.micro, color: palette.neon },
  accBadge: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.7)', borderWidth: 1, borderColor: palette.border },
  accText: { fontSize: 10, fontWeight: '800', color: palette.neon, fontFamily: 'monospace' },
  loopBadge: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(0,255,136,0.15)', borderWidth: 1, borderColor: palette.neon },
  loopText: { fontSize: 10, fontWeight: '900', color: palette.neon },
  statRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, paddingHorizontal: spacing.xl },
  stat: { flex: 1, padding: spacing.lg, borderRadius: radius.md, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '900', color: palette.neon },
  statLbl: { ...typography.micro, color: palette.textMuted, marginTop: 4 },
  cta: { marginHorizontal: spacing.xl, marginTop: spacing.lg, paddingVertical: 18, borderRadius: radius.md, backgroundColor: palette.neon, alignItems: 'center' },
  ctaStop: { backgroundColor: palette.danger },
  ctaText: { fontSize: 14, fontWeight: '900', letterSpacing: 1.2, color: palette.obsidian },
  savedRow: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, gap: spacing.sm },
  savedCard: { padding: spacing.lg, borderRadius: radius.md, minWidth: 130, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  savedLabel: { ...typography.micro, color: palette.textMuted },
  savedAcres: { fontSize: 24, fontWeight: '900', color: palette.neon, marginTop: 4 },
  savedUnit: { ...typography.micro, color: palette.textDim, marginTop: 2 },
});
