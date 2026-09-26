import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import { palette, spacing, radius, typography } from '../src/theme';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';

const CFG = {
  MAX_ACC: 12,
  MIN_D: 3,
  STRAIGHT_D: 8,
  MAX_SPEED: 8,
  LOOP_CLOSE: 6,
  MIN_PTS: 4,
  MIN_AREA: 50,
  MAP_MS: 800,
  WIN: 5,
};

const LAYERS = [
  { key: 'satellite', label: 'Satellite', tile: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: 'Esri' },
  { key: 'terrain', label: 'Terrain', tile: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attr: 'OpenTopoMap' },
  { key: 'street', label: 'Street', tile: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attr: 'OpenStreetMap' },
  { key: 'dark', label: 'Dark', tile: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', attr: 'CARTO' },
];

class KF {
  constructor(q, r) { this.x = 0; this.p = 1; this.q = q; this.r = r; }
  reset(v) { this.x = v; this.p = 1; }
  update(m, noise) {
    const R = this.r * noise * noise;
    this.p += this.q;
    const k = this.p / (this.p + R);
    this.x += k * (m - this.x);
    this.p = (1 - k) * this.p;
    return this.x;
  }
}

function simplify(pts, epsM) {
  if (pts.length <= 3) return pts;
  const eps = epsM / 111320;
  const segDist = (p, a, b) => {
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
  const step = (arr) => {
    if (arr.length <= 2) return arr;
    let maxD = 0, idx = 0;
    const first = arr[0], last = arr[arr.length - 1];
    for (let i = 1; i < arr.length - 1; i++) {
      const d = segDist(arr[i], first, last);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > eps * eps) {
      const L = step(arr.slice(0, idx + 1));
      const R = step(arr.slice(idx));
      return L.slice(0, -1).concat(R);
    }
    return [first, last];
  };
  return step(pts);
}

function area(pts) {
  if (pts.length < 3) return 0;
  const R = 6378137;
  const toRad = (d) => (d * Math.PI) / 180;
  let total = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    total += toRad(b.lon - a.lon) * (2 + Math.sin(toRad(a.lat)) + Math.sin(toRad(b.lat)));
  }
  return Math.abs((total * R * R) / 2);
}

function dist(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function turn(a, b, c) {
  const ab = { x: b.lon - a.lon, y: b.lat - a.lat };
  const bc = { x: c.lon - b.lon, y: c.lat - b.lat };
  const dot = ab.x * bc.x + ab.y * bc.y;
  const mag = Math.hypot(ab.x, ab.y) * Math.hypot(bc.x, bc.y);
  if (mag === 0) return 0;
  const cs = Math.max(-1, Math.min(1, dot / mag));
  return (Math.acos(cs) * 180) / Math.PI;
}

export default function FarmMapping() {
  const router = useRouter();
  const { user } = useAuth();
  const styles = useMemo(() => makeStyles(palette), []);
  const [pts, setPts] = useState([]);
  const [areaM2, setAreaM2] = useState(0);
  const [walked, setWalked] = useState(0);
  const [acc, setAcc] = useState(null);
  const [tracking, setTracking] = useState(false);
  const [pos, setPos] = useState(null);
  const [maps, setMaps] = useState([]);
  const [layer, setLayer] = useState(LAYERS[0]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Idle');
  const [closed, setClosed] = useState(false);
  const sub = useRef(null);
  const web = useRef(null);
  const kfLat = useRef(new KF(0.0001, 1));
  const kfLon = useRef(new KF(0.0001, 1));
  const last = useRef(null);
  const ptsRef = useRef([]);
  const lastPush = useRef(0);
  const acres = areaM2 / 4046.86;
  const ha = areaM2 / 10000;

  useEffect(() => {
    (async () => {
      const res = await Location.requestForegroundPermissionsAsync();
      if (res.status !== 'granted') {
        Alert.alert('Location needed', 'GAIA uses GPS to map your farm.');
        return;
      }
      try { await Location.requestBackgroundPermissionsAsync(); } catch (e) {}
      load();
      try {
        const l = await Location.getLastKnownPositionAsync({ maxAge: 30000 });
        if (l && (l.coords.accuracy || 1000) < CFG.MAX_ACC) {
          setPos({ lat: l.coords.latitude, lon: l.coords.longitude });
          setAcc(l.coords.accuracy);
        }
      } catch (e) {}
    })();
    return () => { if (sub.current) sub.current.remove(); };
  }, []);

  const load = async () => {
    if (!user) return;
    const r = await supabase.from('farm_maps').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setMaps(r.data || []);
  };

  const onFix = useCallback((l) => {
    const a = l.coords.accuracy || 999;
    setAcc(a);
    if (a > CFG.MAX_ACC) { setStatus('Weak signal'); return; }
    const now = Date.now();
    if (last.current) {
      const dt = (now - last.current.t) / 1000;
      const d = dist(last.current, { lat: l.coords.latitude, lon: l.coords.longitude });
      if (dt > 0 && d / dt > CFG.MAX_SPEED) { setStatus('Rejected jump'); return; }
    }
    last.current = { lat: l.coords.latitude, lon: l.coords.longitude, t: now };
    let sLat, sLon;
    if (kfLat.current.x === 0 && kfLon.current.x === 0) {
      kfLat.current.reset(l.coords.latitude);
      kfLon.current.reset(l.coords.longitude);
      sLat = l.coords.latitude; sLon = l.coords.longitude;
    } else {
      sLat = kfLat.current.update(l.coords.latitude, a);
      sLon = kfLon.current.update(l.coords.longitude, a);
    }
    const s = { lat: sLat, lon: sLon };
    setPos(s);
    setStatus('GPS +-' + a.toFixed(1) + 'm');
    const prev = ptsRef.current;
    let thr = CFG.MIN_D;
    if (prev.length >= 3) {
      const lb = prev.slice(-CFG.WIN);
      const x = lb[0], y = lb[Math.floor(lb.length / 2)], z = lb[lb.length - 1];
      const t = turn(x, y, z);
      thr = CFG.MIN_D + (1 - Math.min(t / 90, 1)) * (CFG.STRAIGHT_D - CFG.MIN_D);
    }
    if (prev.length > 0) {
      const d = dist(prev[prev.length - 1], s);
      if (d < thr) return;
      setWalked((w) => w + d);
    }
    const next = prev.concat([s]);
    ptsRef.current = next;
    setPts(next);
    if (!closed && next.length > 8) {
      const d = dist(next[0], s);
      let w = 0;
      for (let i = 1; i < next.length; i++) w += dist(next[i - 1], next[i]);
      if (w > 100 && d < CFG.LOOP_CLOSE) { setClosed(true); setStatus('Closed - tap STOP'); }
    }
    if (next.length >= 3) setAreaM2(area(simplify(next, 1.5)));
    if (now - lastPush.current > CFG.MAP_MS && web.current) {
      lastPush.current = now;
      web.current.injectJavaScript('window.addPoint && window.addPoint(' + s.lat + ',' + s.lon + '); true;');
    }
  }, [closed]);

  const start = async () => {
    kfLat.current.reset(0); kfLon.current.reset(0);
    last.current = null; ptsRef.current = [];
    setPts([]); setAreaM2(0); setWalked(0);
    setClosed(false); setTracking(true); setStatus('Locking GPS...');
    sub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 1, timeInterval: 1000 },
      onFix
    );
  };

  const stop = useCallback(async () => {
    if (sub.current) { sub.current.remove(); sub.current = null; }
    setTracking(false); setStatus('Idle');
    const p = ptsRef.current;
    if (p.length < CFG.MIN_PTS) { Alert.alert('Not enough points', 'Walk a wider perimeter.'); return; }
    const s = simplify(p, 2);
    const a = area(s);
    if (a < CFG.MIN_AREA) { Alert.alert('Area too small', 'Walk a larger field.'); return; }
    if (!user) return;
    setBusy(true);
    try {
      const ac = a / 4046.86;
      const hh = a / 10000;
      await supabase.from('farm_maps').insert({
        user_id: user.id,
        boundary: JSON.stringify(s),
        area_sqm: a,
        area_acres: ac,
        distance_m: walked,
        label: 'Field ' + new Date().toLocaleDateString(),
      });
      await load();
      Alert.alert('Saved', ac.toFixed(3) + ' acres - ' + hh.toFixed(3) + ' ha');
    } catch (e) {
      Alert.alert('Save failed', (e && e.message) || 'Try again');
    } finally {
      setBusy(false);
    }
  }, [walked, user]);

  const html = useMemo(() => {
    if (!pos) return '';
    const trail = JSON.stringify(pts.map((p) => [p.lat, p.lon]));
    const parts = [
      '<!DOCTYPE html><html><head><meta charset="utf-8"/>',
      '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>',
      '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>',
      '<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></scr' + 'ipt>',
      '<style>html,body,#map{height:100%;margin:0;background:#000;}',
      '.pulse{width:16px;height:16px;border-radius:8px;background:#00ff88;',
      'box-shadow:0 0 12px #00ff88;animation:pl 1.4s infinite;}',
      '@keyframes pl{0%,100%{transform:scale(1)}50%{transform:scale(1.3)}}</style></head>',
      '<body><div id="map"></div><script>',
      'var map=L.map("map",{zoomControl:false}).setView([' + pos.lat + ',' + pos.lon + '],19);',
      'L.tileLayer("' + layer.tile + '",{maxZoom:21,attribution:"' + layer.attr + '"}).addTo(map);',
      'var icon=L.divIcon({html:"<div class=pulse></div>",iconSize:[16,16],iconAnchor:[8,8]});',
      'var marker=L.marker([' + pos.lat + ',' + pos.lon + '],{icon:icon}).addTo(map);',
      'var trail=' + trail + ';',
      'var line=trail.length>=2?L.polyline(trail,{color:"#00ff88",weight:3}).addTo(map):null;',
      'var poly=trail.length>=3?L.polygon(trail,{color:"#00ff88",weight:3,fillColor:"#00ff88",fillOpacity:0.2}).addTo(map):null;',
      'window.addPoint=function(lat,lon){trail.push([lat,lon]);marker.setLatLng([lat,lon]);',
      'if(trail.length>=2){if(line)line.setLatLngs(trail);else line=L.polyline(trail,{color:"#00ff88",weight:3}).addTo(map);}',
      'if(trail.length>=3){if(poly)poly.setLatLngs(trail);else poly=L.polygon(trail,{color:"#00ff88",weight:3,fillColor:"#00ff88",fillOpacity:0.2}).addTo(map);}',
      'map.panTo([lat,lon],{animate:false});};',
      '</scr' + 'ipt></body></html>',
    ];
    return parts.join('');
  }, [pos, layer.key, pts.length]);

  return (
    <View style={styles.c}>
      <View style={styles.tb}>
        <Pressable onPress={() => router.back()} style={styles.bb}>
          <Text style={styles.bi}>‹</Text>
          <Text style={styles.bt}>BACK</Text>
        </Pressable>
        <View style={styles.tc}>
          <Text style={styles.tk}>FARM MAPPING</Text>
          <Text style={styles.tt}>{tracking ? status : acres > 0 ? acres.toFixed(3) + ' acres' : 'Walk the perimeter'}</Text>
        </View>
        <View style={[styles.lp, tracking && styles.lpa]}>
          <View style={[styles.ld, tracking && { backgroundColor: palette.danger }]} />
          <Text style={styles.lt}>{tracking ? 'REC' : 'IDLE'}</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.lr}>
        {LAYERS.map((l) => (
          <Pressable key={l.key} onPress={() => setLayer(l)} style={[styles.lc, l.key === layer.key && styles.lca]}>
            <Text style={[styles.ltx, l.key === layer.key && styles.ltxa]}>{l.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.mw}>
        {pos ? (
          <WebView ref={web} key={layer.key} source={{ html }} style={styles.m} originWhitelist={['*']} javaScriptEnabled domStorageEnabled scrollEnabled={false} mixedContentMode="always" />
        ) : (
          <View style={styles.ml}>
            <ActivityIndicator color={palette.neon} />
            <Text style={styles.mlt}>ACQUIRING GPS...</Text>
          </View>
        )}
        {acc != null && (
          <View style={[styles.ab, acc > CFG.MAX_ACC && { borderColor: palette.danger }]}>
            <Text style={[styles.at, acc > CFG.MAX_ACC && { color: palette.danger }]}>GPS +-{acc.toFixed(1)} m</Text>
          </View>
        )}
        {closed && <View style={styles.cb}><Text style={styles.ct}>CLOSED</Text></View>}
      </View>
      <View style={styles.sr}>
        <View style={styles.st}><Text style={styles.sv}>{acres.toFixed(3)}</Text><Text style={styles.sl}>ACRES</Text></View>
        <View style={styles.st}><Text style={styles.sv}>{ha.toFixed(3)}</Text><Text style={styles.sl}>HECTARES</Text></View>
        <View style={styles.st}><Text style={styles.sv}>{(walked / 1000).toFixed(2)}</Text><Text style={styles.sl}>KM</Text></View>
      </View>
      <Pressable onPress={tracking ? stop : start} disabled={busy} style={[styles.cta, tracking && styles.ctas, busy && { opacity: 0.5 }]}>
        <Text style={[styles.ctxt, tracking && { color: '#fff' }]}>{busy ? 'SAVING...' : tracking ? 'STOP & SAVE' : 'START WALKING'}</Text>
      </Pressable>
      {maps.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.svr}>
          {maps.map((m) => (
            <View key={m.id} style={styles.svc}>
              <Text style={styles.svl}>{m.label}</Text>
              <Text style={styles.sva}>{(m.area_acres || 0).toFixed(3)}</Text>
              <Text style={styles.svu}>ACRES</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (p) => StyleSheet.create({
  c: { flex: 1, backgroundColor: p.obsidian },
  tb: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: spacing.md },
  bb: { flexDirection: 'row', alignItems: 'center', width: 70 },
  bi: { fontSize: 28, color: p.text },
  bt: { fontSize: 11, fontWeight: '800', color: p.text },
  tc: { flex: 1, alignItems: 'center' },
  tk: { ...typography.micro, color: p.textMuted },
  tt: { fontSize: 15, fontWeight: '900', color: p.text },
  lp: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  lpa: { borderColor: p.danger },
  ld: { width: 6, height: 6, borderRadius: 3, backgroundColor: p.textDim },
  lt: { ...typography.micro, color: p.text },
  lr: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, gap: spacing.sm },
  lc: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  lca: { backgroundColor: p.neon, borderColor: p.neon },
  ltx: { fontSize: 12, fontWeight: '700', color: p.textMuted },
  ltxa: { color: p.obsidian },
  mw: { marginHorizontal: spacing.xl, height: 360, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1.5, borderColor: p.borderHi, backgroundColor: p.abyss, position: 'relative' },
  m: { flex: 1, backgroundColor: p.abyss },
  ml: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  mlt: { ...typography.micro, color: p.neon },
  ab: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.7)', borderWidth: 1, borderColor: p.border },
  at: { fontSize: 10, fontWeight: '800', color: p.neon, fontFamily: 'monospace' },
  cb: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(0,255,136,0.15)', borderWidth: 1, borderColor: p.neon },
  ct: { fontSize: 10, fontWeight: '900', color: p.neon },
  sr: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, paddingHorizontal: spacing.xl },
  st: { flex: 1, padding: spacing.lg, borderRadius: radius.md, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  sv: { fontSize: 20, fontWeight: '900', color: p.neon },
  sl: { ...typography.micro, color: p.textMuted, marginTop: 4 },
  cta: { marginHorizontal: spacing.xl, marginTop: spacing.lg, paddingVertical: 18, borderRadius: radius.md, backgroundColor: p.neon, alignItems: 'center' },
  ctas: { backgroundColor: p.danger },
  ctxt: { fontSize: 14, fontWeight: '900', letterSpacing: 1.2, color: p.obsidian },
  svr: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, gap: spacing.sm },
  svc: { padding: spacing.lg, borderRadius: radius.md, minWidth: 130, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  svl: { ...typography.micro, color: p.textMuted },
  sva: { fontSize: 24, fontWeight: '900', color: p.neon, marginTop: 4 },
  svu: { ...typography.micro, color: p.textDim, marginTop: 2 },
});
