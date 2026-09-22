import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import * as turf from '@turf/turf';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing, radius, typography, shadows } from '../src/theme';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';

const LAYERS = [
  { key: 'satellite', label: 'Satellite', tile: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' },
  { key: 'terrain',   label: 'Terrain',   tile: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png' },
  { key: 'street',    label: 'Street',    tile: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' },
  { key: 'dark',      label: 'Dark',      tile: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png' },
];

export default function FarmMapping() {
  const router = useRouter();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);

  const [points, setPoints] = useState<{lat: number; lon: number}[]>([]);
  const [areaM2, setAreaM2] = useState(0);
  const [tracking, setTracking] = useState(false);
  const [currentPos, setCurrentPos] = useState<{lat: number; lon: number} | null>(null);
  const [maps, setMaps] = useState<any[]>([]);
  const [layer, setLayer] = useState(LAYERS[0]);
  const [busy, setBusy] = useState(false);
  const locationSub = useRef<any>(null);
  const webRef = useRef<any>(null);

  const acres = areaM2 / 4046.86;
  const hectares = areaM2 / 10000;

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location needed', 'GAIA uses GPS to map your farm.');
        return;
      }
      loadMaps();
      const last = await Location.getLastKnownPositionAsync();
      if (last) {
        setCurrentPos({ lat: last.coords.latitude, lon: last.coords.longitude });
      }
    })();
    return () => {
      if (locationSub.current) locationSub.current.remove();
    };
  }, []);

  const loadMaps = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('farm_maps')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setMaps(data || []);
  }, [user]);

  const startTracking = async () => {
    setPoints([]);
    setAreaM2(0);
    setTracking(true);

    locationSub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 3 },
      (loc) => {
        const p = { lat: loc.coords.latitude, lon: loc.coords.longitude };
        setCurrentPos(p);
        setPoints((prev) => {
          const next = [...prev, p];
          if (webRef.current) {
            webRef.current.injectJavaScript(
              `window.addPoint && window.addPoint(${p.lat}, ${p.lon}); true;`
            );
          }
          if (next.length >= 3) {
            try {
              const poly = turf.polygon([[
                ...next.map((x) => [x.lon, x.lat]),
                [next[0].lon, next[0].lat],
              ]]);
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
    if (points.length >= 3) {
      await saveMap();
    } else {
      Alert.alert('Not enough points', 'Walk a wider perimeter and try again.');
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
        label: 'Field ' + new Date().toLocaleDateString(),
      });
      await loadMaps();
      Alert.alert('Saved', `${a.toFixed(2)} acres (${h.toFixed(2)} ha) mapped`);
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  };

  const html = currentPos ? `
    <!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
      html,body{margin:0;height:100%;background:#000;}
      #map{height:100%;background:#000;}
      .leaflet-control-attribution{background:rgba(0,0,0,0.6)!important;color:#888!important;font-size:9px;}
      .leaflet-control-attribution a{color:#00ff88!important;}
      .dot{width:18px;height:18px;border-radius:9px;background:#00ff88;
           box-shadow:0 0 12px #00ff88,0 0 24px #00ff88;animation:p 1.4s ease-in-out infinite;}
      @keyframes p{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.25);opacity:0.75}}
    </style></head>
    <body><div id="map"></div><script>
    var map = L.map('map',{zoomControl:false}).setView([${currentPos.lat}, ${currentPos.lon}], 18);
    var layer = L.tileLayer('${layer.tile}', {maxZoom: 20}).addTo(map);

    var icon = L.divIcon({className:'',html:'<div class="dot"></div>',iconSize:[18,18],iconAnchor:[9,9]});
    var marker = L.marker([${currentPos.lat}, ${currentPos.lon}], {icon: icon}).addTo(map);

    var pts = ${JSON.stringify(points.map((p) => [p.lat, p.lon]))};
    var poly = (pts.length >= 3) ? L.polygon(pts, {color:'#00ff88', weight:3, fillColor:'#00ff88', fillOpacity:0.15}).addTo(map) : null;
    var line = (pts.length >= 2) ? L.polyline(pts, {color:'#00ff88', weight:2, opacity:0.8}).addTo(map) : null;

    var trail = [];
    window.addPoint = function(lat, lon){
      trail.push([lat, lon]);
      marker.setLatLng([lat, lon]);
      if (trail.length >= 2) {
        if (line) line.setLatLngs(trail); else line = L.polyline(trail,{color:'#00ff88',weight:2,opacity:0.8}).addTo(map);
      }
      if (trail.length >= 3) {
        if (poly) poly.setLatLngs(trail);
        else poly = L.polygon(trail,{color:'#00ff88',weight:3,fillColor:'#00ff88',fillOpacity:0.15}).addTo(map);
      }
      map.panTo([lat, lon]);
    };
    </script></body></html>
  ` : '';

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={palette.gradientDeep as any}
        style={StyleSheet.absoluteFill}
      />

      {/* TOP BAR with BACK */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backIcon}>‹</Text>
          <Text style={styles.backText}>BACK</Text>
        </Pressable>
        <View style={styles.topCenter}>
          <Text style={styles.topKicker}>FARM MAPPING</Text>
          <Text style={styles.topTitle}>
            {tracking ? 'Recording…' : points.length >= 3 ? acres.toFixed(2) + ' acres' : 'Walk the perimeter'}
          </Text>
        </View>
        <View style={[styles.livePill, tracking && styles.livePillActive]}>
          <View style={[styles.liveDot, tracking && { backgroundColor: palette.danger }]} />
          <Text style={styles.liveText}>{tracking ? 'REC' : 'IDLE'}</Text>
        </View>
      </View>

      {/* LAYER CHIPS */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.layerRow}
      >
        {LAYERS.map((l) => {
          const active = l.key === layer.key;
          return (
            <Pressable
              key={l.key}
              onPress={() => setLayer(l)}
              style={[styles.layerChip, active && styles.layerChipActive]}
            >
              <Text style={[styles.layerText, active && styles.layerTextActive]}>
                {l.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* MAP CANVAS */}
      <View style={styles.mapWrap}>
        {currentPos ? (
          <WebView
            ref={webRef}
            source={{ html }}
            style={styles.map}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            scrollEnabled={false}
            key={layer.key}
          />
        ) : (
          <View style={styles.mapLoading}>
            <ActivityIndicator color={palette.neon} />
            <Text style={styles.mapLoadingText}>ACQUIRING GPS…</Text>
          </View>
        )}

        {/* Neon corner frame */}
        <View pointerEvents="none" style={styles.frame}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>

        {/* Live coordinates badge */}
        {currentPos ? (
          <View style={styles.coordBadge}>
            <Text style={styles.coordText}>
              {currentPos.lat.toFixed(5)}, {currentPos.lon.toFixed(5)}
            </Text>
          </View>
        ) : null}
      </View>

      {/* STATS */}
      <View style={styles.statRow}>
        <View style={styles.stat}>
          <Text style={styles.statVal}>{acres.toFixed(2)}</Text>
          <Text style={styles.statLbl}>ACRES</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statVal}>{hectares.toFixed(2)}</Text>
          <Text style={styles.statLbl}>HECTARES</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statVal}>{points.length}</Text>
          <Text style={styles.statLbl}>POINTS</Text>
        </View>
      </View>

      {/* PRIMARY CTA */}
      <Pressable
        onPress={tracking ? stopTracking : startTracking}
        disabled={busy}
        style={[styles.cta, tracking && styles.ctaStop, busy && { opacity: 0.6 }]}
      >
        <Text style={[styles.ctaText, tracking && { color: '#fff' }]}>
          {busy ? 'SAVING…' : tracking ? 'STOP & SAVE' : 'START WALKING'}
        </Text>
      </Pressable>

      {/* SAVED FIELDS */}
      {maps.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.savedRow}
        >
          {maps.map((m) => (
            <View key={m.id} style={styles.savedCard}>
              <Text style={styles.savedLabel}>{m.label}</Text>
              <Text style={styles.savedAcres}>{(m.area_acres || 0).toFixed(2)}</Text>
              <Text style={styles.savedUnit}>ACRES</Text>
            </View>
          ))}
        </ScrollView>
      ) : null}

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
  topTitle: { fontSize: 15, fontWeight: '900', color: palette.text, marginTop: 2, letterSpacing: -0.3 },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: palette.border,
    backgroundColor: palette.surface, width: 60, justifyContent: 'center',
  },
  livePillActive: { borderColor: palette.danger },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.textDim },
  liveText: { ...typography.micro, color: palette.text },

  layerRow: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, gap: spacing.sm },
  layerChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: palette.surface,
    borderWidth: 1, borderColor: palette.border,
  },
  layerChipActive: { backgroundColor: palette.neon, borderColor: palette.neon },
  layerText: { fontSize: 12, fontWeight: '700', color: palette.textMuted },
  layerTextActive: { color: palette.obsidian },

  mapWrap: {
    marginHorizontal: spacing.xl,
    height: 340,
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
  mapLoadingText: { ...typography.micro, color: palette.neon },

  frame: { ...StyleSheet.absoluteFillObject },
  corner: { position: 'absolute', width: 22, height: 22, borderColor: palette.neon },
  cornerTL: { top: 8, left: 8, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 8 },
  cornerTR: { top: 8, right: 8, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 8 },
  cornerBL: { bottom: 8, left: 8, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 8, right: 8, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 8 },

  coordBadge: {
    position: 'absolute', bottom: 12, left: 12,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 1, borderColor: palette.border,
  },
  coordText: { fontSize: 10, fontWeight: '700', color: palette.neon, fontFamily: 'monospace' },

  statRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, paddingHorizontal: spacing.xl },
  stat: {
    flex: 1, padding: spacing.lg, borderRadius: radius.md,
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
    alignItems: 'center',
  },
  statVal: { fontSize: 22, fontWeight: '900', color: palette.neon, letterSpacing: -0.5 },
  statLbl: { ...typography.micro, color: palette.textMuted, marginTop: 4 },

  cta: {
    marginHorizontal: spacing.xl, marginTop: spacing.lg,
    paddingVertical: 18, borderRadius: radius.md,
    backgroundColor: palette.neon, alignItems: 'center',
    ...shadows.neon,
  },
  ctaStop: {
    backgroundColor: palette.danger,
    shadowColor: palette.danger,
  },
  ctaText: { fontSize: 14, fontWeight: '900', letterSpacing: 1.2, color: palette.obsidian },

  savedRow: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, gap: spacing.sm },
  savedCard: {
    padding: spacing.lg, borderRadius: radius.md, minWidth: 130,
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
  },
  savedLabel: { ...typography.micro, color: palette.textMuted },
  savedAcres: { fontSize: 26, fontWeight: '900', color: palette.neon, marginTop: 4, letterSpacing: -0.8 },
  savedUnit: { ...typography.micro, color: palette.textDim, marginTop: 2 },
});
