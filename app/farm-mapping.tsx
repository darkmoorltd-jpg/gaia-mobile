import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import * as turf from '@turf/turf';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius, typography, shadows } from '../src/theme';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';

// Reject fixes worse than this accuracy (meters)
const MAX_ACCURACY_M = 15;
// Smooth by averaging the last N accepted points
const SMOOTH_WINDOW = 3;
// Minimum metres between recorded points
const MIN_DISTANCE_M = 5;

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

export default function FarmMapping() {
  const router = useRouter();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);

  const [points, setPoints] = useState<{lat: number; lon: number}[]>([]);
  const [areaM2, setAreaM2] = useState(0);
  const [distanceM, setDistanceM] = useState(0);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [tracking, setTracking] = useState(false);
  const [currentPos, setCurrentPos] = useState<{lat: number; lon: number} | null>(null);
  const [maps, setMaps] = useState<any[]>([]);
  const [layer, setLayer] = useState(LAYERS[0]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>('Idle');

  const locationSub = useRef<any>(null);
  const webRef = useRef<any>(null);
  const rawBuffer = useRef<{lat: number; lon: number; acc: number}[]>([]);

  const acres = areaM2 / 4046.86;
  const hectares = areaM2 / 10000;

  useEffect(() => {
    (async () => {
      const { status: ps } = await Location.requestForegroundPermissionsAsync();
      if (ps !== 'granted') {
        Alert.alert('Location needed', 'GAIA uses GPS to map your farm.');
        return;
      }
      loadMaps();
      try {
        const last = await Location.getLastKnownPositionAsync({ maxAge: 60000 });
        if (last && (last.coords.accuracy ?? 1000) < MAX_ACCURACY_M) {
          setCurrentPos({ lat: last.coords.latitude, lon: last.coords.longitude });
          setAccuracy(last.coords.accuracy ?? null);
        }
      } catch {}
    })();
    return () => { if (locationSub.current) locationSub.current.remove(); };
  }, []);

  const loadMaps = async () => {
    if (!user) return;
    const { data } = await supabase.from('farm_maps')
      .select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setMaps(data || []);
  };

  const haversine = (a: any, b: any) => turf.distance([a.lon, a.lat], [b.lon, b.lat], { units: 'meters' });

  const startTracking = async () => {
    rawBuffer.current = [];
    setPoints([]);
    setAreaM2(0);
    setDistanceM(0);
    setTracking(true);
    setStatus('Locking GPS…');

    locationSub.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 2,
        timeInterval: 1000,
      },
      (loc) => {
        const acc = loc.coords.accuracy ?? 999;
        setAccuracy(acc);

        // 1. Reject low-quality fixes
        if (acc > MAX_ACCURACY_M) {
          setStatus('Weak signal — waiting…');
          return;
        }

        // 2. Push to raw buffer, keep last N for smoothing
        rawBuffer.current.push({
          lat: loc.coords.latitude,
          lon: loc.coords.longitude,
          acc,
        });
        if (rawBuffer.current.length > SMOOTH_WINDOW) rawBuffer.current.shift();

        // 3. Weighted average — weight by 1/accuracy
        const buf = rawBuffer.current;
        const wsum = buf.reduce((s, p) => s + (1 / p.acc), 0);
        const smooth = {
          lat: buf.reduce((s, p) => s + p.lat / p.acc, 0) / wsum,
          lon: buf.reduce((s, p) => s + p.lon / p.acc, 0) / wsum,
        };

        setCurrentPos(smooth);
        setStatus(`GPS ±${acc.toFixed(1)} m`);

        // 4. Only record if we've moved enough
        setPoints((prev) => {
          if (prev.length > 0) {
            const last = prev[prev.length - 1];
            const d = haversine(last, smooth);
            if (d < MIN_DISTANCE_M) return prev;
            setDistanceM((dm) => dm + d);
          }
          const next = [...prev, smooth];

          // Update WebView live
          if (webRef.current) {
            webRef.current.injectJavaScript(
              `window.addPoint && window.addPoint(${smooth.lat}, ${smooth.lon}); true;`
            );
          }

          // Update area
          if (next.length >= 3) {
            try {
              const ring = [[
                ...next.map((x) => [x.lon, x.lat]),
                [next[0].lon, next[0].lat],
              ]];
              const poly = turf.polygon(ring);
              setAreaM2(turf.area(poly));
            } catch {}
          }
          return next;
        });
      }
    );
  };

  const stopTracking = async () => {
    if (locationSub.current) {
      locationSub.current.remove();
      locationSub.current = null;
    }
    setTracking(false);
    setStatus('Idle');
    if (points.length >= 4) {
      await saveMap();
    } else {
      Alert.alert('Not enough points',
        'Walk a wider perimeter. GAIA needs at least 4 well-spaced points.');
    }
  };

  const saveMap = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const a = areaM2 / 4046.86;
      const h = areaM2 / 10000;
      await supabase.from('farm_maps').insert({
        user_id: user.id,
        boundary: JSON.stringify(points),
        area_sqm: areaM2,
        area_acres: a,
        distance_m: distanceM,
        label: 'Field ' + new Date().toLocaleDateString(),
      });
      await loadMaps();
      Alert.alert('Saved',
        `${a.toFixed(3)} acres · ${h.toFixed(3)} ha · ${(distanceM/1000).toFixed(2)} km walked`);
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  };

  // ── Leaflet HTML ──
  const html = currentPos ? `
    <!DOCTYPE html><html><head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
      html,body,#map{height:100%;margin:0;background:#000;}
      .leaflet-control-attribution{background:rgba(0,0,0,.55)!important;
        color:#777!important;font-size:9px;}
      .leaflet-control-attribution a{color:#00ff88!important;}
      .pulse{width:16px;height:16px;border-radius:8px;background:#00ff88;
        box-shadow:0 0 12px #00ff88,0 0 24px #00ff88;
        animation:pl 1.4s ease-in-out infinite;}
      @keyframes pl{0%,100%{transform:scale(1);opacity:1}
                    50%{transform:scale(1.3);opacity:.7}}
    </style></head><body>
    <div id="map"></div>
    <script>
      var map = L.map('map',{zoomControl:false,attributionControl:true})
        .setView([${currentPos.lat}, ${currentPos.lon}], 19);
      L.tileLayer('${layer.tile}',{
        maxZoom: 21,
        attribution: '${layer.attr}'
      }).addTo(map);

      var icon = L.divIcon({className:'',html:'<div class="pulse"></div>',
        iconSize:[16,16],iconAnchor:[8,8]});
      var marker = L.marker([${currentPos.lat}, ${currentPos.lon}],{icon:icon}).addTo(map);

      var trail = ${JSON.stringify(points.map((p) => [p.lat, p.lon]))};
      var line = trail.length >= 2
        ? L.polyline(trail,{color:'#00ff88',weight:3,opacity:.9}).addTo(map)
        : null;
      var poly = trail.length >= 3
        ? L.polygon(trail,{color:'#00ff88',weight:3,
            fillColor:'#00ff88',fillOpacity:.2}).addTo(map)
        : null;

      window.addPoint = function(lat,lon){
        trail.push([lat,lon]);
        marker.setLatLng([lat,lon]);
        if (trail.length >= 2) {
          if (line) line.setLatLngs(trail);
          else line = L.polyline(trail,{color:'#00ff88',weight:3,opacity:.9}).addTo(map);
        }
        if (trail.length >= 3) {
          if (poly) poly.setLatLngs(trail);
          else poly = L.polygon(trail,{color:'#00ff88',weight:3,
            fillColor:'#00ff88',fillOpacity:.2}).addTo(map);
        }
        map.panTo([lat,lon],{animate:false});
      };
    </script></body></html>
  ` : '';

  return (
    <View style={styles.container}>
      {/* TOP BAR */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backIcon}>‹</Text>
          <Text style={styles.backText}>BACK</Text>
        </Pressable>
        <View style={styles.topCenter}>
          <Text style={styles.topKicker}>FARM MAPPING</Text>
          <Text style={styles.topTitle}>
            {tracking ? status : acres > 0 ? acres.toFixed(3) + ' acres' : 'Walk the perimeter'}
          </Text>
        </View>
        <View style={[styles.livePill, tracking && styles.livePillActive]}>
          <View style={[styles.liveDot, tracking && { backgroundColor: palette.danger }]} />
          <Text style={styles.liveText}>{tracking ? 'REC' : 'IDLE'}</Text>
        </View>
      </View>

      {/* LAYER CHIPS */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.layerRow}>
        {LAYERS.map((l) => {
          const active = l.key === layer.key;
          return (
            <Pressable key={l.key} onPress={() => setLayer(l)}
              style={[styles.layerChip, active && styles.layerChipActive]}>
              <Text style={[styles.layerText, active && styles.layerTextActive]}>
                {l.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* MAP */}
      <View style={styles.mapWrap}>
        {currentPos ? (
          <WebView
            ref={webRef}
            key={layer.key}
            source={{ html }}
            style={styles.map}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            scrollEnabled={false}
            androidLayerType="hardware"
            mixedContentMode="always"
            startInLoadingState
            renderLoading={() => (
              <View style={styles.mapLoading}>
                <ActivityIndicator color={palette.neon} />
              </View>
            )}
          />
        ) : (
          <View style={styles.mapLoading}>
            <ActivityIndicator color={palette.neon} />
            <Text style={styles.loadingText}>ACQUIRING GPS…</Text>
          </View>
        )}

        {/* corner frame */}
        <View pointerEvents="none" style={styles.frame}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>

        {/* accuracy badge */}
        {accuracy != null && (
          <View style={[
            styles.accBadge,
            accuracy > MAX_ACCURACY_M && { borderColor: palette.danger },
          ]}>
            <Text style={[
              styles.accText,
              accuracy > MAX_ACCURACY_M && { color: palette.danger },
            ]}>
              GPS ±{accuracy.toFixed(1)} m
            </Text>
          </View>
        )}
      </View>

      {/* STATS */}
      <View style={styles.statRow}>
        <View style={styles.stat}>
          <Text style={styles.statVal}>{acres.toFixed(3)}</Text>
          <Text style={styles.statLbl}>ACRES</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statVal}>{hectares.toFixed(3)}</Text>
          <Text style={styles.statLbl}>HECTARES</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statVal}>{(distanceM/1000).toFixed(2)}</Text>
          <Text style={styles.statLbl}>KM WALKED</Text>
        </View>
      </View>

      {/* CTA */}
      <Pressable
        onPress={tracking ? stopTracking : startTracking}
        disabled={busy}
        style={[styles.cta, tracking && styles.ctaStop, busy && { opacity: 0.5 }]}
      >
        <Text style={[styles.ctaText, tracking && { color: '#fff' }]}>
          {busy ? 'SAVING…' : tracking ? 'STOP & SAVE' : 'START WALKING'}
        </Text>
      </Pressable>

      {/* SAVED FIELDS */}
      {maps.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.savedRow}>
          {maps.map((m) => (
            <View key={m.id} style={styles.savedCard}>
              <Text style={styles.savedLabel}>{m.label}</Text>
              <Text style={styles.savedAcres}>{(m.area_acres || 0).toFixed(3)}</Text>
              <Text style={styles.savedUnit}>ACRES</Text>
            </View>
          ))}
        </ScrollView>
      )}

      <View style={{ height: 40 }} />
    </View>
  );
}

const createStyles = (palette: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.obsidian },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: spacing.md,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 70 },
  backIcon: { fontSize: 28, fontWeight: '300', color: palette.text, marginTop: -3 },
  backText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: palette.text },
  topCenter: { flex: 1, alignItems: 'center' },
  topKicker: { ...typography.micro, color: palette.textMuted },
  topTitle: { fontSize: 15, fontWeight: '900', color: palette.text, marginTop: 2 },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, width: 62,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: palette.border,
    backgroundColor: palette.surface, justifyContent: 'center',
  },
  livePillActive: { borderColor: palette.danger },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.textDim },
  liveText: { ...typography.micro, color: palette.text },

  layerRow: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, gap: spacing.sm },
  layerChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
  },
  layerChipActive: { backgroundColor: palette.neon, borderColor: palette.neon },
  layerText: { fontSize: 12, fontWeight: '700', color: palette.textMuted },
  layerTextActive: { color: palette.obsidian },

  mapWrap: {
    marginHorizontal: spacing.xl,
    height: 360,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: palette.borderHi,
    backgroundColor: palette.abyss,
    position: 'relative',
    ...shadows.neon,
  },
  map: { flex: 1, backgroundColor: palette.abyss },
  mapLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { ...typography.micro, color: palette.neon },

  frame: { ...StyleSheet.absoluteFillObject },
  corner: { position: 'absolute', width: 22, height: 22, borderColor: palette.neon },
  cornerTL: { top: 8, left: 8, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 8 },
  cornerTR: { top: 8, right: 8, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 8 },
  cornerBL: { bottom: 8, left: 8, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 8, right: 8, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 8 },

  accBadge: {
    position: 'absolute', top: 12, left: 12,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 1, borderColor: palette.border,
  },
  accText: { fontSize: 10, fontWeight: '800', color: palette.neon, fontFamily: 'monospace' },

  statRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, paddingHorizontal: spacing.xl },
  stat: {
    flex: 1, padding: spacing.lg, borderRadius: radius.md,
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
    alignItems: 'center',
  },
  statVal: { fontSize: 20, fontWeight: '900', color: palette.neon, letterSpacing: -0.5 },
  statLbl: { ...typography.micro, color: palette.textMuted, marginTop: 4 },

  cta: {
    marginHorizontal: spacing.xl, marginTop: spacing.lg,
    paddingVertical: 18, borderRadius: radius.md,
    backgroundColor: palette.neon, alignItems: 'center',
    ...shadows.neon,
  },
  ctaStop: { backgroundColor: palette.danger, shadowColor: palette.danger },
  ctaText: { fontSize: 14, fontWeight: '900', letterSpacing: 1.2, color: palette.obsidian },

  savedRow: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, gap: spacing.sm },
  savedCard: {
    padding: spacing.lg, borderRadius: radius.md, minWidth: 130,
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
  },
  savedLabel: { ...typography.micro, color: palette.textMuted },
  savedAcres: { fontSize: 24, fontWeight: '900', color: palette.neon, marginTop: 4 },
  savedUnit: { ...typography.micro, color: palette.textDim, marginTop: 2 },
});
